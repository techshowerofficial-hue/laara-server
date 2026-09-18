const mongoose = require("mongoose");


// ========================================
// NODE EXECUTION SCHEMA
// ========================================

const nodeExecutionSchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: true
    },

    type: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: [
        "pending",
        "running",
        "success",
        "failed"
      ],
      default: "pending"
    },

    input: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    output: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    error: {
      type: String,
      default: null
    },

    startedAt: {
      type: Date,
      default: null
    },

    finishedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);


// ========================================
// EXECUTION SCHEMA
// ========================================

const executionSchema = new mongoose.Schema(
  {
    // ========================================
    // UNIQUE EXECUTION ID
    // ========================================

    executionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },


    // ========================================
    // OWNER
    // ========================================

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },


    // ========================================
    // EMPLOYEE
    // ========================================

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true
    },


    // ========================================
    // STATUS
    // ========================================

    status: {
      type: String,
      enum: [
        "running",
        "success",
        "failed"
      ],
      default: "running",
      index: true
    },


    // ========================================
    // INITIAL INPUT
    // ========================================

    initialInput: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },


    // ========================================
    // CURRENT NODE
    // ========================================

    currentNodeId: {
      type: String,
      default: null
    },


    // ========================================
    // NODE RESULTS
    // ========================================

    nodeResults: {
      type: [nodeExecutionSchema],
      default: []
    },


    // ========================================
    // FINAL OUTPUT
    // ========================================

    finalOutput: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },


    // ========================================
    // ERROR
    // ========================================

    error: {
      type: String,
      default: null
    },


    // ========================================
    // START / FINISH
    // ========================================

    startedAt: {
      type: Date,
      default: Date.now
    },

    finishedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);


// ========================================
// INDEXES
// ========================================

executionSchema.index({
  userId: 1,
  createdAt: -1
});

executionSchema.index({
  userId: 1,
  employeeId: 1,
  createdAt: -1
});

executionSchema.index({
  userId: 1,
  status: 1
});


// ========================================
// MODEL
// ========================================

module.exports = mongoose.model(
  "Execution",
  executionSchema
);