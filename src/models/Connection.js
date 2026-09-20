const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    platform: {
      type: String,
      enum: [
        "INSTAGRAM",
        "TELEGRAM",
        "YOUTUBE",
        "FACEBOOK",
       "GOOGLE_DRIVE",   
      ],
      required: true,
      index: true,
    },

    accountId: {
      type: String,
      default: "",
      trim: true,
    },

    username: {
      type: String,
      default: "",
      trim: true,
    },

    accountName: {
      type: String,
      default: "",
      trim: true,
    },

    profileImage: {
      type: String,
      default: "",
      trim: true,
    },

    accessToken: {
      type: String,
      default: "",
      select: false,
    },

    refreshToken: {
      type: String,
      default: "",
      select: false,
    },

    status: {
      type: String,
      enum: [
        "CONNECTED",
        "DISCONNECTED",
        "EXPIRED",
        "ERROR",
      ],
      default: "CONNECTED",
      index: true,
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

/*
 * User → platform lookup
 */
connectionSchema.index({
  userId: 1,
  platform: 1,
});

/*
 * Prevent duplicate account connection
 * for the same user/platform.
 */
connectionSchema.index(
  {
    userId: 1,
    platform: 1,
    accountId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      accountId: {
        $exists: true,
        $ne: "",
      },
    },
  }
);

module.exports = mongoose.model(
  "Connection",
  connectionSchema
);