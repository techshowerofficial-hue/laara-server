const Character = require("../models/Character");
const {
  uploadCharacterToLibrary,
  downloadCharacterReference,
} = require("../services/googleDriveService");
// ============================================================
// CREATE CHARACTER
// ============================================================

const createCharacter = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      name,
      description = "",
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Character name is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Reference image is required",
      });
    }

    // --------------------------------------------------------
    // 1. CREATE CHARACTER ID FIRST
    // --------------------------------------------------------

    const character =
      new Character({
        userId,

        name: name.trim(),

        description:
          description?.trim() || "",

        referenceImage: {
          name:
            req.file.originalname,

          driveFileId: null,

          driveFolderId: null,

          mimeType:
            req.file.mimetype,
        },
      });

    await character.save();

    // --------------------------------------------------------
    // 2. UPLOAD IMAGE TO GOOGLE DRIVE
    // --------------------------------------------------------

    try {
      const driveFile =
        await uploadCharacterToLibrary({
          userId,

          characterId:
            character._id,

          characterName:
            character.name,

          fileName:
            req.file.originalname,

          buffer:
            req.file.buffer,

          mimeType:
            req.file.mimetype,
        });

      // ------------------------------------------------------
      // 3. SAVE DRIVE DETAILS
      // ------------------------------------------------------

      character.referenceImage.driveFileId =
        driveFile.fileId;

      character.referenceImage.driveFolderId =
        driveFile.folderId;

      character.referenceImage.mimeType =
        driveFile.mimeType;

      await character.save();

    } catch (driveError) {
      // Character bana tha but Drive upload fail hua
      // Isliye incomplete character nahi rakhenge.

      await Character.findByIdAndDelete(
        character._id
      );

      console.error(
        "Character Drive upload error:",
        driveError
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to upload character reference to Google Drive",
      });
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(201).json({
      success: true,

      character: {
        id: character._id,

        name:
          character.name,

        description:
          character.description,

        referenceImage: {
          name:
            character.referenceImage.name,

          driveFileId:
            character.referenceImage.driveFileId,

          driveFolderId:
            character.referenceImage.driveFolderId,

          mimeType:
            character.referenceImage.mimeType,
        },

        status:
          character.status,

        createdAt:
          character.createdAt,
      },
    });

  } catch (error) {
    console.error(
      "Create character error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create character",
    });
  }
};


// ============================================================
// GET CHARACTERS
// ============================================================

const getCharacters = async (
  req,
  res
) => {
  try {
    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const characters =
      await Character.find({
        userId,
        status: "active",
      })
        .select(
          "_id name description referenceImage.name referenceImage.driveFileId referenceImage.driveFolderId referenceImage.mimeType status createdAt updatedAt"
        )
        .sort({
          createdAt: -1,
        });

    return res.json({
      success: true,
      characters,
    });

  } catch (error) {
    console.error(
      "Get characters error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch characters",
    });
  }
};


// ============================================================
// GET CHARACTER BY ID
// ============================================================

const getCharacterById = async (
  req,
  res
) => {
  try {
    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const character =
      await Character.findOne({
        _id: req.params.id,
        userId,
        status: "active",
      }).select(
        "_id name description referenceImage.name referenceImage.driveFileId referenceImage.driveFolderId referenceImage.mimeType status createdAt updatedAt"
      );

    if (!character) {
      return res.status(404).json({
        success: false,
        message:
          "Character not found",
      });
    }

    return res.json({
      success: true,
      character,
    });

  } catch (error) {
    console.error(
      "Get character error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch character",
    });
  }
};


// ============================================================
// UPDATE CHARACTER
// ============================================================

const updateCharacter = async (
  req,
  res
) => {
  try {
    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const character =
      await Character.findOne({
        _id: req.params.id,
        userId,
        status: "active",
      });

    if (!character) {
      return res.status(404).json({
        success: false,
        message:
          "Character not found",
      });
    }

    if (
      req.body.name !== undefined
    ) {
      if (!req.body.name.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Character name is required",
        });
      }

      character.name =
        req.body.name.trim();
    }

    if (
      req.body.description !==
      undefined
    ) {
      character.description =
        req.body.description.trim();
    }

    /*
     * Reference image update abhi
     * intentionally nahi kar rahe.
     *
     * Pehle MVP create + Drive flow
     * properly test karenge.
     */

    await character.save();

    return res.json({
      success: true,
      character,
    });

  } catch (error) {
    console.error(
      "Update character error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update character",
    });
  }
};


// ============================================================
// DELETE CHARACTER
// ============================================================

const deleteCharacter = async (
  req,
  res
) => {
  try {
    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const character =
      await Character.findOne({
        _id: req.params.id,
        userId,
        status: "active",
      });

    if (!character) {
      return res.status(404).json({
        success: false,
        message:
          "Character not found",
      });
    }

    character.status =
      "inactive";

    await character.save();

    return res.json({
      success: true,
      message:
        "Character deleted successfully",
    });

  } catch (error) {
    console.error(
      "Delete character error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete character",
    });
  }
};

const getCharacterReferenceImage = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const character = await Character.findOne({
      _id: req.params.id,
      userId,
      status: "active",
    });

    if (!character) {
      return res.status(404).json({
        success: false,
        message: "Character not found",
      });
    }

    const fileId = character.referenceImage?.driveFileId;

    if (!fileId) {
      return res.status(404).json({
        success: false,
        message: "Character reference image not found",
      });
    }

    const imageBuffer = await downloadCharacterReference({
      userId,
      fileId,
    });

    const mimeType =
      character.referenceImage?.mimeType || "image/jpeg";

    const base64 = imageBuffer.toString("base64");

    const image = `data:${mimeType};base64,${base64}`;

    return res.json({
      success: true,
      image,
    });
  } catch (error) {
    console.error("Get character reference image error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load character reference image",
    });
  }
};
// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createCharacter,
  getCharacters,
  getCharacterById,
  updateCharacter,
  deleteCharacter,

  getCharacterReferenceImage,
};