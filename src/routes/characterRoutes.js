const express = require("express");

const upload = require("../middleware/upload");

const {
  createCharacter,
  getCharacters,
  getCharacterById,
  updateCharacter,
  deleteCharacter
} = require("../controllers/characterController");

const router = express.Router();

router.post(
  "/",
  upload.single("referenceImage"),
  createCharacter
);

router.get(
  "/",
  getCharacters
);

router.get(
  "/:id",
  getCharacterById
);

router.put(
  "/:id",
  upload.single("referenceImage"),
  updateCharacter
);

router.delete(
  "/:id",
  deleteCharacter
);

module.exports = router;