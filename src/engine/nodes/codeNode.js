const execute = async ({
  input,
  node,
  context,
}) => {
  const code =
    node?.config?.code;

  if (
    !code ||
    typeof code !==
      "string"
  ) {
    throw new Error(
      "Code node requires a valid code configuration"
    );
  }

  console.log(
    "========== CODE NODE =========="
  );

  console.log(
    "USER:",
    context?.userId || null
  );

  console.log(
    "EMPLOYEE:",
    context?.employeeId || null
  );

  console.log(
    "EXECUTION:",
    context?.executionId || null
  );

  const AsyncFunction =
    Object.getPrototypeOf(
      async function () {}
    ).constructor;

  const userFunction =
    new AsyncFunction(
      "input",
      "context",
      code
    );

  return await userFunction(
    input,
    context
  );
};

module.exports = {
  execute,
};