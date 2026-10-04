const express = require("express");
const { google } = require("googleapis");

const router = express.Router();

const MASTER_REDIRECT_URI =
  "https://laara-server.onrender.com/api/master-drive/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

// ============================================================
// START MASTER DRIVE OAUTH
// ============================================================

router.get("/auth", (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      MASTER_REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });

    res.redirect(authUrl);
  } catch (error) {
    console.error("MASTER DRIVE AUTH ERROR:", error);

    res.status(500).send(
      "Master Drive authorization failed"
    );
  }
});

// ============================================================
// MASTER DRIVE OAUTH CALLBACK
// ============================================================

router.get("/callback", async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.status(400).send(
        `Google authorization failed: ${error}`
      );
    }

    if (!code) {
      return res.status(400).send(
        "Authorization code missing"
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      MASTER_REDIRECT_URI
    );

    const { tokens } =
      await oauth2Client.getToken(code);

    console.log(
      "MASTER GOOGLE TOKENS RECEIVED"
    );

    console.log(
      "Refresh token:",
      tokens.refresh_token
    );

    res.send(`
      <h2>Master Google Drive Connected ✅</h2>
      <p>Refresh token received.</p>
      <p>Check your backend console.</p>
    `);
  } catch (error) {
    console.error(
      "MASTER DRIVE CALLBACK ERROR:",
      error?.response?.data || error.message
    );

    res.status(500).send(
      "Master Drive callback failed"
    );
  }
});

module.exports = router;