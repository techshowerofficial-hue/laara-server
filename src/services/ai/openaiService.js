const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn(
    "[OpenAI] OPENAI_API_KEY is not configured."
  );
}

const openai = new OpenAI({
  apiKey,
});

const generateText = async ({
  systemPrompt,
  userPrompt,
  model = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini",
}) => {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!userPrompt || typeof userPrompt !== "string") {
    throw new Error("OpenAI userPrompt is required");
  }

  const response = await openai.responses.create({
    model,
    instructions: systemPrompt || undefined,
    input: userPrompt,
  });

  const text = response.output_text?.trim();

  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }

  return {
    text,
    responseId: response.id,
    usage: response.usage || null,
  };
};

module.exports = {
  openai,
  generateText,
};