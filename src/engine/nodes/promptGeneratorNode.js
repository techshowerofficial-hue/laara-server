const Employee = require("../../models/Employee");
const { generateText } = require("../../services/ai/openaiService");

const buildEmployeeContext = (employee) => {
  const identity = employee.identity || {};
  const instructions = employee.instructions || {};
  const content = employee.content || {};

  return {
    employeeName: employee.name || "",
    employeeType: employee.type || "",
    description: employee.description || "",

    identity: {
      role: identity.role || "",
      personality: identity.personality || "",
      tone: identity.tone || "",
      language: identity.language || "",
    },

    instructions: {
      system: instructions.system || "",
      custom: instructions.custom || "",
    },

    content: {
      category: content.category || "",
      topics: content.topics || [],
      keywords: content.keywords || [],
      audience: content.audience || "",
      style: content.style || "",
      tone: content.tone || "",
      language: content.language || "",
      cta: content.cta || "",
    },

    characterId: employee.characterId || null,
  };
};

const execute = async ({ input, node, context }) => {
  if (!context?.userId) {
    throw new Error(
      "Prompt Generator: userId is missing from execution context"
    );
  }

  if (!context?.employeeId) {
    throw new Error(
      "Prompt Generator: employeeId is missing from execution context"
    );
  }

  const employee = await Employee.findOne({
    _id: context.employeeId,
    userId: context.userId,
  }).lean();

  if (!employee) {
    throw new Error("Prompt Generator: Employee not found");
  }

  const employeeContext =
    buildEmployeeContext(employee);

  const config = node?.config || {};

  const currentTopic =
    input?.topic ||
    input?.currentTopic ||
    config?.topic ||
    "";

  const currentInstruction =
    input?.instruction ||
    input?.currentInstruction ||
    config?.instruction ||
    "";

  const characterEnabled =
    input?.characterEnabled ??
    config?.characterEnabled ??
    Boolean(employee.characterId);

  /* ============================================================
     CONSOLE — EMPLOYEE PROFILE
  ============================================================ */

  console.log("\n");
  console.log("================================================");
  console.log("🤖 LAARA IMAGE REEL EMPLOYEE");
  console.log("================================================");

  console.log("\n📋 EMPLOYEE PROFILE:");
  console.log(
    JSON.stringify(
      employeeContext,
      null,
      2
    )
  );

  console.log("\n🎯 CURRENT TOPIC:");
  console.log(
    currentTopic ||
      "AI will choose topic from employee profile."
  );

  console.log("\n📝 CURRENT INSTRUCTION:");
  console.log(
    currentInstruction || "None"
  );

  console.log("\n🎭 CHARACTER:");
  console.log(
    characterEnabled
      ? "Enabled"
      : "Disabled"
  );

  console.log("\n------------------------------------------------");

  const systemPrompt = `
You are Laara's Image Reel Employee prompt generator.

Create ONLY a production-ready image-generation prompt.

You are NOT generating the image.

Use the employee profile carefully.

The image must:
- match the employee identity
- match personality and visual style
- match content category
- match target audience
- be visually detailed
- have strong composition
- include environment
- include lighting
- include camera/framing when useful
- be suitable for social media
- be original
- be safe for general social-media publishing

If a character is enabled, include the character naturally.

Do not explain anything.

Return ONLY the final image-generation prompt.

EMPLOYEE PROFILE:
${JSON.stringify(
  employeeContext,
  null,
  2
)}
`;

  const userPrompt = `
Create the next image-generation prompt.

Current topic:
${
  currentTopic ||
  "Choose a suitable topic from the employee profile."
}

Additional instruction:
${currentInstruction || "None"}

Character usage:
${
  characterEnabled
    ? "Include the employee character when appropriate."
    : "Do not include the employee character."
}
`;

  const result = await generateText({
    systemPrompt,
    userPrompt,
    model:
      config.model ||
      process.env.OPENAI_TEXT_MODEL ||
      "gpt-5-mini",
  });

  console.log("\n🎨 GENERATED IMAGE PROMPT:");
  console.log("------------------------------------------------");
  console.log(result.text);
  console.log("------------------------------------------------");

  return {
    ...input,

    employeeProfile: employeeContext,

    promptGeneration: {
      success: true,
      prompt: result.text,
      model:
        config.model ||
        process.env.OPENAI_TEXT_MODEL ||
        "gpt-5-mini",
      responseId: result.responseId,
      usage: result.usage,
    },

    imagePrompt: result.text,
  };
};

module.exports = {
  execute,
};