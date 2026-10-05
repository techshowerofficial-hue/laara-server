const express = require("express");

const router =
  express.Router();

const {
  getAvailableSubjects,
  startStudy,
  openStudyPdf,
} =
  require("../controllers/studyController");

const auth =
  require("../middleware/authMiddleware");


router.get(
  "/subjects",
  auth,
  getAvailableSubjects
);


router.post(
  "/start",
  auth,
  startStudy
);


router.get(
  "/notes/:subject/:fileId",
  auth,
  openStudyPdf
);


module.exports = router;