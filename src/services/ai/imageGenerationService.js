const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("[Image AI] OPENAI_API_KEY is not configured.");
}

const openai = new OpenAI({
  apiKey,
});

const generateImage = async ({
  prompt,
  size = "1024x1024",
  quality = "auto",
}) => {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!prompt || typeof prompt !== "string") {
    throw new Error("Image generation prompt is required");
  }

  const response = await openai.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    prompt,
    size,
    quality,
  });

  const imageBase64 = response?.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("Image AI did not return image data");
  }

  const generatedDir = path.join(process.cwd(), "generated");

  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, {
      recursive: true,
    });
  }

  const filename = `image-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.png`;

  const imagePath = path.join(
    generatedDir,
    filename
  );

  fs.writeFileSync(
    imagePath,
    Buffer.from(imageBase64, "base64")
  );

  return {
    success: true,
    generatedPath: imagePath,
    generatedFile: filename,
    model:
      process.env.OPENAI_IMAGE_MODEL ||
      "gpt-image-1",
  };
};

module.exports = {
  generateImage,
};