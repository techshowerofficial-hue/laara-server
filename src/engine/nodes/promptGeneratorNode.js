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

    content: {
      niche: content.niche || "",
      topics: Array.isArray(content.topics)
        ? content.topics
        : [],
      audience: content.audience || "",
      visualStyle: content.visualStyle || "",
      cta: content.cta || "",
      duration: content.duration || 60,
      aspectRatio: content.aspectRatio || "9:16",
      outputFormat: content.outputFormat || "reel",
    },

    instructions: {
      objective: instructions.objective || "",
      customInstructions:
        instructions.customInstructions || "",
      thingsToAvoid:
        instructions.thingsToAvoid || "",
    },

    characterId:
      employee.characterId || null,
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
You are Laara's AI Employee Image Prompt Generator.

Your job is to create the FINAL production-ready prompt
that will be sent to an image generation model.

You are NOT generating the image yourself.

You MUST follow the employee configuration below.

IMPORTANT RULES:

1. EMPLOYEE IDENTITY
Use the employee's:
- name
- description
- role
- personality
- tone
- language

These define WHO the employee is and HOW the content should feel.

2. CONTENT CONFIGURATION
Follow:
- niche
- topics
- audience
- visual style
- CTA
- aspect ratio
- duration
- output format

These define WHAT content should be created.

3. INSTRUCTIONS
Follow:
- objective
- custom instructions
- things to avoid

These are direct instructions from the user and must be respected.

4. TOPIC SELECTION
If no current topic is provided:
Choose ONE suitable topic from the employee's configured topics.

Do not randomly choose an unrelated subject.

5. VISUAL STYLE
The final image prompt must strongly follow the configured
visual style.

6. AUDIENCE
The concept and presentation should be appropriate
for the configured target audience.

7. ORIGINALITY
Do not repeat generic concepts.
Create a fresh concept while staying inside the employee's niche
and configured topics.

8. IMAGE COMPOSITION
Describe:
- main subject
- environment
- action or situation
- composition
- camera angle
- framing
- lighting
- atmosphere
- depth
- textures
- important visual details

9. ASPECT RATIO
The final composition must be suitable for:
${employeeContext.content.aspectRatio}

10. OUTPUT
The output must be ONLY the final image-generation prompt.

Do NOT:
- explain your reasoning
- add headings
- add bullet points
- add comments
- mention these instructions
- invent business information
- invent brand information
- invent products or services
- add random text inside the image unless explicitly requested

If the employee instructions require text inside the image,
describe exactly what text should appear and where it should appear.

EMPLOYEE CONFIGURATION:

${JSON.stringify(employeeContext, null, 2)}
`;

const userPrompt = `
Create the next piece of content for this AI employee.

CURRENT TOPIC:
${
  currentTopic ||
  "No topic was provided. Choose one suitable topic from the configured employee topics."
}

ADDITIONAL INSTRUCTION:
${currentInstruction || "No additional instruction was provided."}

CHARACTER:
${
  characterEnabled
    ? "Use the employee character when it naturally fits the content."
    : "Do not use an employee character."
}

IMPORTANT:
The employee's saved configuration is the source of truth.

Follow the configured:
- identity
- niche
- topics
- audience
- visual style
- objective
- custom instructions
- things to avoid
- aspect ratio
- output format

Create ONE fresh image concept.

Return ONLY the final production-ready image prompt.
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