const Execution = require("../models/Execution");


// ========================================
// CREATE EXECUTION
// ========================================

const createExecution = async ({
  executionId,
  employeeId,
  userId,
  initialInput
}) => {
  return Execution.create({
    executionId,
    employeeId,
    userId,
    initialInput,
    status: "running",
    startedAt: new Date()
  });
};


// ========================================
// START NODE EXECUTION
// ========================================

const startNodeExecution = async ({
  executionId,
  userId,
  nodeId,
  type,
  input
}) => {
  return Execution.findOneAndUpdate(
    {
      executionId,
      userId
    },
    {
      $set: {
        currentNodeId: nodeId
      },

      $push: {
        nodeResults: {
          nodeId,
          type,
          status: "running",
          input,
          startedAt: new Date()
        }
      }
    },
   {
  returnDocument: "after"
}
  );
};


// ========================================
// COMPLETE NODE EXECUTION
// ========================================

const completeNodeExecution = async ({
  executionId,
  userId,
  nodeId,
  output
}) => {
  return Execution.findOneAndUpdate(
    {
      executionId,
      userId,
      "nodeResults.nodeId": nodeId
    },
    {
      $set: {
        "nodeResults.$.status": "success",
        "nodeResults.$.output": output,
        "nodeResults.$.finishedAt":
          new Date()
      }
    },
  {
  returnDocument: "after"
}
  );
};


// ========================================
// FAIL NODE EXECUTION
// ========================================

const failNodeExecution = async ({
  executionId,
  userId,
  nodeId,
  error
}) => {
  return Execution.findOneAndUpdate(
    {
      executionId,
      userId,
      "nodeResults.nodeId": nodeId
    },
    {
      $set: {
        "nodeResults.$.status": "failed",
        "nodeResults.$.error": error,
        "nodeResults.$.finishedAt":
          new Date()
      }
    },
  {
  returnDocument: "after"
}
  );
};


// ========================================
// COMPLETE EXECUTION
// ========================================

const completeExecution = async ({
  executionId,
  userId,
  finalOutput
}) => {
  return Execution.findOneAndUpdate(
    {
      executionId,
      userId
    },
    {
      $set: {
        status: "success",
        finalOutput,
        currentNodeId: null,
        finishedAt: new Date()
      }
    },
 {
  returnDocument: "after"
}
  );
};


// ========================================
// FAIL EXECUTION
// ========================================

const failExecution = async ({
  executionId,
  userId,
  error
}) => {
  return Execution.findOneAndUpdate(
    {
      executionId,
      userId
    },
    {
      $set: {
        status: "failed",
        error,
        currentNodeId: null,
        finishedAt: new Date()
      }
    },
{
  returnDocument: "after"
}
  );
};


// ========================================
// GET EXECUTION BY ID
// ========================================

const getExecutionById = async ({
  executionId,
  userId
}) => {
  return Execution.findOne({
    executionId,
    userId
  });
};


// ========================================
// GET EMPLOYEE EXECUTIONS
// ========================================

const getEmployeeExecutions = async ({
  employeeId,
  userId
}) => {
  return Execution.find({
    employeeId,
    userId
  })
    .sort({
      createdAt: -1
    })
    .limit(50);
};


module.exports = {
  createExecution,
  startNodeExecution,
  completeNodeExecution,
  failNodeExecution,
  completeExecution,
  failExecution,
  getExecutionById,
  getEmployeeExecutions
};