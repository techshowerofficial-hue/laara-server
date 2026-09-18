const Employee = require("../models/Employee");
const { getNodeExecutor } = require("../engine/nodeRegistry");

const executeSelectedNode = async ({
  employeeId,
  nodeId,
  input = {}
}) => {
  const employee = await Employee.findById(employeeId);

  if (!employee) {
    throw new Error("Employee not found");
  }

  const node = employee.nodes.find(
    (item) => item.id === nodeId
  );

  if (!node) {
    throw new Error("Node not found");
  }

  const executor = getNodeExecutor(node.type);

  const executionId = `node_test_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const output = await executor.execute({
    node,
    input,
    context: {
      executionId,
      employeeId: employee._id.toString(),
      mode: "node_test"
    }
  });

  return {
    executionId,
    employeeId: employee._id.toString(),
    nodeId: node.id,
    nodeType: node.type,
    input,
    output
  };
};

module.exports = {
  executeSelectedNode
};