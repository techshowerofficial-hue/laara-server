const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

const {
  createCharacter,
  getCharacters,
  getCharacterById,
  updateCharacter,
  deleteCharacter,
  getCharacterReferenceImage,
} = require("../controllers/characterController");

const router = express.Router();

// ============================================================
// AUTH
// ============================================================

router.use(authMiddleware);

// ============================================================
// CREATE CHARACTER
// ============================================================

router.post(
  "/",
  upload.single("referenceImage"),
  createCharacter
);

// ============================================================
// GET ALL CHARACTERS
// ============================================================

router.get(
  "/",
  getCharacters
);

// ============================================================
// GET CHARACTER REFERENCE IMAGE
// IMPORTANT: before /:id
// ============================================================

router.get(
  "/:id/reference-image",
  getCharacterReferenceImage
);

// ============================================================
// GET CHARACTER BY ID
// ============================================================

router.get(
  "/:id",
  getCharacterById
);

// ============================================================
// UPDATE CHARACTER
// ============================================================

router.put(
  "/:id",
  upload.single("referenceImage"),
  updateCharacter
);

// ============================================================
// DELETE CHARACTER
// ============================================================

router.delete(
  "/:id",
  deleteCharacter
);

module.exports = router;