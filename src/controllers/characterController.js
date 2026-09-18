const Character = require("../models/Character");

const {
  uploadImage,
  deleteImage
} = require("../services/cloudinaryService");

const createCharacter = async (
  req,
  res
) => {
  try {
    const {
      name,
      description = ""
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Character name is required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "Reference image is required"
      });
    }

    const uploadedImage =
      await uploadImage(
        req.file.buffer,
        {
          folder:
            "laara/characters"
        }
      );

  const userId = req.user?.userId;

if (!userId) {
  return res.status(401).json({
    success: false,
    message: "Unauthorized"
  });
}

const character =
  await Character.create({
    userId,

    name: name.trim(),

    description,

    referenceImage: {
      name: req.file.originalname,

      url: uploadedImage.secure_url,

      publicId:
        uploadedImage.public_id
    }
  });

    res.status(201).json({
      success: true,

      character: {
        id: character._id,
        name: character.name,
        description:
          character.description,

        referenceImage: {
          name:
            character.referenceImage.name,

          url:
            character.referenceImage.url
        },

        status: character.status,

        createdAt:
          character.createdAt
      }
    });
  } catch (error) {
    console.error(
      "Create character error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to create character"
    });
  }
};

const getCharacters = async (
  req,
  res
) => {
  try {
 const userId = req.user?.userId;

if (!userId) {
  return res.status(401).json({
    success: false,
    message: "Unauthorized"
  });
}

const characters =
  await Character.find({
    userId,
    status: "active"
  })
        .select(
          "_id name description referenceImage.name referenceImage.url status createdAt updatedAt"
        )
        .sort({
          createdAt: -1
        });

    res.json({
      success: true,
      characters
    });
  } catch (error) {
    console.error(
      "Get characters error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch characters"
    });
  }
};

const getCharacterById =
  async (req, res) => {
    try {
      const character =
        await Character.findOne({
          _id: req.params.id,
          status: "active"
        }).select(
          "_id name description referenceImage.name referenceImage.url status createdAt updatedAt"
        );

      if (!character) {
        return res.status(404).json({
          success: false,
          message:
            "Character not found"
        });
      }

      res.json({
        success: true,
        character
      });
    } catch (error) {
      console.error(
        "Get character error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to fetch character"
      });
    }
  };

const updateCharacter =
  async (req, res) => {
    try {
      const character =
        await Character.findOne({
          _id: req.params.id,
          status: "active"
        });

      if (!character) {
        return res.status(404).json({
          success: false,
          message:
            "Character not found"
        });
      }

      if (req.body.name) {
        character.name =
          req.body.name.trim();
      }

      if (
        req.body.description !==
        undefined
      ) {
        character.description =
          req.body.description;
      }

      if (req.file) {
        const oldPublicId =
          character.referenceImage
            .publicId;

        const uploadedImage =
          await uploadImage(
            req.file.buffer,
            {
              folder:
                "laara/characters"
            }
          );

        character.referenceImage = {
          name:
            req.file.originalname,

          url:
            uploadedImage.secure_url,

          publicId:
            uploadedImage.public_id
        };

        await deleteImage(
          oldPublicId
        );
      }

      await character.save();

      res.json({
        success: true,

        character: {
          id: character._id,
          name: character.name,
          description:
            character.description,

          referenceImage: {
            name:
              character.referenceImage
                .name,

            url:
              character.referenceImage
                .url
          },

          status: character.status
        }
      });
    } catch (error) {
      console.error(
        "Update character error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to update character"
      });
    }
  };

const deleteCharacter =
  async (req, res) => {
    try {
      const character =
        await Character.findOne({
          _id: req.params.id,
          status: "active"
        });

      if (!character) {
        return res.status(404).json({
          success: false,
          message:
            "Character not found"
        });
      }

      const publicId =
        character.referenceImage
          .publicId;

      character.status =
        "inactive";

      await character.save();

      await deleteImage(
        publicId
      );

      res.json({
        success: true,
        message:
          "Character deleted successfully"
      });
    } catch (error) {
      console.error(
        "Delete character error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to delete character"
      });
    }
  };

module.exports = {
  createCharacter,
  getCharacters,
  getCharacterById,
  updateCharacter,
  deleteCharacter
};