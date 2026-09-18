const mongoose = require("mongoose");

// ============================================================
// EMPLOYEE TRIAL USAGE
// ============================================================

const employeeTrialUsageSchema =
  new mongoose.Schema(
    {
      // ======================================================
      // OWNER
      // ======================================================

      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: true,
        index: true,
      },

      // ======================================================
      // AGENT
      // ======================================================

      agentTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AgentTemplate",
        required: true,
        index: true,
      },

      // ======================================================
      // EMPLOYEE
      // ======================================================

      employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
        index: true,
      },

      // ======================================================
      // TRIAL
      // ======================================================

      status: {
        type: String,
        enum: [
          "AVAILABLE",
          "ACTIVE",
          "COMPLETED",
          "EXPIRED",
        ],
        default: "AVAILABLE",
        index: true,
      },

      startDate: {
        type: Date,
        default: null,
      },

      endDate: {
        type: Date,
        default: null,
      },

      // ======================================================
      // USAGE
      // ======================================================

      maxOutputs: {
        type: Number,
        default: 3,
        min: 0,
      },

      outputsUsed: {
        type: Number,
        default: 0,
        min: 0,
      },

      // ======================================================
      // TRIAL CONSUMED
      // ======================================================

      used: {
        type: Boolean,
        default: false,
        index: true,
      },

      completedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );

// ============================================================
// IMPORTANT UNIQUE INDEX
// ============================================================

// One user can have only ONE trial record
// for one AgentTemplate.

employeeTrialUsageSchema.index(
  {
    userId: 1,
    agentTemplateId: 1,
  },
  {
    unique: true,
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports =
  mongoose.model(
    "EmployeeTrialUsage",
    employeeTrialUsageSchema
  );