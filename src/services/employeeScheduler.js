const Employee = require("../models/Employee");
const { runEmployee } = require("../engine/employeeEngine");

const SCHEDULER_INTERVAL = 30 * 1000; // 30 seconds

let schedulerInterval = null;
let schedulerRunning = false;

const WEEK_DAYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/**
 * Get employee's current local date/time
 * according to employee timezone.
 */
const getLocalParts = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "Asia/Kolkata",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);

  const result = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  const weekdayMap = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };

  return {
    day: weekdayMap[result.weekday],
    date: `${result.year}-${result.month}-${result.day}`,
    time: `${result.hour}:${result.minute}`,
  };
};

/**
 * Get YYYY-MM-DD for an exception
 * in the employee's timezone.
 */
const getExceptionDate = (date, timezone) => {
  if (!date) return null;

  return getLocalParts(
    new Date(date),
    timezone
  ).date;
};

/**
 * Check whether today has a schedule exception.
 *
 * HOLIDAY => don't run
 * WORK    => run even if normal working day is disabled
 */
const getScheduleException = (
  exceptions,
  localDate,
  timezone
) => {
  if (!Array.isArray(exceptions)) {
    return null;
  }

  return (
    exceptions.find((exception) => {
      const exceptionDate =
        getExceptionDate(
          exception.date,
          timezone
        );

      return exceptionDate === localDate;
    }) || null
  );
};

/**
 * Check if employee should run right now.
 */
const shouldEmployeeRunNow = (employee, now) => {
  const schedule = employee.schedule;

  if (!schedule) {
    return false;
  }

  if (schedule.triggerMode !== "AUTOMATIC") {
    return false;
  }

  const weekly = schedule.weekly || {};

  const timezone =
    weekly.timezone ||
    "Asia/Kolkata";

  const local = getLocalParts(
    now,
    timezone
  );

  if (!local.day || !local.date || !local.time) {
    return false;
  }

  /**
   * Check scheduled time.
   */
  const scheduledTime =
    weekly.time || "10:00";

  if (local.time !== scheduledTime) {
    return false;
  }

  /**
   * Check exceptions.
   */
  const exception =
    getScheduleException(
      schedule.exceptions,
      local.date,
      timezone
    );

  if (exception) {
    /**
     * Holiday means skip.
     */
    if (exception.type === "HOLIDAY") {
      return false;
    }

    /**
     * WORK means force working today.
     */
    if (exception.type === "WORK") {
      return true;
    }
  }

  /**
   * Normal working day.
   */
  const workingDays =
    Array.isArray(
      weekly.workingDays
    )
      ? weekly.workingDays
      : [];

  return workingDays.includes(
    local.day
  );
};

/**
 * Atomically claim this scheduled slot.
 *
 * This prevents duplicate execution if:
 * - scheduler checks twice
 * - server has multiple scheduler workers
 * - two requests happen almost simultaneously
 */
const claimScheduledSlot = async ({
  employeeId,
  slot,
}) => {
  const employee =
    await Employee.findOneAndUpdate(
      {
        _id: employeeId,

        "schedule.triggerMode":
          "AUTOMATIC",

        $or: [
          {
            "schedule.lastTriggeredSlot":
              {
                $ne: slot,
              },
          },
          {
            "schedule.lastTriggeredSlot":
              null,
          },
        ],
      },
      {
        $set: {
          "schedule.lastTriggeredSlot":
            slot,
        },
      },
      {
        new: true,
      }
    );

  return employee;
};

/**
 * Run one scheduled employee.
 */
const processEmployee = async (
  employee,
  now
) => {
  try {
    const timezone =
      employee.schedule?.weekly
        ?.timezone ||
      "Asia/Kolkata";

    const local =
      getLocalParts(
        now,
        timezone
      );

    const slot =
      `${local.date}_${local.time}`;

    /**
     * Claim slot before execution.
     */
    const claimedEmployee =
      await claimScheduledSlot({
        employeeId:
          employee._id,
        slot,
      });

    /**
     * Another scheduler already
     * claimed this employee.
     */
    if (!claimedEmployee) {
      return;
    }

    console.log(
      `🤖 [SCHEDULER] Starting employee: ${employee.name}`
    );

    console.log(
      `   Employee ID: ${employee._id}`
    );

    console.log(
      `   Local time: ${local.date} ${local.time}`
    );

    /**
     * Actual employee execution.
     */
    const execution =
      await runEmployee(
        employee._id.toString(),
        employee.userId.toString(),
        {
          source: "scheduler",

          scheduledAt:
            new Date().toISOString(),

          scheduledSlot: slot,
        }
      );

    console.log(
      `✅ [SCHEDULER] Employee completed: ${employee.name}`
    );

    return execution;
  } catch (error) {
    console.error(
      `❌ [SCHEDULER] Employee failed: ${employee.name}`,
      error
    );
  }
};

/**
 * Check all automatic employees.
 */
const checkScheduledEmployees =
  async () => {
    if (schedulerRunning) {
      return;
    }

    schedulerRunning = true;

    try {
      const now = new Date();

      const employees =
        await Employee.find({
          status: {
            $in: [
              "TRIAL",
              "ACTIVE",
            ],
          },

          "schedule.triggerMode":
            "AUTOMATIC",
        })
          .select(
            "_id userId name status schedule"
          )
          .lean();

      if (!employees.length) {
        return;
      }

      for (const employee of employees) {
        try {
          if (
            !shouldEmployeeRunNow(
              employee,
              now
            )
          ) {
            continue;
          }

          await processEmployee(
            employee,
            now
          );
        } catch (error) {
          console.error(
            `Scheduler employee error: ${employee._id}`,
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "❌ Employee scheduler error:",
        error
      );
    } finally {
      schedulerRunning = false;
    }
  };

/**
 * Start scheduler.
 */
const startEmployeeScheduler = () => {
  if (schedulerInterval) {
    console.log(
      "⚠️ Employee scheduler already running"
    );

    return;
  }

  console.log(
    "🚀 Employee scheduler started"
  );

  /**
   * Run immediately once after
   * server startup.
   */
  checkScheduledEmployees();

  /**
   * Then check every 30 seconds.
   */
  schedulerInterval =
    setInterval(
      checkScheduledEmployees,
      SCHEDULER_INTERVAL
    );
};

/**
 * Stop scheduler.
 */
const stopEmployeeScheduler = () => {
  if (!schedulerInterval) {
    return;
  }

  clearInterval(
    schedulerInterval
  );

  schedulerInterval = null;

  console.log(
    "🛑 Employee scheduler stopped"
  );
};

module.exports = {
  startEmployeeScheduler,
  stopEmployeeScheduler,
  checkScheduledEmployees,
};