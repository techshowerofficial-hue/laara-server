const express = require("express");

const authMiddleware =
  require("../middleware/authMiddleware");

const {
  getAnalyticsOverview,
} = require("../controllers/analyticsController");

const router =
  express.Router();


// ========================================
// AUTHENTICATION
// ========================================

router.use(
  authMiddleware
);


// ========================================
// ANALYTICS OVERVIEW
// ========================================

router.get(
  "/overview",
  getAnalyticsOverview
);


module.exports =
  router;