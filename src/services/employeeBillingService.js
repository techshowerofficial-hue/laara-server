const Employee = require("../models/Employee");
const Account = require("../models/Account");
const EmployeeTrialUsage = require("../models/EmployeeTrialUsage");
const { isTestAccount } = require("../utils/testAccount");
const User = require("../models/User");
const EMPLOYEE_TRIAL_DAYS = 2;
const EMPLOYEE_TRIAL_MAX_OUTPUTS = 3;


/**
 * Add days
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};


/**
 * Start employee trial
 *
 * Rules:
 * - Account must be active/trial
 * - One AgentTemplate can only be trialed once
 * - Trial max 2 days
 * - Max 3 outputs
 */
const startEmployeeTrial = async ({
  employeeId,
  userId,
  session = null,
}) => {
  const employeeQuery = Employee.findOne({
    _id: employeeId,
    userId,
  });

  if (session) {
    employeeQuery.session(session);
  }

  const employee = await employeeQuery;

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  /**
   * Check existing trial usage.
   */
  const trialQuery = EmployeeTrialUsage.findOne({
    userId,
    agentTemplateId: employee.agentTemplateId,
  });

  if (session) {
    trialQuery.session(session);
  }

  const existingTrial = await trialQuery;

  if (existingTrial) {
    throw new Error("EMPLOYEE_TRIAL_ALREADY_USED");
  }

  /**
   * Account
   */
  const accountQuery = Account.findOne({
    _id: employee.accountId,
    userId,
  });

  if (session) {
    accountQuery.session(session);
  }

  const account = await accountQuery;

  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  if (
    account.status !== "TRIAL" &&
    account.status !== "ACTIVE"
  ) {
    throw new Error("ACCOUNT_NOT_ACTIVE");
  }

  const now = new Date();

  let trialEnd = addDays(
    now,
    EMPLOYEE_TRIAL_DAYS
  );

  /**
   * Employee trial cannot outlive account trial.
   */
  if (
    account.status === "TRIAL" &&
    account.trial?.endDate
  ) {
    const accountEnd =
      new Date(account.trial.endDate);

    if (trialEnd > accountEnd) {
      trialEnd = accountEnd;
    }
  }

  if (trialEnd <= now) {
    throw new Error(
      "EMPLOYEE_TRIAL_NOT_AVAILABLE"
    );
  }

  /**
   * Update employee.
   */
  employee.status = "TRIAL";

  employee.trial = {
    isActive: true,
    startDate: now,
    endDate: trialEnd,
    used: true,
  };

  employee.billing.status = "TRIAL";

  employee.billing.currentPeriodStart = now;
  employee.billing.currentPeriodEnd = trialEnd;
  employee.billing.nextPaymentDate = trialEnd;

  /**
   * Reset usage for trial.
   */
  employee.usage.monthlyOutputUsed = 0;

  if (session) {
    await employee.save({ session });
  } else {
    await employee.save();
  }

  /**
   * Create anti-abuse record.
   */
  const trialData = {
    userId,
    accountId: employee.accountId,
    agentTemplateId: employee.agentTemplateId,
    employeeId: employee._id,

    status: "ACTIVE",

    startDate: now,
    endDate: trialEnd,

    maxOutputs: EMPLOYEE_TRIAL_MAX_OUTPUTS,
    outputsUsed: 0,

    used: true,

    completedAt: null,
  };

  if (session) {
    await EmployeeTrialUsage.create(
      [trialData],
      { session }
    );
  } else {
    await EmployeeTrialUsage.create([
      trialData,
    ]);
  }

  return {
    employee,
    trial: {
      startDate: now,
      endDate: trialEnd,
      maxOutputs:
        EMPLOYEE_TRIAL_MAX_OUTPUTS,
      outputsUsed: 0,
      outputsRemaining:
        EMPLOYEE_TRIAL_MAX_OUTPUTS,
    },
  };
};


/**
 * Get current employee billing state
 */
const getEmployeeBillingState = async ({
  employeeId,
  userId,
}) => {
  const employee = await Employee.findOne({
    _id: employeeId,
    userId,
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  const now = new Date();

  /**
   * Get trial usage separately.
   */
  const trialUsage =
    await EmployeeTrialUsage.findOne({
      userId,
      agentTemplateId:
        employee.agentTemplateId,
    });

  let trialRemainingMs = 0;

  if (
    employee.trial?.isActive &&
    employee.trial?.endDate
  ) {
    trialRemainingMs = Math.max(
      0,
      new Date(
        employee.trial.endDate
      ).getTime() - now.getTime()
    );
  }

  const trialRemainingHours =
    Math.floor(
      trialRemainingMs /
        (1000 * 60 * 60)
    );

  const trialRemainingDays =
    Math.ceil(
      trialRemainingMs /
        (1000 * 60 * 60 * 24)
    );

  const outputsUsed =
    trialUsage?.outputsUsed || 0;

  const maxOutputs =
    trialUsage?.maxOutputs ||
    EMPLOYEE_TRIAL_MAX_OUTPUTS;

  const outputsRemaining =
    Math.max(
      0,
      maxOutputs - outputsUsed
    );

  /**
   * Trial expired.
   */
  if (
    employee.status === "TRIAL" &&
    employee.trial?.endDate &&
    new Date(employee.trial.endDate) <= now
  ) {
    employee.status = "PAYMENT_REQUIRED";
    employee.trial.isActive = false;
    employee.billing.status = "PENDING";

    await employee.save();

    if (trialUsage) {
      trialUsage.status = "EXPIRED";
      trialUsage.completedAt = now;

      await trialUsage.save();
    }
  }

  /**
   * Trial output limit reached.
   */
  if (
    employee.status === "TRIAL" &&
    outputsUsed >= maxOutputs
  ) {
    employee.status = "PAYMENT_REQUIRED";
    employee.trial.isActive = false;
    employee.billing.status = "PENDING";

    await employee.save();

    if (trialUsage) {
      trialUsage.status = "COMPLETED";
      trialUsage.completedAt = now;

      await trialUsage.save();
    }
  }

  return {
    employeeId: employee._id,

    status: employee.status,

    salary:
      employee.billing?.salary || 0,

    currency:
      employee.billing?.currency || "INR",

    trial: {
      isActive:
        employee.trial?.isActive || false,

      startDate:
        employee.trial?.startDate || null,

      endDate:
        employee.trial?.endDate || null,

      remainingDays:
        trialRemainingDays,

      remainingHours:
        trialRemainingHours,

      maxOutputs,

      outputsUsed,

      outputsRemaining,
    },

    billing: {
      status:
        employee.billing?.status ||
        "NOT_STARTED",

      currentPeriodStart:
        employee.billing?.currentPeriodStart,

      currentPeriodEnd:
        employee.billing?.currentPeriodEnd,

      nextPaymentDate:
        employee.billing?.nextPaymentDate,

      lastPaymentDate:
        employee.billing?.lastPaymentDate,
    },

    workload: {
      workingDays:
        employee.workload?.workingDays,

      dailyOutput:
        employee.workload?.dailyOutput,

      monthlyWorkingDays:
        employee.workload?.monthlyWorkingDays,

      monthlyOutput:
        employee.workload?.monthlyOutput,
    },
  };
};


/**
 * Check whether employee can execute.
 *
 * IMPORTANT:
 * This function should be called BEFORE
 * starting any expensive AI/API operation.
 */
const canEmployeeRun = async ({
  employeeId,
  userId,
}) => {
  const employee = await Employee.findOne({
    _id: employeeId,
    userId,
  });

  if (!employee) {
    return {
      allowed: false,
      reason: "EMPLOYEE_NOT_FOUND",
    };
  }

  const account =
    await Account.findOne({
      _id: employee.accountId,
      userId,
    });
const testAccount = await isTestAccount(userId);

const user = await User.findById(userId)
  .select("accountType");

const isVIP = user?.accountType === "VIP";

const privilegedAccount = testAccount || isVIP;

if (privilegedAccount) {
  return {
    allowed: true,
    mode: isVIP ? "VIP" : "TEST",
    employeeId: employee._id,
    outputsUsed: Number(
      employee.usage?.successfulOutputs || 0
    ),
    maxOutputs: Number.MAX_SAFE_INTEGER,
    outputsRemaining: Number.MAX_SAFE_INTEGER,
  };
}
  if (!account) {
    return {
      allowed: false,
      reason: "ACCOUNT_NOT_FOUND",
    };
  }

  if (
    account.status !== "TRIAL" &&
    account.status !== "ACTIVE"
  ) {
    return {
      allowed: false,
      reason: "ACCOUNT_NOT_ACTIVE",
    };
  }

  const now = new Date();

  /**
   * ----------------------------------------
   * EMPLOYEE TRIAL
   * ----------------------------------------
   */
  if (employee.status === "TRIAL") {
    /**
     * Time check
     */
    if (
      !employee.trial?.endDate ||
      new Date(employee.trial.endDate) <= now
    ) {
      employee.status =
        "PAYMENT_REQUIRED";

      employee.trial.isActive = false;
      employee.billing.status = "PENDING";

      await employee.save();

      return {
        allowed: false,
        reason: "EMPLOYEE_TRIAL_EXPIRED",
      };
    }

    /**
     * Find trial usage.
     */
    const trialUsage =
      await EmployeeTrialUsage.findOne({
        userId,
        agentTemplateId:
          employee.agentTemplateId,
      });

    if (!trialUsage) {
      return {
        allowed: false,
        reason: "TRIAL_USAGE_NOT_FOUND",
      };
    }

    /**
     * Trial usage must be active.
     */
    if (
      trialUsage.status !== "ACTIVE"
    ) {
      return {
        allowed: false,
        reason: "EMPLOYEE_TRIAL_COMPLETED",
      };
    }

    /**
     * Output limit
     */
    if (
      trialUsage.outputsUsed >=
      trialUsage.maxOutputs
    ) {
      employee.status =
        "PAYMENT_REQUIRED";

      employee.trial.isActive = false;
      employee.billing.status = "PENDING";

      await employee.save();

      trialUsage.status = "COMPLETED";
      trialUsage.completedAt = now;

      await trialUsage.save();

      return {
        allowed: false,
        reason:
          "EMPLOYEE_TRIAL_OUTPUT_LIMIT_REACHED",
        outputsUsed:
          trialUsage.outputsUsed,
        maxOutputs:
          trialUsage.maxOutputs,
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


  /**
   * ----------------------------------------
   * PAID EMPLOYEE
   * ----------------------------------------
   */
  if (
    employee.status === "ACTIVE" &&
    employee.billing?.status === "ACTIVE"
  ) {
    /**
     * Check billing period.
     */
    if (
      employee.billing.currentPeriodEnd &&
      new Date(
        employee.billing.currentPeriodEnd
      ) <= now
    ) {
      employee.status = "PAUSED";
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


  /**
   * Everything else is blocked.
   */
  return {
    allowed: false,

    reason:
      "EMPLOYEE_NOT_AVAILABLE",
  };
};


/**
 * Increment trial output usage.
 *
 * IMPORTANT:
 * Call this ONLY after the output is successfully
 * generated.
 */
const recordTrialOutput = async ({
  employeeId,
  userId,
}) => {
  const employee =
    await Employee.findOne({
      _id: employeeId,
      userId,
    });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  if (
    employee.status !== "TRIAL"
  ) {
    return {
      recorded: false,
      reason: "NOT_IN_TRIAL",
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
    trialUsage.status !== "ACTIVE"
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

  /**
   * Increment BOTH records.
   *
   * Employee usage = analytics/accounting.
   * EmployeeTrialUsage = trial enforcement.
   */
  trialUsage.outputsUsed += 1;

  employee.usage.monthlyOutputUsed += 1;
  employee.usage.totalOutputs += 1;
  employee.usage.successfulOutputs += 1;

  employee.lastExecutionAt = new Date();
  employee.lastSuccessfulExecutionAt =
    new Date();

  /**
   * Trial completed by output limit.
   */
  if (
    trialUsage.outputsUsed >=
    trialUsage.maxOutputs
  ) {
    trialUsage.status = "COMPLETED";
    trialUsage.completedAt =
      new Date();

    employee.status =
      "PAYMENT_REQUIRED";

    employee.trial.isActive = false;
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


/**
 * Record failed execution.
 *
 * Failed output trial quota consume nahi karega.
 */
const recordFailedOutput = async ({
  employeeId,
  userId,
}) => {
  const employee =
    await Employee.findOne({
      _id: employeeId,
      userId,
    });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  employee.usage.failedOutputs += 1;
  employee.lastExecutionAt =
    new Date();

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