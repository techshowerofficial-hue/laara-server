const {
  getExecutionById,
  getEmployeeExecutions,
} = require("../services/executionService");

const {
  runEmployee,
} = require("../engine/employeeEngine");

// ========================================
// RUN EMPLOYEE
// ========================================

const runEmployeeExecution = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const employeeId = req.params.employeeId;

    // ========================================
    // AUTH CHECK
    // ========================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // ========================================
    // EMPLOYEE ID CHECK
    // ========================================

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // ========================================
    // INITIAL INPUT
    // ========================================

    const initialInput = req.body?.input || {};

    // ========================================
    // START EXECUTION IN BACKGROUND
    // ========================================

    const execution = await runEmployee(
      employeeId,
      userId,
      initialInput,
      {
        background: true,
      }
    );

    // ========================================
    // IMMEDIATE RESPONSE
    // ========================================

    return res.status(202).json({
      success: true,
      message: "Employee execution started",
      execution,
    });
  } catch (error) {
    console.error(
      "Run employee error:",
      error
    );

    const billingStatusMap = {
      EMPLOYEE_NOT_FOUND: 404,

      ACCOUNT_NOT_FOUND: 404,

      ACCOUNT_NOT_ACTIVE: 403,

      EMPLOYEE_TRIAL_EXPIRED: 402,

      EMPLOYEE_TRIAL_COMPLETED: 402,

      EMPLOYEE_TRIAL_OUTPUT_LIMIT_REACHED: 402,

      EMPLOYEE_PAYMENT_DUE: 402,

      EMPLOYEE_NOT_AVAILABLE: 403,

      TRIAL_USAGE_NOT_FOUND: 500,
    };

    const billingStatus =
      billingStatusMap[
        error.code ||
          error.message
      ];

    if (billingStatus) {
      return res.status(
        billingStatus
      ).json({
        success: false,
        message: error.message,
        billing:
          error.billing || null,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Employee execution failed",
    });
  }
};

// ========================================
// GET EXECUTION
// ========================================

const getExecution = async (
  req,
  res
) => {
  try {
    const execution =
      await getExecutionById({
        executionId:
          req.params.executionId,

        userId:
          req.user.userId,
      });

    if (!execution) {
      return res.status(404).json({
        success: false,
        message:
          "Execution not found",
      });
    }

    return res.json({
      success: true,
      execution,
    });
  } catch (error) {
    console.error(
      "Get execution error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch execution",
    });
  }
};

// ========================================
// EMPLOYEE EXECUTION HISTORY
// ========================================

const getEmployeeExecutionHistory =
  async (req, res) => {
    try {
      const executions =
        await getEmployeeExecutions({
          employeeId:
            req.params.employeeId,

          userId:
            req.user.userId,
        });

      return res.json({
        success: true,
        executions,
      });
    } catch (error) {
      console.error(
        "Get execution history error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch execution history",
      });
    }
  };

module.exports = {
  runEmployeeExecution,
  getExecution,
  getEmployeeExecutionHistory,
};