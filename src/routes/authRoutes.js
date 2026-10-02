const express = require("express");

const {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  resetPasswordLink
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", register);

router.post("/login", login);

router.post("/forgot-password", forgotPassword);

router.get("/reset-password-link", resetPasswordLink);

router.post("/reset-password", resetPassword);

router.get("/me", authMiddleware, getMe);

module.exports = router;