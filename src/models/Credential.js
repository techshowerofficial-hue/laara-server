const mongoose = require("mongoose");

const credentialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      trim: true,
    },

 encryptedData: {
  iv: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  authTag: {
    type: String,
    required: true,
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

module.exports = mongoose.model("Credential", credentialSchema);