const {
  resolveMappings,
} = require("../../utils/dataMapper");

const execute = async ({
  input,
  node,
  context,
}) => {
  const config =
    node?.config || {};

  const fields =
    config.fields || {};

  console.log(
    "========== EDIT FIELDS NODE =========="
  );

  console.log(
    "USER:",
    context?.userId || null
  );

  console.log(
    "EMPLOYEE:",
    context?.employeeId || null
  );

  return resolveMappings(
    fields,
    input
  );
};

module.exports = {
  execute,
};