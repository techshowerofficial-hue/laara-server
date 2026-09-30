const triggerNode = require("../nodes/triggerNode");
const promptGeneratorNode = require("../nodes/promptGeneratorNode");
const imageGeneratorNode = require("../nodes/imageGeneratorNode");
const captionHashtagNode = require("../nodes/captionHashtagNode");

const {
  startNodeExecution,
  completeNodeExecution,
  failNodeExecution,
} = require("../../services/executionService");

const googleDriveOutputNode =
  require("../nodes/googleDriveOutputNode");

const instagramNode =
  require("../nodes/instagramNode");

const characterReferenceNode =
  require("../nodes/characterReferenceNode");


/*
|--------------------------------------------------------------------------
| RUN TRACKED STEP
|--------------------------------------------------------------------------
*/

const runTrackedStep = async ({
  executionId,
  userId,
  nodeId,
  type,
  input,
  execute,
}) => {

  await startNodeExecution({
    executionId,
    userId,
    nodeId,
    type,
    input,
  });

  try {

    const output = await execute();

    await completeNodeExecution({
      executionId,
      userId,
      nodeId,
      output,
    });

    return output;

  } catch (error) {

    await failNodeExecution({
      executionId,
      userId,
      nodeId,
      error:
        error?.message ||
        "NODE_EXECUTION_FAILED",
    });

    throw error;
  }
};


/*
|--------------------------------------------------------------------------
| LAARA IMAGE REEL EMPLOYEE
|--------------------------------------------------------------------------
|
| Internal pipeline:
|
| 1. Trigger
| 2. Generate Prompt
| 3. Character Reference
| 4. Generate Image
| 5. Caption + Hashtags
| 6. Laara
| 7. Instagram
|
|--------------------------------------------------------------------------
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
  |--------------------------------------------------------------------------
  | SHARED CONTEXT
  |--------------------------------------------------------------------------
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


  console.log("");
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


  /*
  |--------------------------------------------------------------------------
  | STEP 1 — TRIGGER
  |--------------------------------------------------------------------------
  */

  console.log("\n1️⃣ TRIGGER");
  console.log("--------------------------------");

  currentInput = await runTrackedStep({
    executionId,
    userId,

    nodeId: "trigger",
    type: "trigger",

    input: currentInput,

    execute: () =>
      triggerNode.execute({
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
      }),
  });

  console.log("✅ Trigger completed");


  /*
  |--------------------------------------------------------------------------
  | STEP 2 — PROMPT GENERATOR
  |--------------------------------------------------------------------------
  */

  console.log("\n2️⃣ PROMPT GENERATOR");
  console.log("--------------------------------");

  currentInput = await runTrackedStep({
    executionId,
    userId,

    nodeId: "promptGenerator",
    type: "promptGenerator",

    input: currentInput,

    execute: () =>
      promptGeneratorNode.execute({
        input: currentInput,

        node: {
          type: "promptGenerator",
          config: {},
        },

        context,
      }),
  });

  console.log("✅ Prompt generated");

  console.log("\n🎨 IMAGE PROMPT:");
  console.log("--------------------------------");

  console.log(
    currentInput.imagePrompt ||
      currentInput.promptGeneration?.prompt ||
      "Prompt not found"
  );


  /*
  |--------------------------------------------------------------------------
  | STEP 3 — CHARACTER REFERENCE
  |--------------------------------------------------------------------------
  */

  console.log("\n3️⃣ CHARACTER REFERENCE");
  console.log("--------------------------------");

  currentInput = await runTrackedStep({
    executionId,
    userId,

    nodeId: "characterReference",
    type: "characterReference",

    input: currentInput,

    execute: () =>
      characterReferenceNode.execute({
        input: currentInput,

        node: {
          type: "characterReference",
          config: {},
        },

        context,
      }),
  });

  console.log(
    "✅ Character reference processed"
  );


  /*
  |--------------------------------------------------------------------------
  | STEP 4 — IMAGE GENERATOR
  |--------------------------------------------------------------------------
  */

  console.log("\n4️⃣ IMAGE GENERATOR");
  console.log("--------------------------------");

  currentInput = await runTrackedStep({
    executionId,
    userId,

    nodeId: "imageGenerator",
    type: "imageGenerator",

    input: currentInput,

    execute: () =>
      imageGeneratorNode.execute({
        input: currentInput,

        node: {
          type: "imageGenerator",

          config: {
            size:
              process.env.OPENAI_IMAGE_SIZE ||
              "1024x1536",

            quality:
              process.env.OPENAI_IMAGE_QUALITY ||
              "auto",
          },
        },

        context,
      }),
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


  /*
  |--------------------------------------------------------------------------
  | STEP 5 — CAPTION + HASHTAGS
  |--------------------------------------------------------------------------
  */

  console.log("\n5️⃣ CAPTION + HASHTAGS");
  console.log("--------------------------------");

  currentInput = await runTrackedStep({
    executionId,
    userId,

    nodeId: "captionHashtag",
    type: "captionHashtag",

    input: currentInput,

    execute: () =>
      captionHashtagNode.execute({
        input: currentInput,

        node: {
          type: "captionHashtag",
          config: {},
        },

        context,
      }),
  });

  console.log(
    "✅ Caption and hashtags generated"
  );

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
      (
        Array.isArray(
          currentInput.hashtags
        )
          ? currentInput.hashtags.join(" ")
          : currentInput.hashtags
      ) ||
      "Hashtags not found"
  );


  /*
  |--------------------------------------------------------------------------
  | STEP 6 — LAARA
  |--------------------------------------------------------------------------
  |
  | Google Drive is the internal storage/output mechanism.
  | UI/execution pipeline calls this step "Laara".
  |
  |--------------------------------------------------------------------------
  */

  console.log("\n6️⃣ LAARA");
  console.log("--------------------------------");

  currentInput = await runTrackedStep({
    executionId,
    userId,

    nodeId: "laara",
    type: "laara",

    input: currentInput,

    execute: () =>
      googleDriveOutputNode.execute({
        input: currentInput,

        node: {
          type: "googleDriveOutput",
          config: {},
        },

        context,
      }),
  });

  console.log(
    "✅ Laara output prepared"
  );


  /*
  |--------------------------------------------------------------------------
  | STEP 7 — INSTAGRAM
  |--------------------------------------------------------------------------
  */

  console.log("\n7️⃣ INSTAGRAM");
  console.log("--------------------------------");

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


  currentInput = await runTrackedStep({
    executionId,
    userId,

    nodeId: "instagram",
    type: "instagram",

    input: currentInput,

    execute: () =>
      instagramNode.execute({
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
      }),
  });

  console.log(
    "✅ Instagram publishing completed"
  );


  /*
  |--------------------------------------------------------------------------
  | FINAL RESULT
  |--------------------------------------------------------------------------
  */

  console.log("");
  console.log(
    "============================================================"
  );

  console.log(
    "🎉 LAARA IMAGE REEL EMPLOYEE COMPLETED"
  );

  console.log(
    "============================================================"
  );


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