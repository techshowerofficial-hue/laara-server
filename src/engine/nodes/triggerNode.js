const execute = async ({
  input,
  node,
  context,
}) => {
  const config =
    node?.config || {};

  const triggerMode =
    config.triggerMode ||
    "MANUAL";

  console.log(
    "========== TRIGGER NODE =========="
  );

  console.log(
    "Trigger Mode:",
    triggerMode
  );

  console.log(
    "User:",
    context?.userId || null
  );

  console.log(
    "Employee:",
    context?.employeeId || null
  );

  console.log(
    "Execution:",
    context?.executionId || null
  );

  return {
    ...input,

    trigger: {
      mode:
        triggerMode,

      triggeredAt:
        new Date().toISOString(),
    },
  };
};

module.exports = {
  execute,
};