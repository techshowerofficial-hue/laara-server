const {
  generateImage,
} = require("../../services/ai/imageGenerationService");

const execute = async ({
  input,
  node,
  context,
}) => {
  if (!context?.userId) {
    throw new Error(
      "Image Generator: userId is missing"
    );
  }

  if (!context?.employeeId) {
    throw new Error(
      "Image Generator: employeeId is missing"
    );
  }

  const imagePrompt =
    input?.imagePrompt ||
    input?.promptGeneration?.prompt;

  if (!imagePrompt) {
    throw new Error(
      "Image Generator: image prompt not found"
    );
  }

  const config = node?.config || {};

  const size =
    config.size ||
    process.env.OPENAI_IMAGE_SIZE ||
    "1024x1024";

  const quality =
    config.quality ||
    process.env.OPENAI_IMAGE_QUALITY ||
    "auto";

  console.log("\n");
  console.log(
    "================================================"
  );
  console.log("🎨 IMAGE GENERATOR");
  console.log(
    "================================================"
  );

  console.log("\nModel:");
  console.log(
    process.env.OPENAI_IMAGE_MODEL ||
      "gpt-image-1"
  );

  console.log("\nSize:");
  console.log(size);

  console.log("\nQuality:");
  console.log(quality);

  console.log("\nGenerating image...");

  const result = await generateImage({
    prompt: imagePrompt,
    size,
    quality,
  });

  console.log("\n✅ IMAGE GENERATED");
  console.log(
    "------------------------------------------------"
  );

  console.log("File:");
  console.log(
    result.generatedFile
  );

  console.log("\nLocal Path:");
  console.log(
    result.generatedPath
  );

  console.log(
    "------------------------------------------------"
  );

  return {
    ...input,

    imageGeneration: {
      success: true,
      model: result.model,
      generatedFile:
        result.generatedFile,
    },

    generatedPath:
      result.generatedPath,

    generatedFile:
      result.generatedFile,

    imagePrompt,
  };
};

module.exports = {
  execute,
};