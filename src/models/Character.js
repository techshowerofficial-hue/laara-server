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
      trim: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    referenceImage: {
      name: {
        type: String,
        required: true
      },

      url: {
        type: String,
        required: true
      },

      publicId: {
        type: String,
        required: true
      }
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Character",
  characterSchema
);