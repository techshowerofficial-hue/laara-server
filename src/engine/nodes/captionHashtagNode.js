const {
  generateText,
} = require("../../services/ai/openaiService");

const parseAIJson = (text) => {
  if (!text) {
    throw new Error(
      "Caption AI returned empty response"
    );
  }

  let cleaned = text.trim();

  // Remove markdown code fences if AI adds them
  cleaned = cleaned
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error(
      "[Caption AI] JSON parse failed:"
    );

    console.error(cleaned);

    throw new Error(
      "Caption AI returned invalid JSON"
    );
  }
};

const execute = async ({
  input,
  node,
  context,
}) => {
  if (!context?.userId) {
    throw new Error(
      "Caption Generator: userId is missing"
    );
  }

  if (!context?.employeeId) {
    throw new Error(
      "Caption Generator: employeeId is missing"
    );
  }

  const config = node?.config || {};

  const imagePrompt =
    input?.imagePrompt ||
    input?.promptGeneration?.prompt ||
    "";

  if (!imagePrompt) {
    throw new Error(
      "Caption Generator: image prompt is missing"
    );
  }

  const employeeProfile =
    input?.employeeProfile || {};

  console.log("\n");
  console.log(
    "================================================"
  );
  console.log(
    "✍️ CAPTION + HASHTAG GENERATOR"
  );
  console.log(
    "================================================"
  );

  const systemPrompt = `
You are Laara's social media caption generator.

Create a social media caption and relevant hashtags
for an AI-generated image.

Follow the employee profile.

Return ONLY valid JSON.

Required JSON format:

{
  "caption": "string",
  "hashtags": ["#hashtag1", "#hashtag2"]
}

Rules:

- Caption should sound natural.
- Match employee personality.
- Match content style.
- Do not mention AI unless the profile specifically requires it.
- Do not use excessive emojis.
- Hashtags must be relevant.
- Generate 8 to 15 hashtags.
- Hashtags must start with #.
- No markdown.
- No explanation.
`;

  const userPrompt = `
EMPLOYEE PROFILE:

${JSON.stringify(
  employeeProfile,
  null,
  2
)}

IMAGE PROMPT:

${imagePrompt}

Create the caption and hashtags.
`;

  const result = await generateText({
    systemPrompt,
    userPrompt,
    model:
      config.model ||
      process.env.OPENAI_TEXT_MODEL ||
      "gpt-5-mini",
  });

  const data = parseAIJson(
    result.text
  );

  const caption =
    typeof data.caption === "string"
      ? data.caption.trim()
      : "";

  const hashtags = Array.isArray(
    data.hashtags
  )
    ? data.hashtags
        .filter(Boolean)
        .map(tag => {
          const clean =
            String(tag)
              .trim()
              .replace(/\s+/g, "");

          if (!clean) {
            return "";
          }

          return clean.startsWith("#")
            ? clean
            : `#${clean}`;
        })
        .filter(Boolean)
    : [];

  if (!caption) {
    throw new Error(
      "Caption Generator: caption missing"
    );
  }

  if (!hashtags.length) {
    throw new Error(
      "Caption Generator: hashtags missing"
    );
  }

  console.log("\n📝 CAPTION:");
  console.log(
    "------------------------------------------------"
  );
  console.log(caption);

  console.log("\n#️⃣ HASHTAGS:");
  console.log(
    "------------------------------------------------"
  );
  console.log(
    hashtags.join(" ")
  );

  console.log(
    "------------------------------------------------"
  );

  return {
    ...input,

    captionGeneration: {
      success: true,
      caption,
      hashtags,
      model:
        config.model ||
        process.env.OPENAI_TEXT_MODEL ||
        "gpt-5-mini",
      responseId: result.responseId,
      usage: result.usage,
    },

    caption,
    hashtags,
    hashtagsText:
      hashtags.join(" "),
  };
};

module.exports = {
  execute,
};