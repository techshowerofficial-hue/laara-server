const Employee = require("../models/Employee");
const User = require("../models/User");
const { isTestAccount } = require("../utils/testAccount");
const { getNodeExecutor } =
  require("./nodeRegistry");

const {
  createExecution,
  startNodeExecution,
  completeNodeExecution,
  failNodeExecution,
  completeExecution,
  failExecution,
} = require("../services/executionService");

const {
  canEmployeeRun,
  recordTrialOutput,
  recordFailedOutput,
} = require("../services/employeeBillingService");
const { runImageEmployee } =
  require("./employees/imageEmployee");
/*
|--------------------------------------------------------------------------
| CREATE EXECUTION CONTEXT
|--------------------------------------------------------------------------
*/

const createExecutionContext = (
  employee,
  userId,
  initialInput = {}
) => {
  return {
    executionId:
      `exec_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    userId: String(userId),

    employeeId:
      employee._id.toString(),

    status: "running",

    startedAt: new Date(),

    currentNodeId: null,

    results: {},

    finalOutput: null,

    initialInput,
  };
};

/*
|--------------------------------------------------------------------------
| FIND START NODES
|--------------------------------------------------------------------------
*/

const findStartNodes = (
  nodes = [],
  edges = []
) => {
  const targetNodeIds =
    new Set(
      edges
        .map((edge) => edge?.target)
        .filter(Boolean)
    );

  return nodes.filter(
    (node) =>
      node?.id &&
      !targetNodeIds.has(node.id)
  );
};

/*
|--------------------------------------------------------------------------
| GET NEXT NODES
|--------------------------------------------------------------------------
*/

const getNextNodes = (
  nodeId,
  nodes = [],
  edges = []
) => {
  const nextNodeIds =
    edges
      .filter(
        (edge) =>
          edge?.source === nodeId
      )
      .map(
        (edge) =>
          edge?.target
      )
      .filter(Boolean);

  return nextNodeIds
    .map((id) =>
      nodes.find(
        (node) =>
          node?.id === id
      )
    )
    .filter(Boolean);
};

/*
|--------------------------------------------------------------------------
| VALIDATE WORKFLOW
|--------------------------------------------------------------------------
*/

const validateWorkflow = (
  nodes,
  edges
) => {
  if (
    !Array.isArray(nodes) ||
    nodes.length === 0
  ) {
    throw new Error(
      "EMPLOYEE_HAS_NO_NODES"
    );
  }

  if (!Array.isArray(edges)) {
    throw new Error(
      "EMPLOYEE_WORKFLOW_EDGES_INVALID"
    );
  }

  const nodeIds = new Set();

  for (const node of nodes) {
    if (!node?.id) {
      throw new Error(
        "EMPLOYEE_WORKFLOW_NODE_ID_MISSING"
      );
    }

    if (!node?.type) {
      throw new Error(
        `EMPLOYEE_WORKFLOW_NODE_TYPE_MISSING:${node.id}`
      );
    }

    if (nodeIds.has(node.id)) {
      throw new Error(
        `DUPLICATE_WORKFLOW_NODE_ID:${node.id}`
      );
    }

    nodeIds.add(node.id);
  }

  for (const edge of edges) {
    if (
      !edge?.source ||
      !edge?.target
    ) {
      throw new Error(
        "EMPLOYEE_WORKFLOW_EDGE_INVALID"
      );
    }

    if (!nodeIds.has(edge.source)) {
      throw new Error(
        `WORKFLOW_EDGE_SOURCE_NOT_FOUND:${edge.source}`
      );
    }

    if (!nodeIds.has(edge.target)) {
      throw new Error(
        `WORKFLOW_EDGE_TARGET_NOT_FOUND:${edge.target}`
      );
    }
  }
};

/*
|--------------------------------------------------------------------------
| EXECUTE SINGLE NODE
|--------------------------------------------------------------------------
*/

const executeNode = async (
  node,
  input,
  context
) => {
  if (!node?.id) {
    throw new Error(
      "INVALID_NODE_ID"
    );
  }

  if (!node?.type) {
    throw new Error(
      `INVALID_NODE_TYPE:${node.id}`
    );
  }

  context.currentNodeId =
    node.id;

  console.log(
    `[${context.executionId}] Executing ${node.type}: ${node.id}`
  );

  const executor =
    getNodeExecutor(
      node.type
    );

  await startNodeExecution({
    executionId:
      context.executionId,

    userId:
      context.userId,

    nodeId:
      node.id,

    type:
      node.type,

    input,
  });

  try {
    const output =
      await executor.execute({
        input,
        node,
        context,
      });

    await completeNodeExecution({
      executionId:
        context.executionId,

      userId:
        context.userId,

      nodeId:
        node.id,

      output,
    });

    return output;
  } catch (error) {
    await failNodeExecution({
      executionId:
        context.executionId,

      userId:
        context.userId,

      nodeId:
        node.id,

      error:
        error?.message ||
        "NODE_EXECUTION_FAILED",
    });

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| RUN EMPLOYEE
|--------------------------------------------------------------------------
*/

const runEmployee = async (
  employeeId,
  userId,
  initialInput = {},
  options = {}
) => {
  if (!userId) {
    throw new Error(
      "USER_ID_REQUIRED"
    );
  }

  if (!employeeId) {
    throw new Error(
      "EMPLOYEE_ID_REQUIRED"
    );
  }

  // ========================================
  // BILLING / TRIAL CHECK
  // ========================================

  const permission =
    await canEmployeeRun({
      employeeId,
      userId,
    });

  if (!permission.allowed) {
    const error =
      new Error(
        permission.reason
      );

    error.code =
      permission.reason;

    error.billing =
      permission;

    throw error;
  }

  // ========================================
  // LOAD EMPLOYEE
  // ========================================

  const employee =
    await Employee.findOne({
      _id: employeeId,
      userId,
    });

  if (!employee) {
    throw new Error(
      "EMPLOYEE_NOT_FOUND"
    );
  }

  // ========================================
  // CREATE EXECUTION CONTEXT
  // ========================================

  const context =
    createExecutionContext(
      employee,
      userId,
      initialInput
    );

  // ========================================
  // CREATE EXECUTION IN DB
  // ========================================

  await createExecution({
    executionId:
      context.executionId,

    employeeId:
      employee._id,

    userId,

    initialInput,
  });

  // ========================================
  // BACKGROUND MODE
  // ========================================

  if (options.background) {
    setImmediate(() => {
      executePreparedEmployee({
        employee,
        userId,
        employeeId,
        initialInput,
        context,
      }).catch((error) => {
        console.error(
          `[${context.executionId}] Background execution error:`,
          error
        );
      });
    });

    // IMPORTANT:
    // Return immediately.
    return {
      executionId:
        context.executionId,

      employeeId,

      status: "running",

      startedAt:
        context.startedAt ||
        new Date(),
    };
  }

  // ========================================
  // NORMAL / SCHEDULER MODE
  // ========================================

  return await executePreparedEmployee({
    employee,
    userId,
    employeeId,
    initialInput,
    context,
  });
};
// ========================================
// PREPARED EMPLOYEE EXECUTION
// ========================================

const executePreparedEmployee = async ({
  employee,
  userId,
  employeeId,
  initialInput,
  context,
}) => {

  // ========================================
  // IMAGE REEL EMPLOYEE
  // ========================================

  if (
    employee.type ===
    "image_reel"
  ) {
    try {
      const result =
        await runImageEmployee({
          employee,

          userId,

          executionId:
            context.executionId,

          input:
            initialInput,
        });

      context.status =
        "success";

      context.finishedAt =
        new Date();

      context.finalOutput =
        result?.output ||
        result;

      await completeExecution({
        executionId:
          context.executionId,

        userId,

        finalOutput:
          context.finalOutput,
      });

      // ========================================
      // TRIAL USAGE
      // ========================================

      const usage =
        await recordTrialOutput({
          employeeId,
          userId,
        });

      context.trialUsage =
        usage;

      console.log(
        `[${context.executionId}] Image Reel Employee completed successfully.`
      );

      return context;

    } catch (error) {

      context.status =
        "failed";

      context.finishedAt =
        new Date();

      context.error =
        error?.message ||
        "IMAGE_EMPLOYEE_EXECUTION_FAILED";

      try {
        await failExecution({
          executionId:
            context.executionId,

          userId,

          error:
            context.error,
        });
      } catch (
        executionError
      ) {
        console.error(
          "Failed to save image employee execution failure:",
          executionError
        );
      }

      try {
        await recordFailedOutput({
          employeeId,
          userId,
        });
      } catch (
        usageError
      ) {
        console.error(
          "Failed to record failed output:",
          usageError
        );
      }

      throw error;
    }
  }

  // ========================================
  // NORMAL WORKFLOW
  // ========================================

  const workflow =
    employee.workflow || {};

  const nodes =
    Array.isArray(
      workflow.nodes
    )
      ? workflow.nodes
      : [];

  const edges =
    Array.isArray(
      workflow.edges
    )
      ? workflow.edges
      : [];

  // ========================================
  // VALIDATE WORKFLOW
  // ========================================

  validateWorkflow(
    nodes,
    edges
  );

  // ========================================
  // FIND START NODES
  // ========================================

  const startNodes =
    findStartNodes(
      nodes,
      edges
    );

  if (
    startNodes.length === 0
  ) {
    throw new Error(
      "COULD_NOT_FIND_EMPLOYEE_START_NODE"
    );
  }

  try {

    // ========================================
    // QUEUE
    // ========================================

    const executionQueue =
      startNodes.map(
        (node) => ({
          node,

          input:
            initialInput,
        })
      );

    // ========================================
    // EXECUTION LOOP
    // ========================================

    while (
      executionQueue.length > 0
    ) {
      const currentExecution =
        executionQueue.shift();

      const node =
        currentExecution.node;

      const input =
        currentExecution.input;

      // ========================================
      // EXECUTE NODE
      // ========================================

      const output =
        await executeNode(
          node,
          input,
          context
        );

      // ========================================
      // STORE RESULT
      // ========================================

      context.results[
        node.id
      ] = {
        nodeId:
          node.id,

        type:
          node.type,

        input,

        output,

        executedAt:
          new Date(),
      };

      // ========================================
      // NEXT NODES
      // ========================================

      const nextNodes =
        getNextNodes(
          node.id,
          nodes,
          edges
        );

      // ========================================
      // FINAL NODE
      // ========================================

      if (
        nextNodes.length === 0
      ) {
        context.finalOutput =
          output;

        continue;
      }

      // ========================================
      // ADD NEXT NODES
      // ========================================

      for (
        const nextNode of
        nextNodes
      ) {
        executionQueue.push({
          node:
            nextNode,

          input:
            output,
        });
      }
    }

    // ========================================
    // SUCCESS
    // ========================================

    context.status =
      "success";

    context.finishedAt =
      new Date();

    await completeExecution({
      executionId:
        context.executionId,

      userId,

      finalOutput:
        context.finalOutput,
    });

    // ========================================
    // TRIAL USAGE
    // ========================================

    const usage =
      await recordTrialOutput({
        employeeId,

        userId,
      });

    context.trialUsage =
      usage;

    console.log(
      `[${context.executionId}] Employee execution completed successfully.`
    );

    return context;

  } catch (error) {

    // ========================================
    // FAILURE
    // ========================================

    context.status =
      "failed";

    context.finishedAt =
      new Date();

    context.error =
      error?.message ||
      "EMPLOYEE_EXECUTION_FAILED";

    try {
      await failExecution({
        executionId:
          context.executionId,

        userId,

        error:
          context.error,
      });
    } catch (
      executionError
    ) {
      console.error(
        "Failed to save execution failure:",
        executionError
      );
    }

    try {
      await recordFailedOutput({
        employeeId,

        userId,
      });
    } catch (
      usageError
    ) {
      console.error(
        "Failed to record failed output:",
        usageError
      );
    }

    throw error;
  }
};
module.exports = {
  runEmployee,
  executeNode,
};