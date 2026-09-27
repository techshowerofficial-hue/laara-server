const mongoose = require("mongoose");

// ============================================================
// EMPLOYEE NODE
// ============================================================

const employeeNodeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      required: true,
      index: true,
    },

    position: {
      x: {
        type: Number,
        default: 0,
      },

      y: {
        type: Number,
        default: 0,
      },
    },

    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    _id: false,
    strict: false,
  }
);

// ============================================================
// EMPLOYEE EDGE
// ============================================================

const employeeEdgeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    source: {
      type: String,
      required: true,
    },

    target: {
      type: String,
      required: true,
    },

    sourceHandle: {
      type: String,
      default: null,
    },

    targetHandle: {
      type: String,
      default: null,
    },

    type: {
      type: String,
      default: "default",
    },
  },
  {
    _id: false,
    strict: false,
  }
);

// ============================================================
// EMPLOYEE SCHEMA
// ============================================================

const employeeSchema = new mongoose.Schema(
  {
    // ========================================================
    // OWNER
    // ========================================================

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

    // ========================================================
    // AGENT TEMPLATE
    // ========================================================

    agentTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentTemplate",
      required: true,
      index: true,
    },

    // ========================================================
    // BASIC INFORMATION
    // ========================================================

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    type: {
      type: String,
      required: true,
      index: true,
    },

    // ========================================================
    // EMPLOYEE STATUS
    // ========================================================

    status: {
      type: String,
      enum: [
        "CREATING",
        "TRIAL",
        "ACTIVE",
        "PAYMENT_REQUIRED",
        "PAUSED",
        "CANCELLED",
        "EXPIRED",
      ],
      default: "CREATING",
      index: true,
    },

    // ========================================================
    // EMPLOYEE TRIAL
    // ========================================================

    trial: {
      isActive: {
        type: Boolean,
        default: false,
      },

      startDate: {
        type: Date,
        default: null,
      },

      endDate: {
        type: Date,
        default: null,
      },

      used: {
        type: Boolean,
        default: false,
      },
    },

    // ========================================================
    // IDENTITY
    // ========================================================

    identity: {
      role: {
        type: String,
        default: "",
      },

      personality: {
        type: String,
        default: "",
      },

      tone: {
        type: String,
        default: "",
      },

      language: {
        type: String,
        default: "en",
      },
    },

    // ========================================================
    // USER INSTRUCTIONS
    // ========================================================

    instructions: {
      objective: {
        type: String,
        default: "",
      },

      customInstructions: {
        type: String,
        default: "",
      },

      audience: {
        type: String,
        default: "",
      },

      style: {
        type: String,
        default: "",
      },

      thingsToAvoid: {
        type: String,
        default: "",
      },

      callToAction: {
        type: String,
        default: "",
      },
    },

    // ========================================================
    // CONTENT PREFERENCES
    // ========================================================

  content: {
  niche: {
    type: String,
    default: "",
  },

  topics: {
    type: [String],
    default: [],
  },

  audience: {
    type: String,
    default: "",
  },

  visualStyle: {
    type: String,
    default: "",
  },

  cta: {
    type: String,
    default: "",
  },

  duration: {
    type: Number,
    default: 60,
  },

  aspectRatio: {
    type: String,
    default: "9:16",
  },

  outputFormat: {
    type: String,
    default: "reel",
  },
},

    // ========================================================
    // CHARACTER
    // ========================================================

    characterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character",
      default: null,
      index: true,
    },

    // ========================================================
    // SKILLS
    // ========================================================

    skills: {
      scriptWriting: {
        type: Boolean,
        default: true,
      },

      storytelling: {
        type: Boolean,
        default: true,
      },

      imageGeneration: {
        type: Boolean,
        default: true,
      },

      videoGeneration: {
        type: Boolean,
        default: true,
      },

      voiceGeneration: {
        type: Boolean,
        default: true,
      },

      captions: {
        type: Boolean,
        default: true,
      },

      music: {
        type: Boolean,
        default: true,
      },

      editing: {
        type: Boolean,
        default: true,
      },

      publishing: {
        type: Boolean,
        default: true,
      },
    },

    // ========================================================
    // WORKLOAD / SCHEDULE
    // ========================================================

workload: {
  workingDays: {
    type: [String],
    default: [
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
    ],
  },

  dailyOutput: {
    type: Number,
    default: 1,
    min: 1,
  },

  monthlyWorkingDays: {
    type: Number,
    default: 26,
    min: 0,
  },

  monthlyOutput: {
    type: Number,
    default: 26,
    min: 0,
  },

  preferredTime: {
    type: String,
    default: "19:00",
  },

  timezone: {
    type: String,
    default: "Asia/Kolkata",
  },
},

// ========================================================
// SCHEDULE — TOP LEVEL
// ========================================================

schedule: {
  triggerMode: {
    type: String,
    enum: ["MANUAL", "AUTOMATIC"],
    default: "MANUAL",
  },
  // Employee schedule validity period
  startDate: {
    type: Date,
    default: Date.now,
  },

  endDate: {
    type: Date,
    default: null,
  },

  weekly: {
    workingDays: {
      type: [String],
      enum: [
        "mon",
        "tue",
        "wed",
        "thu",
        "fri",
        "sat",
        "sun",
      ],
      default: [],
    },

    time: {
      type: String,
      default: "10:00",
    },

    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
  },

  exceptions: [
    {
      date: {
        type: Date,
        required: true,
      },

      type: {
        type: String,
        enum: ["HOLIDAY", "WORK"],
        required: true,
      },

      reason: {
        type: String,
        default: "",
        trim: true,
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  lastTriggeredSlot: {
    type: String,
    default: null,
  },

},
    // ========================================================
    // CONNECTIONS
    // ========================================================

    connections: {
      instagramConnectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Connection",
        default: null,
      },
    },
    storage: {
  provider: {
    type: String,
    default: "GOOGLE_DRIVE",
  },

  rootFolderId: {
    type: String,
    default: null,
  },

  folders: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  status: {
    type: String,
    enum: [
      "PENDING",
      "READY",
      "ERROR",
    ],
    default: "PENDING",
  },
},

    // ========================================================
    // SALARY / BILLING
    // ========================================================

    billing: {
      salary: {
        type: Number,
        required: true,
        min: 0,
      },

      currency: {
        type: String,
        default: "INR",
      },

      cycle: {
        type: String,
        enum: [
          "MONTHLY",
          "CUSTOM",
        ],
        default: "MONTHLY",
      },

      status: {
        type: String,
        enum: [
          "NOT_STARTED",
          "TRIAL",
          "PENDING",
          "ACTIVE",
          "PAST_DUE",
          "PAUSED",
          "CANCELLED",
        ],
        default: "NOT_STARTED",
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

      lastPaymentDate: {
        type: Date,
        default: null,
      },
    },

    // ========================================================
    // WORKFLOW
    // ========================================================

    workflow: {
      nodes: {
        type: [employeeNodeSchema],
        default: [],
      },

      edges: {
        type: [employeeEdgeSchema],
        default: [],
      },

      version: {
        type: Number,
        default: 1,
      },

      customized: {
        type: Boolean,
        default: false,
      },
    },

    // ========================================================
    // USAGE
    // ========================================================

    usage: {
      monthlyOutputUsed: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalOutputs: {
        type: Number,
        default: 0,
        min: 0,
      },

      successfulOutputs: {
        type: Number,
        default: 0,
        min: 0,
      },

      failedOutputs: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // ========================================================
    // LAST ACTIVITY
    // ========================================================

    lastExecutionAt: {
      type: Date,
      default: null,
    },

    lastSuccessfulExecutionAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================

employeeSchema.index({
  userId: 1,
  status: 1,
});

employeeSchema.index({
  userId: 1,
  type: 1,
});

employeeSchema.index({
  userId: 1,
  agentTemplateId: 1,
});

employeeSchema.index({
  accountId: 1,
  status: 1,
});

// ============================================================
// EXPORT
// ============================================================

module.exports =
  mongoose.model(
    "Employee",
    employeeSchema
  );