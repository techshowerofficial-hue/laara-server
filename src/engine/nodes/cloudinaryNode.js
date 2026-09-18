const fs =
  require("fs");

const path =
  require("path");

const cloudinary =
  require("../../config/cloudinary");

const {
  resolveMappings,
} = require("../../utils/dataMapper");

const execute = async ({
  input,
  node,
  context,
}) => {
  const config =
    node?.config || {};

  const userId =
    context?.userId || null;

  const employeeId =
    context?.employeeId || null;

  const executionId =
    context?.executionId || null;

  console.log(
    "========== CLOUDINARY NODE =========="
  );

  console.log(
    "USER:",
    userId
  );

  console.log(
    "EMPLOYEE:",
    employeeId
  );

  console.log(
    "EXECUTION:",
    executionId
  );

  // ========================================
  // IMAGE PATH
  // ========================================

  let imagePath =
    resolveMappings(
      config.imagePath || "",
      input
    );

  if (!imagePath) {
    imagePath =
      input?.generatedPath ||
      input?.data?.generatedPath;
  }

  // ========================================
  // GENERATED FILE FALLBACK
  // ========================================

  const generatedFile =
    input?.generatedFile ||
    input?.data?.generatedFile;

  if (
    (!imagePath ||
      !fs.existsSync(imagePath)) &&
    generatedFile
  ) {
    imagePath =
      path.join(
        process.cwd(),
        "generated",
        generatedFile
      );
  }

  console.log(
    "CLOUDINARY IMAGE PATH:",
    imagePath
  );

  // ========================================
  // VALIDATION
  // ========================================

  if (!imagePath) {
    throw new Error(
      "Cloudinary image path is required"
    );
  }

  if (
    !fs.existsSync(imagePath)
  ) {
    throw new Error(
      `Image file not found: ${imagePath}`
    );
  }

  // ========================================
  // FOLDER
  // ========================================

  const folder =
    resolveMappings(
      config.folder || "",
      input
    ) ||
    "laara/generated";

  console.log(
    "CLOUDINARY FOLDER:",
    folder
  );

  // ========================================
  // UPLOAD
  // ========================================

  console.log(
    "CLOUDINARY UPLOADING..."
  );

  const result =
    await cloudinary.uploader.upload(
      imagePath,
      {
        folder,

        resource_type:
          "image",
      }
    );

  console.log(
    "CLOUDINARY UPLOAD SUCCESS:",
    result.secure_url
  );

  // ========================================
  // OUTPUT
  // ========================================

  return {
    ...input,

    cloudinary: {
      publicId:
        result.public_id,

      url:
        result.url,

      secureUrl:
        result.secure_url,

      format:
        result.format,

      width:
        result.width,

      height:
        result.height,

      resourceType:
        result.resource_type,
    },

    cloudinaryUrl:
      result.secure_url,

    cloudinaryPublicId:
      result.public_id,

    employeeId,

    executionId,
  };
};

module.exports = {
  execute,
};