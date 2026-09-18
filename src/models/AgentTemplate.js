const mongoose = require("mongoose");

// ============================================================
// AGENT TEMPLATE
// ============================================================

const agentTemplateSchema = new mongoose.Schema(
  {
    // ========================================================
    // BASIC INFORMATION
    // ========================================================

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    category: {
      type: String,
      enum: [
        "CONTENT",
        "VIDEO",
        "IMAGE",
        "MARKETING",
        "SOCIAL_MEDIA",
        "OTHER",
      ],
      default: "CONTENT",
      index: true,
    },

    // ========================================================
    // AVAILABILITY
    // ========================================================

    status: {
      type: String,
      enum: [
        "DRAFT",
        "ACTIVE",
        "INACTIVE",
      ],
      default: "DRAFT",
      index: true,
    },

    isPublic: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ========================================================
    // VERSION
    // ========================================================

    version: {
      type: Number,
      default: 1,
      min: 1,
    },

    // ========================================================
    // AI IDENTITY
    // ========================================================

    identity: {
      role: {
        type: String,
        default: "",
      },

      defaultPersonality: {
        type: String,
        default: "",
      },

      defaultTone: {
        type: String,
        default: "",
      },

      defaultLanguage: {
        type: String,
        default: "en",
      },
    },

    // ========================================================
    // SYSTEM INSTRUCTIONS
    // ========================================================

    systemPrompt: {
      type: String,
      required: true,
    },

    // ========================================================
    // CAPABILITIES
    // ========================================================

    capabilities: {
      scriptWriting: {
        type: Boolean,
        default: false,
      },

      storytelling: {
        type: Boolean,
        default: false,
      },

      imageGeneration: {
        type: Boolean,
        default: false,
      },

      videoGeneration: {
        type: Boolean,
        default: false,
      },

      voiceGeneration: {
        type: Boolean,
        default: false,
      },

      captions: {
        type: Boolean,
        default: false,
      },

      music: {
        type: Boolean,
        default: false,
      },

      editing: {
        type: Boolean,
        default: false,
      },

      publishing: {
        type: Boolean,
        default: false,
      },
    },

    // ========================================================
    // DEFAULT CONTENT CONFIG
    // ========================================================

    defaultConfig: {
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
    // WORKFLOW
    // ========================================================

    workflow: {
      nodes: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },

      edges: {
        type: mongoose.Schema.Types.Mixed,
        default: [],
      },
    },

    // ========================================================
    // TRIAL CONFIG
    // ========================================================

    trialConfig: {
      enabled: {
        type: Boolean,
        default: true,
      },

      durationDays: {
        type: Number,
        default: 2,
        min: 0,
      },

      maxOutputs: {
        type: Number,
        default: 3,
        min: 0,
      },
    },

    // ========================================================
    // SALARY CONFIG
    // ========================================================

    salaryConfig: {
      baseRate: {
        type: Number,
        required: true,
        min: 0,
      },

      currency: {
        type: String,
        default: "INR",
      },

      billingCycle: {
        type: String,
        enum: [
          "MONTHLY",
          "CUSTOM",
        ],
        default: "MONTHLY",
      },
    },

    // ========================================================
    // SORTING / DISPLAY
    // ========================================================

    sortOrder: {
      type: Number,
      default: 0,
    },

    icon: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================

agentTemplateSchema.index({
  status: 1,
  isPublic: 1,
});

agentTemplateSchema.index({
  category: 1,
  status: 1,
});

// ============================================================
// EXPORT
// ============================================================

module.exports =
  mongoose.model(
    "AgentTemplate",
    agentTemplateSchema
  );