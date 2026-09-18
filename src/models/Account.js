const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    // =========================
    // OWNER
    // =========================

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // =========================
    // ACCOUNT STATUS
    // =========================

    status: {
      type: String,
      enum: [
        "TRIAL",
        "ACTIVE",
        "EXPIRED",
        "SUSPENDED",
        "CANCELLED",
      ],
      default: "TRIAL",
      index: true,
    },

    // =========================
    // ACCOUNT PLAN
    // =========================

    plan: {
      type: String,
      enum: [
        "FREE",
        "STARTER",
        "PRO",
        "BUSINESS",
      ],
      default: "FREE",
      index: true,
    },

    // =========================
    // TRIAL
    // =========================

    trial: {
      isActive: {
        type: Boolean,
        default: true,
      },

      startDate: {
        type: Date,
        default: null,
      },

      endDate: {
        type: Date,
        default: null,
      },
    },

    // =========================
    // CURRENT BILLING PERIOD
    // =========================

    billing: {
      status: {
        type: String,
        enum: [
          "NOT_REQUIRED",
          "PENDING",
          "ACTIVE",
          "PAST_DUE",
          "CANCELLED",
        ],
        default: "NOT_REQUIRED",
      },

      currency: {
        type: String,
        default: "INR",
      },

      currentPeriodStart: {
        type: Date,
        default: null,
      },

      currentPeriodEnd: {
        type: Date,
        default: null,
      },

      nextPaymentDate: {
        type: Date,
        default: null,
      },
    },

    // =========================
    // USAGE LIMITS
    // =========================

    limits: {
      maxEmployees: {
        type: Number,
        default: 1,
      },

      maxMonthlyOutputs: {
        type: Number,
        default: 30,
      },
        unlimited: {
    type: Boolean,
    default: false,
  },
    },

    // =========================
    // ACCOUNT SETTINGS
    // =========================

    settings: {
      timezone: {
        type: String,
        default: "Asia/Kolkata",
      },

      language: {
        type: String,
        default: "en",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Account", accountSchema);