const Employee = require("../models/Employee");
const Account = require("../models/Account");
const EmployeeTrialUsage = require("../models/EmployeeTrialUsage");
const {
  isTestAccount,
} = require("../utils/testAccount");

const EMPLOYEE_TRIAL_DAYS = 2;
const EMPLOYEE_TRIAL_MAX_OUTPUTS = 3;

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(
    result.getDate() + days
  );
  return result;
};

/* ============================================================
   START EMPLOYEE TRIAL
============================================================ */

const startEmployeeTrial = async ({
  employeeId,
  userId,
  session = null,
}) => {
  const employeeQuery =
    Employee.findOne({
      _id: employeeId,
      userId,
    });

  if (session) {
    employeeQuery.session(session);
  }

  const employee =
    await employeeQuery;

  if (!employee) {
    throw new Error(
      "EMPLOYEE_NOT_FOUND"
    );
  }

  const testAccount =
    await isTestAccount(userId);

  const accountQuery =
    Account.findOne({
      _id: employee.accountId,
      userId,
    });

  if (session) {
    accountQuery.session(session);
  }

  const account =
    await accountQuery;

  if (!account) {
    throw new Error(
      "ACCOUNT_NOT_FOUND"
    );
  }

  if (
    !testAccount &&
    account.status !== "TRIAL" &&
    account.status !== "ACTIVE"
  ) {
    throw new Error(
      "ACCOUNT_NOT_ACTIVE"
    );
  }

  const existingTrial =
    await EmployeeTrialUsage.findOne({
      userId,
      agentTemplateId:
        employee.agentTemplateId,
    });

  if (
    existingTrial &&
    !testAccount
  ) {
    throw new Error(
      "EMPLOYEE_TRIAL_ALREADY_USED"
    );
  }

  const now = new Date();

  let trialEnd = testAccount
    ? addDays(now, 3650)
    : addDays(
        now,
        EMPLOYEE_TRIAL_DAYS
      );

  if (
    !testAccount &&
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
    !testAccount &&
    trialEnd <= now
  ) {
    throw new Error(
      "EMPLOYEE_TRIAL_NOT_AVAILABLE"
    );
  }

  employee.status =
    "TRIAL";

  employee.trial.isActive =
    true;

  employee.trial.startDate =
    now;

  employee.trial.endDate =
    trialEnd;

  employee.trial.used =
    true;

  employee.billing.status =
    "TRIAL";

  employee.billing.currentPeriodStart =
    now;

  employee.billing.currentPeriodEnd =
    trialEnd;

  employee.billing.nextPaymentDate =
    trialEnd;

  await employee.save(
    session
      ? {session}
      : undefined
  );

  if (!testAccount) {
    await EmployeeTrialUsage.create(
      [
        {
          userId,

          accountId:
            employee.accountId,

          agentTemplateId:
            employee.agentTemplateId,

          employeeId:
            employee._id,

          status:
            "ACTIVE",

          startDate:
            now,

          endDate:
            trialEnd,

          maxOutputs:
            EMPLOYEE_TRIAL_MAX_OUTPUTS,

          outputsUsed: 0,

          used: true,

          completedAt: null,
        },
      ],
      session
        ? {session}
        : undefined
    );
  }

  return {
    employee,

    trial: {
      startDate: now,

      endDate:
        trialEnd,

      maxOutputs:
        testAccount
          ? Number.MAX_SAFE_INTEGER
          : EMPLOYEE_TRIAL_MAX_OUTPUTS,

      outputsUsed: 0,

      outputsRemaining:
        testAccount
          ? Number.MAX_SAFE_INTEGER
          : EMPLOYEE_TRIAL_MAX_OUTPUTS,
    },
  };
};

/* ============================================================
   GET EMPLOYEE BILLING STATE
============================================================ */

const getEmployeeBillingState =
  async ({
    employeeId,
    userId,
  }) => {
    const employee =
      await Employee.findOne({
        _id: employeeId,
        userId,
      });

    if (!employee) {
      throw new Error(
        "EMPLOYEE_NOT_FOUND"
      );
    }

    const testAccount =
      await isTestAccount(userId);

    const trialUsage =
      await EmployeeTrialUsage.findOne({
        userId,
        agentTemplateId:
          employee.agentTemplateId,
      });

    const now =
      new Date();

    const outputsUsed =
      testAccount
        ? Number(
            employee.usage
              ?.successfulOutputs || 0
          )
        : Number(
            trialUsage
              ?.outputsUsed || 0
          );

    const maxOutputs =
      testAccount
        ? Number.MAX_SAFE_INTEGER
        : Number(
            trialUsage?.maxOutputs ||
              EMPLOYEE_TRIAL_MAX_OUTPUTS
          );

    let remainingMs = 0;

    if (
      employee.trial?.endDate
    ) {
      remainingMs =
        Math.max(
          0,
          new Date(
            employee.trial.endDate
          ).getTime() -
            now.getTime()
        );
    }

    const remainingHours =
      Math.floor(
        remainingMs /
          (1000 * 60 * 60)
      );

    const remainingDays =
      Math.ceil(
        remainingMs /
          (1000 * 60 * 60 * 24)
      );

    /* ========================================================
       NORMAL USERS ONLY
    ======================================================== */

    if (
      !testAccount &&
      employee.status === "TRIAL" &&
      employee.trial?.endDate &&
      new Date(
        employee.trial.endDate
      ) <= now
    ) {
      employee.status =
        "PAYMENT_REQUIRED";

      employee.trial.isActive =
        false;

      employee.billing.status =
        "PENDING";

      await employee.save();

      if (trialUsage) {
        trialUsage.status =
          "EXPIRED";

        trialUsage.completedAt =
          now;

        await trialUsage.save();
      }
    }

    if (
      !testAccount &&
      employee.status === "TRIAL" &&
      outputsUsed >= maxOutputs
    ) {
      employee.status =
        "PAYMENT_REQUIRED";

      employee.trial.isActive =
        false;

      employee.billing.status =
        "PENDING";

      await employee.save();

      if (trialUsage) {
        trialUsage.status =
          "COMPLETED";

        trialUsage.completedAt =
          now;

        await trialUsage.save();
      }
    }

    return {
      employeeId:
        employee._id,

      status:
        employee.status,

      salary:
        employee.billing?.salary ||
        0,

      currency:
        employee.billing?.currency ||
        "INR",

      trial: {
        isActive:
          employee.trial?.isActive ||
          false,

        startDate:
          employee.trial?.startDate ||
          null,

        endDate:
          employee.trial?.endDate ||
          null,

        remainingDays:
          testAccount
            ? 3650
            : remainingDays,

        remainingHours:
          testAccount
            ? 87600
            : remainingHours,

        maxOutputs,

        outputsUsed,

        outputsRemaining:
          testAccount
            ? Number.MAX_SAFE_INTEGER
            : Math.max(
                0,
                maxOutputs -
                  outputsUsed
              ),
      },
    };
  };

/* ============================================================
   CAN EMPLOYEE RUN
============================================================ */

const canEmployeeRun =
  async ({
    employeeId,
    userId,
  }) => {
    const employee =
      await Employee.findOne({
        _id: employeeId,
        userId,
      });

    if (!employee) {
      return {
        allowed: false,
        reason:
          "EMPLOYEE_NOT_FOUND",
      };
    }

    const account =
      await Account.findOne({
        _id: employee.accountId,
        userId,
      });

    if (!account) {
      return {
        allowed: false,
        reason:
          "ACCOUNT_NOT_FOUND",
      };
    }

    const testAccount =
      await isTestAccount(userId);

    /* ========================================================
       TEST ACCOUNT
    ======================================================== */

    if (testAccount) {
      return {
        allowed: true,

        mode: "TEST",

        employeeId:
          employee._id,

        outputsUsed:
          Number(
            employee.usage
              ?.successfulOutputs || 0
          ),

        maxOutputs:
          Number.MAX_SAFE_INTEGER,

        outputsRemaining:
          Number.MAX_SAFE_INTEGER,
      };
    }

    /* ========================================================
       NORMAL ACCOUNT
    ======================================================== */

    if (
      account.status !== "TRIAL" &&
      account.status !== "ACTIVE"
    ) {
      return {
        allowed: false,

        reason:
          "ACCOUNT_NOT_ACTIVE",
      };
    }

    const now =
      new Date();

    if (
      employee.status === "TRIAL"
    ) {
      if (
        !employee.trial?.endDate ||
        new Date(
          employee.trial.endDate
        ) <= now
      ) {
        employee.status =
          "PAYMENT_REQUIRED";

        employee.trial.isActive =
          false;

        employee.billing.status =
          "PENDING";

        await employee.save();

        return {
          allowed: false,

          reason:
            "EMPLOYEE_TRIAL_EXPIRED",
        };
      }

      const trialUsage =
        await EmployeeTrialUsage.findOne({
          userId,

          agentTemplateId:
            employee.agentTemplateId,
        });

      if (!trialUsage) {
        return {
          allowed: false,

          reason:
            "TRIAL_USAGE_NOT_FOUND",
        };
      }

      if (
        trialUsage.status !==
        "ACTIVE"
      ) {
        return {
          allowed: false,

          reason:
            "EMPLOYEE_TRIAL_COMPLETED",
        };
      }

      if (
        trialUsage.outputsUsed >=
        trialUsage.maxOutputs
      ) {
        employee.status =
          "PAYMENT_REQUIRED";

        employee.trial.isActive =
          false;

        employee.billing.status =
          "PENDING";

        await employee.save();

        trialUsage.status =
          "COMPLETED";

        trialUsage.completedAt =
          now;

        await trialUsage.save();

        return {
          allowed: false,

          reason:
            "EMPLOYEE_TRIAL_OUTPUT_LIMIT_REACHED",
        };
      }

      return {
        allowed: true,

        mode: "TRIAL",

        employeeId:
          employee._id,

        trialUsageId:
          trialUsage._id,

        outputsUsed:
          trialUsage.outputsUsed,

        maxOutputs:
          trialUsage.maxOutputs,

        outputsRemaining:
          Math.max(
            0,
            trialUsage.maxOutputs -
              trialUsage.outputsUsed
          ),
      };
    }

    if (
      employee.status === "ACTIVE" &&
      employee.billing?.status ===
        "ACTIVE"
    ) {
      if (
        employee.billing
          ?.currentPeriodEnd &&
        new Date(
          employee.billing
            .currentPeriodEnd
        ) <= now
      ) {
        employee.status =
          "PAUSED";

        employee.billing.status =
          "PAST_DUE";

        await employee.save();

        return {
          allowed: false,

          reason:
            "EMPLOYEE_PAYMENT_DUE",
        };
      }

      return {
        allowed: true,

        mode: "PAID",

        employeeId:
          employee._id,
      };
    }

    return {
      allowed: false,

      reason:
        "EMPLOYEE_NOT_AVAILABLE",
    };
  };

/* ============================================================
   RECORD TRIAL OUTPUT
============================================================ */

const recordTrialOutput =
  async ({
    employeeId,
    userId,
  }) => {
    const employee =
      await Employee.findOne({
        _id: employeeId,
        userId,
      });

    if (!employee) {
      throw new Error(
        "EMPLOYEE_NOT_FOUND"
      );
    }

    const testAccount =
      await isTestAccount(userId);

    /* ========================================================
       TEST ACCOUNT
       COUNT OUTPUT BUT NEVER BLOCK
    ======================================================== */

    if (testAccount) {
      employee.usage =
        employee.usage || {};

      employee.usage.monthlyOutputUsed =
        Number(
          employee.usage
            .monthlyOutputUsed || 0
        ) + 1;

      employee.usage.totalOutputs =
        Number(
          employee.usage.totalOutputs ||
            0
        ) + 1;

      employee.usage.successfulOutputs =
        Number(
          employee.usage
            .successfulOutputs || 0
        ) + 1;

      await employee.save();

      return {
        recorded: true,

        outputsUsed:
          employee.usage
            .successfulOutputs,

        maxOutputs:
          Number.MAX_SAFE_INTEGER,

        outputsRemaining:
          Number.MAX_SAFE_INTEGER,

        trialCompleted:
          false,
      };
    }

    /* ========================================================
       NORMAL USER
    ======================================================== */

    if (
      employee.status !== "TRIAL"
    ) {
      return {
        recorded: false,

        reason:
          "NOT_IN_TRIAL",
      };
    }

    const trialUsage =
      await EmployeeTrialUsage.findOne({
        userId,

        agentTemplateId:
          employee.agentTemplateId,
      });

    if (!trialUsage) {
      throw new Error(
        "TRIAL_USAGE_NOT_FOUND"
      );
    }

    if (
      trialUsage.status !==
      "ACTIVE"
    ) {
      throw new Error(
        "EMPLOYEE_TRIAL_COMPLETED"
      );
    }

    if (
      trialUsage.outputsUsed >=
      trialUsage.maxOutputs
    ) {
      throw new Error(
        "EMPLOYEE_TRIAL_OUTPUT_LIMIT_REACHED"
      );
    }

    trialUsage.outputsUsed += 1;

    employee.usage =
      employee.usage || {};

    employee.usage.monthlyOutputUsed =
      Number(
        employee.usage
          .monthlyOutputUsed || 0
      ) + 1;

    employee.usage.totalOutputs =
      Number(
        employee.usage.totalOutputs || 0
      ) + 1;

    employee.usage.successfulOutputs =
      Number(
        employee.usage
          .successfulOutputs || 0
      ) + 1;

    if (
      trialUsage.outputsUsed >=
      trialUsage.maxOutputs
    ) {
      trialUsage.status =
        "COMPLETED";

      trialUsage.completedAt =
        new Date();

      employee.status =
        "PAYMENT_REQUIRED";

      employee.trial.isActive =
        false;

      employee.billing.status =
        "PENDING";
    }

    await trialUsage.save();
    await employee.save();

    return {
      recorded: true,

      outputsUsed:
        trialUsage.outputsUsed,

      maxOutputs:
        trialUsage.maxOutputs,

      outputsRemaining:
        Math.max(
          0,
          trialUsage.maxOutputs -
            trialUsage.outputsUsed
        ),

      trialCompleted:
        trialUsage.status ===
        "COMPLETED",
    };
  };

/* ============================================================
   RECORD FAILED OUTPUT
============================================================ */

const recordFailedOutput =
  async ({
    employeeId,
    userId,
  }) => {
    const employee =
      await Employee.findOne({
        _id: employeeId,
        userId,
      });

    if (!employee) {
      throw new Error(
        "EMPLOYEE_NOT_FOUND"
      );
    }

    employee.usage =
      employee.usage || {};

    employee.usage.failedOutputs =
      Number(
        employee.usage.failedOutputs ||
          0
      ) + 1;

    await employee.save();

    return {
      recorded: true,
    };
  };

module.exports = {
  EMPLOYEE_TRIAL_DAYS,

  EMPLOYEE_TRIAL_MAX_OUTPUTS,

  startEmployeeTrial,

  getEmployeeBillingState,

  canEmployeeRun,

  recordTrialOutput,

  recordFailedOutput,
};