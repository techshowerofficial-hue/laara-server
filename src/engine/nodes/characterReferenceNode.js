const Employee = require("../../models/Employee");
const Character = require("../../models/Character");
const {
  downloadCharacterReference,
} = require("../../services/googleDriveService");

const execute = async ({ input, context }) => {
  if (!context?.userId) {
    throw new Error(
      "Character Reference: userId is missing"
    );
  }

  if (!context?.employeeId) {
    throw new Error(
      "Character Reference: employeeId is missing"
    );
  }

  const employee = await Employee.findOne({
    _id: context.employeeId,
    userId: context.userId,
  }).lean();

  if (!employee) {
    throw new Error(
      "Character Reference: Employee not found"
    );
  }

  if (!employee.characterId) {
    console.log(
      "🎭 No character configured"
    );

    return {
      ...input,

      characterReference: {
        enabled: false,
      },
    };
  }

  const character = await Character.findOne({
    _id: employee.characterId,
    userId: context.userId,
    status: "active",
  }).lean();

  if (!character) {
    throw new Error(
      "Character Reference: Character not found"
    );
  }

  const fileId =
    character.referenceImage?.driveFileId;

  if (!fileId) {
    throw new Error(
      "Character Reference: Reference image not found"
    );
  }

  const imageBuffer =
    await downloadCharacterReference({
      userId: context.userId,
      fileId,
    });

  const mimeType =
    character.referenceImage?.mimeType ||
    "image/jpeg";

  const base64 =
    imageBuffer.toString("base64");

  const dataUrl =
    `data:${mimeType};base64,${base64}`;

  console.log(
    "\n🎭 CHARACTER REFERENCE LOADED"
  );

  console.log(
    "Character:",
    character.name
  );

  console.log(
    "Reference image:",
    character.referenceImage?.name
  );

  return {
    ...input,

    character: {
      id: character._id,
      name: character.name,
      description:
        character.description || "",
    },

    characterReference: {
      enabled: true,
      name: character.name,
      mimeType,
      dataUrl,
      driveFileId: fileId,
    },
  };
};

module.exports = {
  execute,
};