const Character = require("../models/Character");

const resolveCharacter = async (characterId) => {
  if (!characterId) {
    throw new Error("characterId is required");
  }

  const character = await Character.findOne({
    _id: characterId,
    status: "active"
  }).select(
    "_id name description referenceImage"
  );

  if (!character) {
    throw new Error("Character not found");
  }

  if (
    !character.referenceImage ||
    !character.referenceImage.url
  ) {
    throw new Error(
      "Character reference image not found"
    );
  }

  return {
    id: character._id.toString(),
    name: character.name,
    description: character.description,
    referenceImage: {
      name: character.referenceImage.name,
      url: character.referenceImage.url,
      publicId: character.referenceImage.publicId
    }
  };
};

module.exports = {
  resolveCharacter
};