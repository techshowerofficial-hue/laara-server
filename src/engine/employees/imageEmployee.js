const triggerNode = require("../nodes/triggerNode");
const promptGeneratorNode = require("../nodes/promptGeneratorNode");
const imageGeneratorNode = require("../nodes/imageGeneratorNode");
const captionHashtagNode = require("../nodes/captionHashtagNode");
const googleDriveOutputNode =
  require("../nodes/googleDriveOutputNode");
const instagramNode = require("../nodes/instagramNode");
const characterReferenceNode =
  require("../nodes/characterReferenceNode");
/**
 * ============================================================
 * LAARA — IMAGE REEL EMPLOYEE
 * ============================================================
 *
 * Fixed internal workflow:
 *
 * Employee Profile
 *       ↓
 * Trigger
 *       ↓
 * Prompt Generator
 *       ↓
 * Image Generator
 *       ↓
 * Caption + Hashtags
 *       ↓
 * Cloudinary
 *       ↓
 * Instagram
 *
 * User does NOT control this internal pipeline.
 * Laara controls the sequence.
 * ============================================================
 */

const runImageEmployee = async ({
  employee,
  userId,
  executionId,
  input = {},
}) => {
  if (!employee) {
    throw new Error(
      "Image Employee: employee is required"
    );
  }

  if (!userId) {
    throw new Error(
      "Image Employee: userId is required"
    );
  }

  if (!executionId) {
    throw new Error(
      "Image Employee: executionId is required"
    );
  }

  const employeeId =
    employee._id?.toString();

  if (!employeeId) {
    throw new Error(
      "Image Employee: employee ID is missing"
    );
  }

  /*
   * Shared execution context.
   *
   * Every node receives this.
   */

  const context = {
    userId,
    employeeId,
    executionId,
    employee,
  };

  let currentInput = {
    ...input,
  };

  /* ============================================================
     START
  ============================================================ */

  console.log("\n");
  console.log(
    "============================================================"
  );
  console.log(
    "🤖 LAARA IMAGE REEL EMPLOYEE STARTED"
  );
  console.log(
    "============================================================"
  );

  console.log("\n👤 EMPLOYEE:");
  console.log(employee.name);

  console.log("\n🆔 EMPLOYEE ID:");
  console.log(employeeId);

  console.log("\n⚙️ EXECUTION ID:");
  console.log(executionId);

  console.log(
    "\n============================================================"
  );

  /* ============================================================
     STEP 1 — TRIGGER
  ============================================================ */

  console.log("\n");
  console.log("1️⃣ TRIGGER");
  console.log("--------------------------------");

  currentInput =
    await triggerNode.execute({
      input: currentInput,

      node: {
        type: "trigger",

        config: {
          triggerMode:
            employee.schedule?.triggerMode ||
            "MANUAL",
        },
      },

      context,
    });

  console.log("✅ Trigger completed");

  /* ============================================================
     STEP 2 — PROMPT GENERATOR
  ============================================================ */

  console.log("\n");
  console.log("2️⃣ PROMPT GENERATOR");
  console.log("--------------------------------");

  currentInput =
    await promptGeneratorNode.execute({
      input: currentInput,

      node: {
        type: "promptGenerator",

        config: {},
      },

      context,
    });

  console.log("✅ Prompt generated");

  console.log("\n🎨 IMAGE PROMPT:");
  console.log("--------------------------------");

  console.log(
    currentInput.imagePrompt ||
      currentInput.promptGeneration?.prompt ||
      "Prompt not found"
  );

  /* ============================================================
   STEP 3 — CHARACTER REFERENCE
============================================================ */

console.log("\n");
console.log("3️⃣ CHARACTER REFERENCE");
console.log("--------------------------------");

currentInput =
  await characterReferenceNode.execute({
    input: currentInput,
    node: {
      type: "characterReference",
      config: {},
    },
    context,
  });

console.log(
  "✅ Character reference processed"
);
  /* ============================================================
     STEP 4 — IMAGE GENERATOR
  ============================================================ */

  console.log("\n");
  console.log("3️⃣ IMAGE GENERATOR");
  console.log("--------------------------------");

  currentInput =
    await imageGeneratorNode.execute({
      input: currentInput,

      node: {
        type: "imageGenerator",

        config: {
          size:
            process.env.OPENAI_IMAGE_SIZE ||
            "1024x1792",

          quality:
            process.env.OPENAI_IMAGE_QUALITY ||
            "auto",
        },
      },

      context,
    });

  console.log("✅ Image generated");

  console.log("\n🖼️ GENERATED IMAGE FILE:");

  console.log(
    currentInput.generatedFile ||
      "File not found"
  );

  console.log("\n📁 LOCAL IMAGE PATH:");

  console.log(
    currentInput.generatedPath ||
      "Path not found"
  );

  /* ============================================================
     STEP 5 — CAPTION + HASHTAGS
  ============================================================ */

  console.log("\n");
  console.log("4️⃣ CAPTION + HASHTAGS");
  console.log("--------------------------------");

  currentInput =
    await captionHashtagNode.execute({
      input: currentInput,

      node: {
        type: "captionHashtag",

        config: {},
      },

      context,
    });

  console.log("✅ Caption and hashtags generated");

  console.log("\n📝 CAPTION:");
  console.log("--------------------------------");

  console.log(
    currentInput.caption ||
      "Caption not found"
  );

  console.log("\n#️⃣ HASHTAGS:");
  console.log("--------------------------------");

  console.log(
    currentInput.hashtagsText ||
  Array.isArray(currentInput.hashtags)
  ? currentInput.hashtags.join(" ")
  : currentInput.hashtags || "Hashtags not found"
  );


/* ============================================================
   STEP 6 — GOOGLE DRIVE OUTPUT
============================================================ */

console.log("\n");
console.log("5️⃣ GOOGLE DRIVE OUTPUT");
console.log("--------------------------------");

currentInput =
  await googleDriveOutputNode.execute({
    input: currentInput,

    node: {
      type: "googleDriveOutput",

      config: {},
    },

    context,
  });

console.log(
  "✅ Image saved to Google Drive"
);


  /* ============================================================
     STEP 7 — INSTAGRAM
  ============================================================ */

  console.log("\n");
  console.log("6️⃣ INSTAGRAM");
  console.log("--------------------------------");

  /*
   * Instagram needs a PUBLIC HTTPS image URL.
   */
/*
 * Instagram needs a PUBLIC HTTPS image URL.
 *
 * Google Drive Output node already returns webViewLink.
 */

const imageUrl =
  currentInput.googleDrive?.publicUrl;

if (!imageUrl) {
  throw new Error(
    "Image Employee: Google Drive did not return a public image URL"
  );
}

console.log("\n🌐 PUBLIC IMAGE URL:");
console.log(imageUrl);

currentInput.imageUrl =
  imageUrl;

currentInput.url =
  imageUrl;

  currentInput =
    await instagramNode.execute({
      input: currentInput,

      node: {
        type: "instagram",

        config: {
          connectionId:
            employee.connections
              ?.instagramConnectionId,
        },
      },

      context,
    });

  console.log(
    "✅ Instagram publishing completed"
  );

  /* ============================================================
     FINAL RESULT
  ============================================================ */

  console.log("\n");
  console.log(
    "############################################################"
  );

  console.log(
    "🎉 LAARA IMAGE REEL EMPLOYEE COMPLETED"
  );

  console.log(
    "############################################################"
  );

  console.log("\n📋 FINAL CONTENT");
  console.log(
    "============================================================"
  );

  console.log("\n👤 Employee:");
  console.log(
    employee.name
  );

  console.log("\n🎨 Image Prompt:");
  console.log(
    currentInput.imagePrompt ||
      currentInput.promptGeneration?.prompt
  );

  console.log("\n📝 Caption:");
  console.log(
    currentInput.caption
  );

  console.log("\n#️⃣ Hashtags:");
  console.log(
    currentInput.hashtagsText ||
  Array.isArray(currentInput.hashtags)
  ? currentInput.hashtags.join(" ")
  : currentInput.hashtags || "Hashtags not found"
  );

  console.log("\n🖼️ Generated File:");
  console.log(
    currentInput.generatedFile
  );

  console.log("\n📁 Local Path:");
  console.log(
    currentInput.generatedPath
  );

  console.log("\n☁️ Cloudinary URL:");
  console.log(
    currentInput.imageUrl
  );

  console.log("\n📱 Instagram Result:");

  console.log(
    JSON.stringify(
      currentInput.instagramPublish ||
        currentInput.instagram ||
        currentInput.instagramResult ||
        {},
      null,
      2
    )
  );

  console.log(
    "\n============================================================"
  );

  console.log(
    "✅ IMAGE REEL EMPLOYEE DONE"
  );

  console.log(
    "============================================================\n"
  );

  /* ============================================================
     RETURN
  ============================================================ */

  return {
    success: true,

    employeeId,

    executionId,

    type: "IMAGE_REEL",

    output: currentInput,
  };
};

module.exports = {
  runImageEmployee,
};