const {
  uploadGeneratedImage,
} = require("../../services/googleDriveService");

const path = require("path");

const execute = async ({
  input,
  node,
  context,
}) => {
  if (!context?.userId) {
    throw new Error(
      "Google Drive Output: userId is missing"
    );
  }

  if (!context?.employeeId) {
    throw new Error(
      "Google Drive Output: employeeId is missing"
    );
  }

  const generatedPath =
    input?.generatedPath;

  if (!generatedPath) {
    throw new Error(
      "Google Drive Output: generated image path is missing"
    );
  }

  const employee =
    context?.employee || {};

  const employeeName =
    employee.name ||
    "Employee";

  console.log("\n");
  console.log(
    "================================================"
  );
  console.log(
    "☁️ GOOGLE DRIVE OUTPUT"
  );
  console.log(
    "================================================"
  );

  console.log("\nEmployee:");
  console.log(employeeName);

  console.log("\nGenerated Path:");
  console.log(generatedPath);

  const extension =
    path.extname(generatedPath)
      .toLowerCase();

  let mimeType =
    "image/png";

  if (extension === ".jpg" ||
      extension === ".jpeg") {
    mimeType =
      "image/jpeg";
  }

  if (extension === ".webp") {
    mimeType =
      "image/webp";
  }

  const fileName =
    `image-${Date.now()}${extension || ".png"}`;

  const result =
    await uploadGeneratedImage({
      userId:
        context.userId,

      employeeId:
        context.employeeId,

      employeeName,

      employeeType:
        employee.type ||
        "IMAGE_REEL",
employeeStorage: employee.storage || null,
      filePath:
        generatedPath,

      fileName,

      mimeType,
    });

  console.log("\n✅ IMAGE SAVED TO GOOGLE DRIVE");

  console.log(
    "File ID:",
    result.fileId
  );

  console.log(
    "File Name:",
    result.fileName
  );

  console.log(
    "Folder ID:",
    result.folderId
  );

  console.log(
    "================================================"
  );

  return {
    ...input,

    googleDrive: {
      success: true,

      fileId:
        result.fileId,

      fileName:
        result.fileName,

      mimeType:
        result.mimeType,

      folderId:
        result.folderId,

      createdTime:
        result.createdTime,

      webViewLink:
        result.webViewLink,

        publicUrl:
  result.publicUrl,
    },

    driveFileId:
      result.fileId,
  };
};

module.exports = {
  execute,
};