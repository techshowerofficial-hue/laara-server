const mongoose = require("mongoose");

const characterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    referenceImage: {
      name: {
        type: String,
        required: true,
      },

      driveFileId: {
        type: String,
        default: null,
      },

      driveFolderId: {
        type: String,
        default: null,
      },

      mimeType: {
        type: String,
        default: "image/jpeg",
      },
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model("Character", characterSchema);