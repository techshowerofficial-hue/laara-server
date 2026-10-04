const express = require("express");
const { startStudy } = require("../controllers/studyController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/start", authMiddleware, startStudy);

module.exports = router;