const mongoose = require("mongoose");
const User = require("../models/User");
const {isTestAccount} = require("../utils/testAccount");
const Employee = require("../models/Employee");
const Account = require("../models/Account");
const AgentTemplate = require("../models/AgentTemplate");
const EmployeeTrialUsage = require("../models/EmployeeTrialUsage");
const Connection = require("../models/Connection.js");

const {
  createEmployeeStorage,
    moveCharacterReferenceToEmployee,
    renameEmployeeStorageFolder
} = require("../services/googleDriveService");
const EMPLOYEE_TRIAL_DAYS = 2;
const EMPLOYEE_TRIAL_MAX_OUTPUTS = 3;

const VALID_WEEK_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

/* ============================================================
   HELPERS
============================================================ */

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const normalizeWorkingDays = (value) => {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((day) =>
            String(day).trim().toLowerCase()
          )
          .filter((day) =>
            VALID_WEEK_DAYS.includes(day)
          )
      ),
    ];
  }

  if (typeof value === "string") {
    switch (value) {
      case "sunday_off":
        return [
          "mon",
          "tue",
          "wed",
          "thu",
          "fri",
          "sat",
        ];

      case "weekend_off":
        return [
          "mon",
          "tue",
          "wed",
          "thu",
          "fri",
        ];

      case "30_days":
        return [
          "mon",
          "tue",
          "wed",
          "thu",
          "fri",
          "sat",
          "sun",
        ];

      default:
        return [];
    }
  }

  return [];
};

const calculateMonthlyWorkingDays = (
  workload = {}
) => {
  if (
    workload.monthlyWorkingDays !==
    undefined
  ) {
    const value = Number(
      workload.monthlyWorkingDays
    );

    if (
      Number.isFinite(value) &&
      value > 0 &&
      value <= 31
    ) {
      return Math.round(value);
    }
  }

  if (
    Array.isArray(workload.workingDays)
  ) {
    const count =
      normalizeWorkingDays(
        workload.workingDays
      ).length;

    if (count === 7) return 30;
    if (count === 6) return 26;
    if (count === 5) return 22;

    if (count > 0) {
      return Math.round(
        (count / 7) * 30
      );
    }
  }

  switch (workload.workingDays) {
    case "sunday_off":
      return 26;

    case "weekend_off":
      return 22;

    case "30_days":
    default:
      return 30;
  }
};

const calculateMonthlyOutput = ({
  dailyOutput,
  monthlyWorkingDays,
}) => {
  const daily = Number(
    dailyOutput || 1
  );

  if (
    !Number.isFinite(daily) ||
    daily <= 0
  ) {
    throw new Error(
      "dailyOutput must be greater than 0"
    );
  }

  return Math.round(
    daily * monthlyWorkingDays
  );
};

const calculateEmployeeSalary = ({
  agentTemplate,
  monthlyOutput,
}) => {
  const baseRate = Number(
    agentTemplate?.salaryConfig?.baseRate
  );

  if (
    !Number.isFinite(baseRate) ||
    baseRate < 0
  ) {
    throw new Error(
      "Agent template does not have a valid salary baseRate"
    );
  }

  return Math.max(
    0,
    Math.round(
      baseRate * monthlyOutput
    )
  );
};

const isValidTime = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(
    value
  );
};

/* ============================================================
   SCHEDULE
============================================================ */

const normalizeScheduleExceptions = (
  exceptions
) => {
  if (!Array.isArray(exceptions)) {
    return [];
  }

  return exceptions.map((item) => ({
    date: item.date,
    type: item.type,
    reason:
      typeof item.reason === "string"
        ? item.reason.trim()
        : "",
  }));
};

const validateSchedule = (schedule) => {
  if (
    !schedule ||
    typeof schedule !== "object" ||
    Array.isArray(schedule)
  ) {
    return {
      valid: false,
      message: "Invalid schedule",
    };
  }

  // ============================================================
  // TRIGGER MODE
  // ============================================================

  const triggerMode =
    schedule.triggerMode || "MANUAL";

  if (
    !["MANUAL", "AUTOMATIC"].includes(triggerMode)
  ) {
    return {
      valid: false,
      message: "Invalid schedule trigger mode",
    };
  }

  // ============================================================
  // START DATE
  // ============================================================

  const startDate = schedule.startDate
    ? new Date(schedule.startDate)
    : new Date();

  if (Number.isNaN(startDate.getTime())) {
    return {
      valid: false,
      message: "Invalid schedule start date.",
    };
  }

  // ============================================================
  // END DATE
  // ============================================================

  let endDate = null;

  if (schedule.endDate) {
    endDate = new Date(schedule.endDate);

    if (Number.isNaN(endDate.getTime())) {
      return {
        valid: false,
        message: "Invalid schedule end date.",
      };
    }

    if (endDate < startDate) {
      return {
        valid: false,
        message:
          "Schedule end date cannot be before start date.",
      };
    }
  }

  // ============================================================
  // WEEKLY
  // ============================================================

  const weekly =
    schedule.weekly || {};

  const workingDays =
    normalizeWorkingDays(
      weekly.workingDays || []
    );

  // ============================================================
  // AUTOMATIC VALIDATION
  // ============================================================

  if (triggerMode === "AUTOMATIC") {
    if (!workingDays.length) {
      return {
        valid: false,
        message:
          "Select at least one working day.",
      };
    }

    if (!isValidTime(weekly.time)) {
      return {
        valid: false,
        message:
          "Schedule time must be in HH:mm format.",
      };
    }
  }

  // ============================================================
  // TIME VALIDATION
  // ============================================================

  if (
    weekly.time !== undefined &&
    !isValidTime(weekly.time)
  ) {
    return {
      valid: false,
      message:
        "Schedule time must be in HH:mm format.",
    };
  }

  // ============================================================
  // TIMEZONE VALIDATION
  // ============================================================

  if (
    weekly.timezone !== undefined &&
    typeof weekly.timezone !== "string"
  ) {
    return {
      valid: false,
      message:
        "Invalid schedule timezone.",
    };
  }

  // ============================================================
  // EXCEPTIONS
  // ============================================================

  if (
    schedule.exceptions !== undefined &&
    !Array.isArray(schedule.exceptions)
  ) {
    return {
      valid: false,
      message:
        "Schedule exceptions must be an array.",
    };
  }

  const exceptions =
    schedule.exceptions || [];

  for (const exception of exceptions) {
    if (
      !exception ||
      !exception.date
    ) {
      return {
        valid: false,
        message:
          "Schedule exception date is required.",
      };
    }

    const date = new Date(
      exception.date
    );

    if (Number.isNaN(date.getTime())) {
      return {
        valid: false,
        message:
          "Invalid schedule exception date.",
      };
    }

    if (
      !["HOLIDAY", "WORK"].includes(
        exception.type
      )
    ) {
      return {
        valid: false,
        message:
          "Schedule exception type must be HOLIDAY or WORK.",
      };
    }

    if (
      exception.reason !== undefined &&
      typeof exception.reason !== "string"
    ) {
      return {
        valid: false,
        message:
          "Schedule exception reason must be text.",
      };
    }
  }

  // ============================================================
  // FINAL NORMALIZED SCHEDULE
  // ============================================================

  return {
    valid: true,

    schedule: {
      triggerMode,

      startDate,

      endDate,

      weekly: {
        workingDays,

        time:
          weekly.time || "10:00",

        timezone:
          weekly.timezone ||
          "Asia/Kolkata",
      },

      exceptions:
        normalizeScheduleExceptions(
          exceptions
        ),
    },
  };
};
const buildInitialSchedule = ({ body }) => {
  const workload =
    body.workload || {};

  const requestedSchedule =
    body.schedule || {};

  const requestedWeekly =
    requestedSchedule.weekly || {};

  // ============================================================
  // WORKING DAYS
  // ============================================================

  let scheduleDays =
    requestedWeekly.workingDays;

  if (
    scheduleDays === undefined
  ) {
    scheduleDays =
      workload.workingDays;
  }

  // ============================================================
  // START DATE
  // ============================================================

  const startDate =
    requestedSchedule.startDate
      ? new Date(
          requestedSchedule.startDate
        )
      : new Date();

  if (
    Number.isNaN(
      startDate.getTime()
    )
  ) {
    throw new Error(
      "Invalid schedule start date."
    );
  }

  // ============================================================
  // END DATE
  // ============================================================

  let endDate = null;

  if (
    requestedSchedule.endDate
  ) {
    endDate =
      new Date(
        requestedSchedule.endDate
      );

    if (
      Number.isNaN(
        endDate.getTime()
      )
    ) {
      throw new Error(
        "Invalid schedule end date."
      );
    }

    if (
      endDate < startDate
    ) {
      throw new Error(
        "Schedule end date cannot be before start date."
      );
    }
  } else {
    // ----------------------------------------------------------
    // DEFAULT = 1 MONTH
    // Example:
    // 20 Feb -> 19 Mar
    // ----------------------------------------------------------

    endDate =
      new Date(startDate);

    endDate.setMonth(
      endDate.getMonth() + 1
    );

    endDate.setDate(
      endDate.getDate() - 1
    );
  }

  // ============================================================
  // BUILD SCHEDULE
  // ============================================================

  const schedule = {
    triggerMode:
      requestedSchedule.triggerMode ||
      "MANUAL",

    startDate,

    endDate,

    weekly: {
      workingDays:
        normalizeWorkingDays(
          scheduleDays
        ),

      time:
        requestedWeekly.time ||
        workload.preferredTime ||
        "10:00",

      timezone:
        requestedWeekly.timezone ||
        workload.timezone ||
        "Asia/Kolkata",
    },

    exceptions:
      requestedSchedule.exceptions ||
      [],
  };

  // ============================================================
  // VALIDATE
  // ============================================================

  const validation =
    validateSchedule(
      schedule
    );

  if (!validation.valid) {
    throw new Error(
      validation.message
    );
  }

  return validation.schedule;
};

/* ============================================================
   WORKFLOW HELPERS
============================================================ */

/**
 * IMPORTANT:
 *
 * Template workflow is the master workflow.
 *
 * User can configure only:
 *
 * 1. Trigger node
 * 2. Instagram connection node
 *
 * Other nodes remain template controlled.
 */

/**
 * Detect trigger node.
 */
const isTriggerNode = (node) => {
  if (!node) return false;

  return [
    "trigger",
    "Trigger",
  ].includes(node.type);
};

/**
 * Detect Instagram node.
 */
const isInstagramNode = (node) => {
  if (!node) return false;

  return [
    "instagram",
    "Instagram",
  ].includes(node.type);
};

/**
 * Clone template workflow safely.
 */
const cloneTemplateWorkflow = (
  agentTemplate
) => {
  const templateNodes =
    Array.isArray(
      agentTemplate.workflow?.nodes
    )
      ? agentTemplate.workflow.nodes
      : [];

  const templateEdges =
    Array.isArray(
      agentTemplate.workflow?.edges
    )
      ? agentTemplate.workflow.edges
      : [];

  const nodes =
    JSON.parse(
      JSON.stringify(templateNodes)
    );

  const edges =
    JSON.parse(
      JSON.stringify(templateEdges)
    );

  return {
    nodes,
    edges,
  };
};

/**
 * Apply user-controlled configuration
 * to template workflow.
 */
const configureEmployeeWorkflow = ({
  workflow,
  schedule,
  instagramConnectionId,
}) => {
  const nodes =
    Array.isArray(workflow.nodes)
      ? workflow.nodes
      : [];

  // ============================================================
  // CONFIGURE NODES
  // ============================================================

  for (const node of nodes) {

    // ==========================================================
    // TRIGGER NODE
    // ==========================================================

    if (isTriggerNode(node)) {
      node.config =
        node.config || {};

      // --------------------------------------------------------
      // Trigger mode
      // --------------------------------------------------------

      node.config.triggerMode =
        schedule.triggerMode;

      // --------------------------------------------------------
      // Complete schedule configuration
      // --------------------------------------------------------

      node.config.schedule = {

        startDate:
          schedule.startDate,

        endDate:
          schedule.endDate,

        weekly: {
          workingDays:
            schedule.weekly
              .workingDays,

          time:
            schedule.weekly.time,

          timezone:
            schedule.weekly
              .timezone,
        },

        exceptions:
          schedule.exceptions || [],
      };

      // --------------------------------------------------------
      // User configurable
      // --------------------------------------------------------

      node.config.userConfigurable =
        true;
    }

    // ==========================================================
    // INSTAGRAM NODE
    // ==========================================================

    if (isInstagramNode(node)) {

      node.config =
        node.config || {};

      node.config.connectionId =
        instagramConnectionId ||
        null;

      node.config.instagramConnectionId =
        instagramConnectionId ||
        null;

      node.config.userConfigurable =
        true;
    }

    // ==========================================================
    // INTERNAL NODES
    // ==========================================================

    if (
      !isTriggerNode(node) &&
      !isInstagramNode(node)
    ) {
      node.config =
        node.config || {};

      node.config.userConfigurable =
        false;

      node.config.templateControlled =
        true;
    }
  }

  // ============================================================
  // RETURN
  // ============================================================

  return {
    nodes,

    edges:
      workflow.edges || [],
  };
};
/* ============================================================
   CHARACTER VALIDATION
============================================================ */

const validateCharacterOwnership = async ({
  characterId,
  userId,
  session,
}) => {
  if (!characterId) {
    return null;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      characterId
    )
  ) {
    throw new Error(
      "INVALID_CHARACTER_ID"
    );
  }

  /**
   * Character model is intentionally
   * loaded dynamically so this controller
   * does not break if Character is not
   * imported elsewhere.
   */
  const Character =
    mongoose.models.Character;

  if (!Character) {
    throw new Error(
      "CHARACTER_MODEL_NOT_REGISTERED"
    );
  }

  const character =
    await Character.findOne({
      _id: characterId,
      userId,
    }).session(session);

  if (!character) {
    throw new Error(
      "CHARACTER_NOT_FOUND"
    );
  }

  return character._id;
};

/* ============================================================
   BUILD EMPLOYEE
============================================================ */

const buildEmployeeData = ({
  userId,
  accountId,
  agentTemplate,
  body,
  monthlyWorkingDays,
  monthlyOutput,
  salary,
  workflow,
  schedule,
  characterId,
  instagramConnectionId,
  privilegedAccount,
}) => {
  const employee = {
    userId,

    accountId,

    agentTemplateId:
      agentTemplate._id,

    name:
      typeof body.name === "string" &&
      body.name.trim()
        ? body.name.trim()
        : agentTemplate.name,

    description:
      typeof body.description ===
      "string"
        ? body.description.trim()
        : agentTemplate.description ||
          "",

    type:
      agentTemplate.type,

status:
  privilegedAccount
    ? "ACTIVE"
    : "TRIAL",

    /* ========================================================
       TRIAL
    ======================================================== */

  trial: {
  isActive:
    !privilegedAccount,

  startDate:
    privilegedAccount
      ? null
      : new Date(),

  endDate:
    null,

  used:
    !privilegedAccount,
},

    /* ========================================================
       IDENTITY
    ======================================================== */

    identity: {
      role:
        body.identity?.role ||
        agentTemplate.identity?.role ||
        "",

      personality:
        body.identity?.personality ||
        agentTemplate.identity
          ?.defaultPersonality ||
        "",

      tone:
        body.identity?.tone ||
        agentTemplate.identity
          ?.defaultTone ||
        "",

      language:
        body.identity?.language ||
        agentTemplate.identity
          ?.defaultLanguage ||
        "en",
    },

    /* ========================================================
       INSTRUCTIONS
    ======================================================== */

    instructions: {
      objective:
        body.instructions?.objective ||
        "",

      customInstructions:
        body.instructions
          ?.customInstructions ||
        "",

      audience:
        body.instructions?.audience ||
        "",

      style:
        body.instructions?.style ||
        "",

      thingsToAvoid:
        body.instructions
          ?.thingsToAvoid ||
        "",

      callToAction:
        body.instructions
          ?.callToAction ||
        "",
    },

    /* ========================================================
       CONTENT
    ======================================================== */

    content: {
      niche:
        body.content?.niche ||
        "",

      topics:
        Array.isArray(
          body.content?.topics
        )
          ? body.content.topics
          : [],

      duration:
        body.content?.duration ||
        agentTemplate.defaultConfig
          ?.duration ||
        60,

      aspectRatio:
        body.content?.aspectRatio ||
        agentTemplate.defaultConfig
          ?.aspectRatio ||
        "9:16",

      outputFormat:
        body.content?.outputFormat ||
        agentTemplate.defaultConfig
          ?.outputFormat ||
        "reel",
    },

    /* ========================================================
       CHARACTER
    ======================================================== */

    characterId:
      characterId || null,

    /* ========================================================
       SKILLS
    ======================================================== */

    skills: {
      scriptWriting:
        agentTemplate.capabilities
          ?.scriptWriting || false,

      storytelling:
        agentTemplate.capabilities
          ?.storytelling || false,

      imageGeneration:
        agentTemplate.capabilities
          ?.imageGeneration || false,

      videoGeneration:
        agentTemplate.capabilities
          ?.videoGeneration || false,

      voiceGeneration:
        agentTemplate.capabilities
          ?.voiceGeneration || false,

      captions:
        agentTemplate.capabilities
          ?.captions || false,

      music:
        agentTemplate.capabilities
          ?.music || false,

      editing:
        agentTemplate.capabilities
          ?.editing || false,

      publishing:
        agentTemplate.capabilities
          ?.publishing || false,
    },

    /* ========================================================
       CONTRACT
    ======================================================== */

    workload: {
      workingDays:
        normalizeWorkingDays(
          body.workload?.workingDays
        ),

      dailyOutput:
        Number(
          body.workload?.dailyOutput ||
            1
        ),

      monthlyWorkingDays,

      monthlyOutput,

      preferredTime:
        body.workload?.preferredTime ||
        "19:00",

      timezone:
        body.workload?.timezone ||
        "Asia/Kolkata",
    },

    /* ========================================================
       SCHEDULE
    ======================================================== */

    schedule,

    /* ========================================================
       CONNECTION
    ======================================================== */

    connections: {
      instagramConnectionId:
        instagramConnectionId ||
        null,
    },

    /* ========================================================
       BILLING
    ======================================================== */

billing: {
  salary,

  currency:
    agentTemplate.salaryConfig?.currency ||
    "INR",

  cycle:
    agentTemplate.salaryConfig?.billingCycle ||
    "MONTHLY",

  status:
    privilegedAccount
      ? "ACTIVE"
      : "TRIAL",

  currentPeriodStart:
    new Date(),

  currentPeriodEnd:
    null,

  nextPaymentDate:
    null,

  lastPaymentDate:
    null,
},
    /* ========================================================
       TEMPLATE WORKFLOW
    ======================================================== */

    workflow: {
      nodes:
        workflow.nodes,

      edges:
        workflow.edges,

      version:
        agentTemplate.version || 1,

      customized:
        false,
    },

    /* ========================================================
       USAGE
    ======================================================== */

    usage: {
      monthlyOutputUsed: 0,

      totalOutputs: 0,

      successfulOutputs: 0,

      failedOutputs: 0,
    },
  };

  return employee;
};

/* ============================================================
   HIRE EMPLOYEE
============================================================ */

const hireEmployee = async (
  req,
  res
) => {
  const session =
    await mongoose.startSession();

  try {
    const userId =
      req.user?.userId;


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

      const testAccount =
  await isTestAccount(userId);

  const user =
  await User.findById(userId).select(
    "accountType"
  );

const isVIP =
  user?.accountType === "VIP";

const privilegedAccount =
  testAccount || isVIP;

    const {
      type,
      agentTemplateId,
    } = req.body;

    if (
      !type &&
      !agentTemplateId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "type or agentTemplateId is required",
      });
    }

    if (
      agentTemplateId &&
      !mongoose.Types.ObjectId.isValid(
        agentTemplateId
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid agentTemplateId",
      });
    }

    let createdEmployee = null;

    await session.withTransaction(
      async () => {
        /* ====================================================
           ACCOUNT
        ==================================================== */

        const account =
          await Account.findOne({
            userId,
          }).session(session);

        if (!account) {
          throw new Error(
            "ACCOUNT_NOT_FOUND"
          );
        }

        /* ====================================================
           ACCOUNT STATUS
        ==================================================== */

if (
  !privilegedAccount &&
  account.status === "TRIAL" &&
  account.trial?.isActive &&
  account.trial?.endDate &&
  new Date(account.trial.endDate) <= new Date()
) {
          throw new Error(
            "ACCOUNT_NOT_ACTIVE"
          );
        }

        /* ====================================================
           ACCOUNT TRIAL
        ==================================================== */
if (
  !privilegedAccount &&
  account.status === "TRIAL" &&
  account.trial?.isActive &&
  account.trial?.endDate &&
  new Date(account.trial.endDate) <= new Date()
) {
  account.status = "EXPIRED";
  account.trial.isActive = false;

  await account.save({
    session,
  });

  throw new Error(
    "ACCOUNT_TRIAL_EXPIRED"
  );
}

        /* ====================================================
           TEMPLATE
        ==================================================== */

        let agentTemplate = null;

        if (agentTemplateId) {
          agentTemplate =
            await AgentTemplate.findOne(
              {
                _id:
                  agentTemplateId,

                status:
                  "ACTIVE",

                isPublic:
                  true,
              }
            ).session(session);
        }

        if (
          !agentTemplate &&
          type
        ) {
          agentTemplate =
            await AgentTemplate.findOne(
              {
                type:
                  String(type).trim(),

                status:
                  "ACTIVE",

                isPublic:
                  true,
              }
            ).session(session);
        }

        if (!agentTemplate) {
          throw new Error(
            "AGENT_TEMPLATE_NOT_FOUND"
          );
        }

        /* ====================================================
           EMPLOYEE LIMIT
        ==================================================== */
const isUnlimitedAccount =
  account.limits?.unlimited === true;

if (
  !isUnlimitedAccount &&
  !privilegedAccount
) {
  const activeEmployeeCount =
    await Employee.countDocuments({
      userId,

      status: {
        $nin: [
          "CANCELLED",
          "EXPIRED",
        ],
      },
    }).session(session);

  const maxEmployees =
    Number(
      account.limits?.maxEmployees || 1
    );

  if (
    activeEmployeeCount >=
    maxEmployees
  ) {
    throw new Error(
      "EMPLOYEE_LIMIT_REACHED"
    );
  }
}

        /* ====================================================
           TRIAL CHECK
        ==================================================== */

const existingTrial =
  await EmployeeTrialUsage.findOne({
    userId,
    agentTemplateId:
      agentTemplate._id,
  }).session(session);

if (
  existingTrial &&
  !privilegedAccount
) {
  throw new Error(
    "EMPLOYEE_TRIAL_ALREADY_USED"
  );
}

        /* ====================================================
           INSTAGRAM CONNECTION
        ==================================================== */

        const requestedInstagramConnectionId =
          req.body.connections
            ?.instagramConnectionId;

        if (
          requestedInstagramConnectionId &&
          !mongoose.Types.ObjectId.isValid(
            requestedInstagramConnectionId
          )
        ) {
          throw new Error(
            "INVALID_CONNECTION_ID"
          );
        }

        let instagramConnection =
          null;

        if (
          requestedInstagramConnectionId
        ) {
          instagramConnection =
            await Connection.findOne(
              {
                _id:
                  requestedInstagramConnectionId,

                userId,

                platform:
                  "INSTAGRAM",

                status:
                  "CONNECTED",
              }
            ).session(session);

          if (
            !instagramConnection
          ) {
            throw new Error(
              "CONNECTION_NOT_FOUND"
            );
          }
        }

        /* ====================================================
           CHARACTER
        ==================================================== */

        const characterId =
          await validateCharacterOwnership(
            {
              characterId:
                req.body.characterId,

              userId,

              session,
            }
          );

        /* ====================================================
           CONTRACT
        ==================================================== */

        const workload =
          req.body.workload || {};

        const monthlyWorkingDays =
          calculateMonthlyWorkingDays(
            workload
          );

        const dailyOutput =
          Number(
            workload.dailyOutput || 1
          );

        const monthlyOutput =
          calculateMonthlyOutput({
            dailyOutput,

            monthlyWorkingDays,
          });

        const salary =
          calculateEmployeeSalary({
            agentTemplate,

            monthlyOutput,
          });

        /* ====================================================
           SCHEDULE
        ==================================================== */

        const schedule =
          buildInitialSchedule({
            body: req.body,
          });

        /* ====================================================
           TEMPLATE WORKFLOW
        ==================================================== */

        const templateWorkflow =
          cloneTemplateWorkflow(
            agentTemplate
          );

        /**
         * User-specific configuration
         * is injected only into allowed
         * nodes.
         */

        const configuredWorkflow =
          configureEmployeeWorkflow({
            workflow:
              templateWorkflow,

            schedule,

            instagramConnectionId:
              instagramConnection
                ? instagramConnection._id
                : null,
          });

        /* ====================================================
           TRIAL DATES
        ==================================================== */

const trialStart =
  new Date();

let trialEnd = privilegedAccount
  ? addDays(
      trialStart,
      3650
    )
  : addDays(
      trialStart,
      EMPLOYEE_TRIAL_DAYS
    );

if (
 !privilegedAccount &&
  account.status === "TRIAL" &&
  account.trial?.endDate
) {
  const accountTrialEnd =
    new Date(
      account.trial.endDate
    );

  if (
    trialEnd >
    accountTrialEnd
  ) {
    trialEnd =
      accountTrialEnd;
  }
}

        if (
          trialEnd <= trialStart
        ) {
          throw new Error(
            "EMPLOYEE_TRIAL_NOT_AVAILABLE"
          );
        }

        /* ====================================================
           BUILD EMPLOYEE
        ==================================================== */

        const employeeData =
          buildEmployeeData({
            userId,

            accountId:
              account._id,

            agentTemplate,

            body:
              req.body,

            monthlyWorkingDays,

            monthlyOutput,

            salary,

            workflow:
              configuredWorkflow,

            schedule,

            characterId,

            instagramConnectionId:
              instagramConnection
                ? instagramConnection._id
                : null,
                 privilegedAccount,
          });

if (!privilegedAccount) {
  employeeData.trial.startDate =
    trialStart;

  employeeData.trial.endDate =
    trialEnd;

  employeeData.billing.currentPeriodStart =
    trialStart;

  employeeData.billing.currentPeriodEnd =
    trialEnd;

  employeeData.billing.nextPaymentDate =
    trialEnd;
}

        /* ====================================================
           CREATE EMPLOYEE
        ==================================================== */

        const employees =
          await Employee.create(
            [employeeData],
            {
              session,
            }
          );

        createdEmployee =
          employees[0];

        /* ====================================================
           CREATE TRIAL USAGE
        ==================================================== */
if (!privilegedAccount) {
  await EmployeeTrialUsage.create(
    [
      {
        userId,

        accountId:
          account._id,

        agentTemplateId:
          agentTemplate._id,

        employeeId:
          createdEmployee._id,

        status:
          "ACTIVE",

        startDate:
          trialStart,

        endDate:
          trialEnd,

        maxOutputs:
          EMPLOYEE_TRIAL_MAX_OUTPUTS,

        outputsUsed: 0,

        used: true,

        completedAt: null,
      },
    ],
    {
      session,
    }
  );
}
        }
    );

    // ====================================================
    // GOOGLE DRIVE STORAGE
    // ====================================================

if (createdEmployee) {
  try {
    // ========================================================
    // CREATE EMPLOYEE DRIVE STORAGE
    // ========================================================

    const storage =
      await createEmployeeStorage({
        userId,

        employeeId:
          createdEmployee._id,

        employeeName:
          createdEmployee.name,

        employeeType:
          createdEmployee.type,
      });

    createdEmployee.storage =
      storage;

    await createdEmployee.save();

    // ========================================================
    // CHARACTER REFERENCE
    // ========================================================

    if (
      createdEmployee.characterId &&
      storage?.folders?.references
    ) {
      const Character =
        mongoose.models.Character;

      if (Character) {
        const character =
          await Character.findOne({
            _id:
              createdEmployee.characterId,

            userId,
          });

        if (
          character &&
          character.referenceImage
            ?.driveFileId
        ) {
          const movedReference =
            await moveCharacterReferenceToEmployee({
              userId,

              characterFileId:
                character.referenceImage
                  .driveFileId,

              characterName:
                character.name,

              characterId:
                character._id,

              referencesFolderId:
                storage.folders
                  .references,
            });

          // Save employee-specific
          // Drive folder information
          character.referenceImage
            .driveFolderId =
              movedReference.folderId;

          await character.save();
        }
      }
    }

  } catch (driveError) {
    console.error(
      "Google Drive storage setup failed:",
      driveError
    );

    createdEmployee.storage =
      createdEmployee.storage || {};

    createdEmployee.storage.status =
      "ERROR";

    await createdEmployee.save();
  }
}

    return res.status(201).json({
      success: true,

      message:
        "AI Employee hired successfully. Your 2-day trial has started.",

      employee: {
        id:
          createdEmployee._id,

        name:
          createdEmployee.name,

        type:
          createdEmployee.type,

        status:
          createdEmployee.status,

        agentTemplateId:
          createdEmployee
            .agentTemplateId,

        salary:
          createdEmployee.billing
            .salary,

        currency:
          createdEmployee.billing
            .currency,

        trial: {
          isActive:
            createdEmployee.trial
              .isActive,

          startDate:
            createdEmployee.trial
              .startDate,

          endDate:
            createdEmployee.trial
              .endDate,

          maxOutputs:
            EMPLOYEE_TRIAL_MAX_OUTPUTS,

          outputsUsed: 0,

          outputsRemaining:
            EMPLOYEE_TRIAL_MAX_OUTPUTS,
        },

        workload: {
          workingDays:
            createdEmployee
              .workload
              .workingDays,

          dailyOutput:
            createdEmployee
              .workload
              .dailyOutput,

          monthlyWorkingDays:
            createdEmployee
              .workload
              .monthlyWorkingDays,

          monthlyOutput:
            createdEmployee
              .workload
              .monthlyOutput,
        },

        schedule:
          createdEmployee.schedule,

        connections:
          createdEmployee
            .connections,

        workflow:
          createdEmployee.workflow,

        billing: {
          status:
            createdEmployee.billing
              .status,

          currentPeriodStart:
            createdEmployee.billing
              .currentPeriodStart,

          currentPeriodEnd:
            createdEmployee.billing
              .currentPeriodEnd,

          nextPaymentDate:
            createdEmployee.billing
              .nextPaymentDate,
        },
      },
    });
  } catch (error) {
    console.error(
      "Hire Employee Error:",
      error
    );

    const errorMap = {
      ACCOUNT_NOT_FOUND: {
        status: 404,
        message:
          "Account not found",
      },

      ACCOUNT_NOT_ACTIVE: {
        status: 403,
        message:
          "Your account is not active",
      },

      ACCOUNT_TRIAL_EXPIRED: {
        status: 403,
        message:
          "Your account trial has expired",
      },

      AGENT_TEMPLATE_NOT_FOUND: {
        status: 404,
        message:
          "AI Employee template not found or inactive",
      },

      EMPLOYEE_LIMIT_REACHED: {
        status: 403,
        message:
          "You have reached your maximum employee limit",
      },

      EMPLOYEE_TRIAL_ALREADY_USED: {
        status: 403,
        message:
          "You have already used the free trial for this AI Employee",
      },

      EMPLOYEE_TRIAL_NOT_AVAILABLE: {
        status: 403,
        message:
          "Employee trial is not available",
      },

      INVALID_CONNECTION_ID: {
        status: 400,
        message:
          "Invalid Instagram connection ID",
      },

      CONNECTION_NOT_FOUND: {
        status: 400,
        message:
          "Instagram connection not found or not connected",
      },

      INVALID_CHARACTER_ID: {
        status: 400,
        message:
          "Invalid character ID",
      },

      CHARACTER_NOT_FOUND: {
        status: 403,
        message:
          "Character not found or does not belong to you",
      },

      CHARACTER_MODEL_NOT_REGISTERED: {
        status: 500,
        message:
          "Character model is not registered",
      },
    };

    const mapped =
      errorMap[error.message];

    if (mapped) {
      return res.status(
        mapped.status
      ).json({
        success: false,
        message:
          mapped.message,
      });
    }

    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Free trial for this AI Employee has already been used",
      });
    }

    return res.status(500).json({
      success: false,

      message:
        "Failed to hire AI Employee",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  } finally {
    await session.endSession();
  }
};

/* ============================================================
   GET EMPLOYEES
============================================================ */

const getEmployees = async (
  req,
  res
) => {
  try {
    const userId =
      req.user.userId;

    const employees =
      await Employee.find({
        userId,

        status: {
          $ne: "CANCELLED",
        },
      })
        .populate(
          "agentTemplateId",
          "name slug type description category icon version"
        )
        .populate(
          "characterId",
          "name description referenceImage status"
        )
        .populate(
          "connections.instagramConnectionId",
          "username accountName profileImage platform status"
        )
        .sort({
          createdAt: -1,
        });

    return res.json({
      success: true,

      count:
        employees.length,

      employees,
    });
  } catch (error) {
    console.error(
      "Get Employees Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch employees",
    });
  }
};

/* ============================================================
   GET EMPLOYEE
============================================================ */

const getEmployeeById = async (
  req,
  res
) => {
  try {
    const userId =
      req.user.userId;

    const employeeId =
      req.params.id;

    const employee =
      await Employee.findOne({
        _id: employeeId,

        userId,
      })
        .populate(
          "agentTemplateId",
          "name slug type description category icon version capabilities defaultConfig"
        )
        .populate(
          "characterId",
          "name description referenceImage status"
        )
        .populate(
          "connections.instagramConnectionId",
          "username accountName profileImage platform status"
        );

    if (!employee) {
      return res.status(404).json({
        success: false,

        message:
          "Employee not found",
      });
    }

    return res.json({
      success: true,

      employee,
    });
  } catch (error) {
    console.error(
      "Get Employee Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch employee",
    });
  }
};

/* ============================================================
   GET BILLING
============================================================ */

const getEmployeeBilling = async (req, res) => {
  try {
    const userId = req.user.userId;
    const employeeId = req.params.id;

    const employee = await Employee.findOne({
      _id: employeeId,
      userId,
    });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }
    const user = await User.findById(userId).select("accountType");
const isVIP = user?.accountType === "VIP"; 
if (isVIP) {
  return res.json({
    success: true,
    billing: {
      status: "ACTIVE",
      isTrial: false,
      trial: {
        isActive: false,
        startDate: null,
        endDate: null,
        maxOutputs: Number.MAX_SAFE_INTEGER,
        outputsUsed: 0,
        outputsRemaining: Number.MAX_SAFE_INTEGER,
      },
    },
  });
}


    const trialUsage = await EmployeeTrialUsage.findOne({
      userId,
      agentTemplateId: employee.agentTemplateId,
    });

    const maxTrialOutputs = Number(
      trialUsage?.maxOutputs || EMPLOYEE_TRIAL_MAX_OUTPUTS
    );

    const outputsUsed = Number(
      trialUsage?.outputsUsed || 0
    );

    const outputsRemaining = Math.max(
      0,
      maxTrialOutputs - outputsUsed
    );

    const now = new Date();

    let trialRemainingMs = 0;

    if (
      employee.trial?.isActive &&
      employee.trial?.endDate
    ) {
      trialRemainingMs = Math.max(
        0,
        new Date(employee.trial.endDate).getTime() -
          now.getTime()
      );
    }

    const trialRemainingHours = Math.floor(
      trialRemainingMs / (1000 * 60 * 60)
    );

    const trialRemainingDays = Math.ceil(
      trialRemainingMs / (1000 * 60 * 60 * 24)
    );

    // Trial expiry
    if (
      employee.status === "TRIAL" &&
      employee.trial?.endDate &&
      new Date(employee.trial.endDate) <= now
    ) {
      employee.status = "PAYMENT_REQUIRED";

      employee.trial.isActive = false;

      employee.billing.status = "PENDING";

      await employee.save();

      if (
        trialUsage &&
        trialUsage.status === "ACTIVE"
      ) {
        trialUsage.status = "EXPIRED";
        trialUsage.completedAt = now;

        await trialUsage.save();
      }
    }

    return res.json({
      success: true,

      billing: {
        employeeId: employee._id,

        status: employee.status,

        salary: employee.billing?.salary || 0,

        currency: employee.billing?.currency || "INR",

        cycle: employee.billing?.cycle || "MONTHLY",

        billingStatus:
          employee.billing?.status || "NOT_STARTED",

        currentPeriodStart:
          employee.billing?.currentPeriodStart,

        currentPeriodEnd:
          employee.billing?.currentPeriodEnd,

        nextPaymentDate:
          employee.billing?.nextPaymentDate,

        lastPaymentDate:
          employee.billing?.lastPaymentDate,
      },

      trial: {
        isActive: employee.trial?.isActive || false,

        startDate: employee.trial?.startDate || null,

        endDate: employee.trial?.endDate || null,

        remainingDays: trialRemainingDays,

        remainingHours: trialRemainingHours,

        maxOutputs: maxTrialOutputs,

        outputsUsed,

        outputsRemaining,
      },

      workload: {
        workingDays: employee.workload?.workingDays,

        dailyOutput: employee.workload?.dailyOutput,

        monthlyWorkingDays:
          employee.workload?.monthlyWorkingDays,

        monthlyOutput:
          employee.workload?.monthlyOutput,
      },

      schedule: employee.schedule || null,
    });
  } catch (error) {
    console.error(
      "Get Employee Billing Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee billing",
    });
  }
};

/* ============================================================
   UPDATE EMPLOYEE
============================================================ */

const updateEmployee = async (
  req,
  res
) => {
  try {
    const userId =
      req.user.userId;

    const employeeId =
      req.params.id;

    const employee =
      await Employee.findOne({
        _id: employeeId,

        userId,
      });

    if (!employee) {
      return res.status(404).json({
        success: false,

        message:
          "Employee not found",
      });
    }

    if (
      employee.status ===
      "CANCELLED"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Cancelled employee cannot be edited",
      });
    }

    const {
      name,
      description,
      identity,
      instructions,
      content,
      characterId,
      workload,
      connections,
      schedule,
      billing,
      workflow,
      nodes,
      edges,
      skills,
      agentTemplateId,
      type,
    } = req.body;

    /* ========================================================
       BASIC
    ======================================================== */
    let employeeNameChanged = false;

if (name !== undefined) {
  const cleanName = String(name).trim();

  if (!cleanName) {
    return res.status(400).json({
      success: false,
      message: "Employee name cannot be empty",
    });
  }

  if (cleanName !== employee.name) {
    employeeNameChanged = true;
  }

  employee.name = cleanName;
}

    if (
      description !== undefined
    ) {
      employee.description =
        String(description).trim();
    }

    /* ========================================================
       IDENTITY
    ======================================================== */

    if (identity) {
      employee.identity = {
        ...(
          employee.identity
            ?.toObject?.() ||
          employee.identity ||
          {}
        ),

        ...identity,
      };
    }

    /* ========================================================
       INSTRUCTIONS
    ======================================================== */

    if (instructions) {
      employee.instructions = {
        ...(
          employee.instructions
            ?.toObject?.() ||
          employee.instructions ||
          {}
        ),

        ...instructions,
      };
    }

    /* ========================================================
       CONTENT
    ======================================================== */

    if (content) {
      employee.content = {
        ...(
          employee.content
            ?.toObject?.() ||
          employee.content ||
          {}
        ),

        ...content,
      };
    }

    /* ========================================================
       CHARACTER
    ======================================================== */

    if (
      characterId !==
      undefined
    ) {
      if (characterId === null) {
        employee.characterId =
          null;
      } else {
        const validCharacterId =
          await validateCharacterOwnership(
            {
              characterId,

              userId,
            }
          );

        employee.characterId =
          validCharacterId;
      }
    }

    /* ========================================================
       WORKLOAD LOCK
    ======================================================== */

    if (workload) {
      const lockedFields = [
        "workingDays",
        "dailyOutput",
        "monthlyWorkingDays",
        "monthlyOutput",
        "preferredTime",
        "timezone",
      ];

      const attemptedLockedFields =
        lockedFields.filter(
          (field) =>
            workload[field] !==
            undefined
        );

      if (
        attemptedLockedFields.length
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Employee contract is locked after hiring. Workload cannot be changed.",
        });
      }
    }

    /* ========================================================
       BILLING LOCK
    ======================================================== */

    if (billing !== undefined) {
      return res.status(400).json({
        success: false,

        message:
          "Employee salary and billing contract cannot be changed after hiring.",
      });
    }

    /* ========================================================
       TEMPLATE / TYPE / SKILLS LOCK
    ======================================================== */

    if (
      workflow !== undefined ||
      nodes !== undefined ||
      edges !== undefined
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Employee workflow is controlled by its template and cannot be edited.",
      });
    }

    if (skills !== undefined) {
      return res.status(400).json({
        success: false,

        message:
          "Employee skills are controlled by its template.",
      });
    }

    if (
      agentTemplateId !==
        undefined ||
      type !== undefined
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Employee template cannot be changed after hiring.",
      });
    }

    /* ========================================================
       SCHEDULE
    ======================================================== */

   /* ========================================================
   SCHEDULE
======================================================== */

if (schedule !== undefined) {

  // ==========================================================
  // CURRENT SCHEDULE
  // ==========================================================

  const currentSchedule =
    employee.schedule?.toObject?.() ||
    employee.schedule ||
    {};

  // ==========================================================
  // CURRENT WEEKLY
  // ==========================================================

  const currentWeekly =
    currentSchedule.weekly ||
    {};

  // ==========================================================
  // INCOMING WEEKLY
  // ==========================================================

  const incomingWeekly =
    schedule.weekly ||
    {};

  // ==========================================================
  // MERGE SCHEDULE
  // ==========================================================

  const mergedSchedule = {

    ...currentSchedule,

    ...schedule,

    // --------------------------------------------------------
    // START DATE
    // --------------------------------------------------------

    startDate:
      schedule.startDate !== undefined
        ? schedule.startDate
        : currentSchedule.startDate,

    // --------------------------------------------------------
    // END DATE
    // --------------------------------------------------------

    endDate:
      schedule.endDate !== undefined
        ? schedule.endDate
        : currentSchedule.endDate,

    // --------------------------------------------------------
    // WEEKLY
    // --------------------------------------------------------

    weekly: {

      ...currentWeekly,

      ...incomingWeekly,
    },

    // --------------------------------------------------------
    // EXCEPTIONS
    // --------------------------------------------------------

    exceptions:
      schedule.exceptions !== undefined
        ? schedule.exceptions
        : currentSchedule.exceptions ||
          [],
  };

  // ==========================================================
  // DEFAULT TRIGGER MODE
  // ==========================================================

  if (!mergedSchedule.triggerMode) {

    mergedSchedule.triggerMode =
      currentSchedule.triggerMode ||
      "MANUAL";
  }

  // ==========================================================
  // VALIDATE
  // ==========================================================

  const validation =
    validateSchedule(
      mergedSchedule
    );

  if (!validation.valid) {

    return res.status(400).json({
      success: false,
      message:
        validation.message,
    });
  }

  // ==========================================================
  // SAVE EMPLOYEE SCHEDULE
  // ==========================================================

  employee.schedule =
    validation.schedule;

  // ==========================================================
  // KEEP TRIGGER NODE IN SYNC
  // ==========================================================

  const nodes =
    employee.workflow?.nodes ||
    [];

  for (const node of nodes) {

    if (!isTriggerNode(node)) {
      continue;
    }

    node.config =
      node.config || {};

    // --------------------------------------------------------
    // Trigger mode
    // --------------------------------------------------------

    node.config.triggerMode =
      validation
        .schedule
        .triggerMode;

    // --------------------------------------------------------
    // Complete schedule
    // --------------------------------------------------------

    node.config.schedule = {

      startDate:
        validation
          .schedule
          .startDate,

      endDate:
        validation
          .schedule
          .endDate,

      weekly:
        validation
          .schedule
          .weekly,

      exceptions:
        validation
          .schedule
          .exceptions,
    };
  }
}

    /* ========================================================
       CONNECTION
    ======================================================== */

    if (
      connections !==
      undefined
    ) {
      const instagramConnectionId =
        connections
          ?.instagramConnectionId;

      if (
        instagramConnectionId ===
        null
      ) {
        employee.connections = {
          ...(
            employee.connections
              ?.toObject?.() ||
            employee.connections ||
            {}
          ),

          instagramConnectionId:
            null,
        };

        /**
         * Clear Instagram node.
         */

        for (const node of
          employee.workflow?.nodes ||
          []) {
          if (isInstagramNode(node)) {
            node.config =
              node.config || {};

            node.config.connectionId =
              null;

            node.config.instagramConnectionId =
              null;
          }
        }
      } else if (
        instagramConnectionId
      ) {
        if (
          !mongoose.Types.ObjectId.isValid(
            instagramConnectionId
          )
        ) {
          return res.status(400).json({
            success: false,

            message:
              "Invalid Instagram connection ID",
          });
        }

        const connection =
          await Connection.findOne({
            _id:
              instagramConnectionId,

            userId,

            platform:
              "INSTAGRAM",

            status:
              "CONNECTED",
          });

        if (!connection) {
          return res.status(400).json({
            success: false,

            message:
              "Instagram connection not found or not connected.",
          });
        }

        employee.connections = {
          ...(
            employee.connections
              ?.toObject?.() ||
            employee.connections ||
            {}
          ),

          instagramConnectionId:
            connection._id,
        };

        /**
         * Keep Instagram Node
         * synchronized.
         */

        for (const node of
          employee.workflow?.nodes ||
          []) {
          if (isInstagramNode(node)) {
            node.config =
              node.config || {};

            node.config.connectionId =
              connection._id;

            node.config.instagramConnectionId =
              connection._id;
          }
        }
      }
    }

    /* ========================================================
       CUSTOMIZED
    ======================================================== */

    employee.workflow.customized =
      true;

    employee.workflow.version =
      employee.workflow.version || 1;

    employee.customized = true;

    await employee.save();if (
  employeeNameChanged &&
  employee.storage?.rootFolderId
) {
  try {
    await renameEmployeeStorageFolder({
      userId,
      employeeFolderId:
        employee.storage.rootFolderId,
      employeeName: employee.name,
      employeeId: employee._id.toString(),
    });

    console.log(
      "✅ Google Drive employee folder renamed:",
      employee.name
    );
  } catch (driveError) {
    console.error(
      "⚠️ Google Drive folder rename failed:",
      driveError
    );
  }
}
    return res.json({
      success: true,

      message:
        "Employee updated successfully",

      employee,
    });
  } catch (error) {
    console.error(
      "Update Employee Error:",
      error
    );

    const errorMap = {
      INVALID_CHARACTER_ID: {
        status: 400,

        message:
          "Invalid character ID",
      },

      CHARACTER_NOT_FOUND: {
        status: 403,

        message:
          "Character not found or does not belong to you",
      },

      CHARACTER_MODEL_NOT_REGISTERED: {
        status: 500,

        message:
          "Character model is not registered",
      },
    };

    const mapped =
      errorMap[error.message];

    if (mapped) {
      return res.status(
        mapped.status
      ).json({
        success: false,

        message:
          mapped.message,
      });
    }

    return res.status(500).json({
      success: false,

      message:
        "Failed to update employee",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};

/* ============================================================
   PAUSE
============================================================ */

const pauseEmployee = async (
  req,
  res
) => {
  try {
    const userId =
      req.user.userId;

    const employeeId =
      req.params.id;

    const employee =
      await Employee.findOne({
        _id: employeeId,

        userId,
      });

    if (!employee) {
      return res.status(404).json({
        success: false,

        message:
          "Employee not found",
      });
    }

    if (
      employee.status !==
        "ACTIVE" &&
      employee.status !==
        "TRIAL"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Employee cannot be paused in current state",
      });
    }

    employee.status =
      "PAUSED";

    employee.billing.status =
      "PAUSED";

    await employee.save();

    return res.json({
      success: true,

      message:
        "Employee paused successfully",

      employee,
    });
  } catch (error) {
    console.error(
      "Pause Employee Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to pause employee",
    });
  }
};

/* ============================================================
   RESUME
============================================================ */

const resumeEmployee =
  async (req, res) => {
    try {
      const userId =
        req.user.userId;

      const employeeId =
        req.params.id;

      const employee =
        await Employee.findOne({
          _id: employeeId,

          userId,
        });

      if (!employee) {
        return res.status(404).json({
          success: false,

          message:
            "Employee not found",
        });
      }

      if (
        employee.status !==
        "PAUSED"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Only paused employees can be resumed",
        });
      }

      if (
        employee.billing
          ?.status !== "ACTIVE"
      ) {
        return res.status(402).json({
          success: false,

          message:
            "Employee payment is required before resuming",
        });
      }

      employee.status =
        "ACTIVE";

      await employee.save();

      return res.json({
        success: true,

        message:
          "Employee resumed successfully",

        employee,
      });
    } catch (error) {
      console.error(
        "Resume Employee Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to resume employee",
      });
    }
  };

/* ============================================================
   CANCEL
============================================================ */

const cancelEmployee =
  async (req, res) => {
    try {
      const userId =
        req.user.userId;

      const employeeId =
        req.params.id;

      const employee =
        await Employee.findOne({
          _id: employeeId,

          userId,
        });

      if (!employee) {
        return res.status(404).json({
          success: false,

          message:
            "Employee not found",
        });
      }

      if (
        employee.status ===
        "CANCELLED"
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Employee already cancelled",
        });
      }

      employee.status =
        "CANCELLED";

      employee.billing.status =
        "CANCELLED";

      employee.trial.isActive =
        false;

      await employee.save();

      /**
       * Never delete trial usage.
       *
       * This prevents the same user
       * from taking the same template
       * trial again.
       */

      await EmployeeTrialUsage.updateOne(
        {
          userId,

          agentTemplateId:
            employee.agentTemplateId,
        },

        {
          $set: {
            status:
              "COMPLETED",

            completedAt:
              new Date(),
          },
        }
      );

      return res.json({
        success: true,

        message:
          "Employee cancelled successfully",
      });
    } catch (error) {
      console.error(
        "Cancel Employee Error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to cancel employee",
      });
    }
  };

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  hireEmployee,

  getEmployees,

  getEmployeeById,

  getEmployeeBilling,

  updateEmployee,

  pauseEmployee,

  resumeEmployee,

  cancelEmployee,
};