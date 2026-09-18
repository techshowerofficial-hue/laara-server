const express = require("express");

const {
  createCredential,
  getCredentials,
  deleteCredential
} = require("../controllers/credentialController");

const router = express.Router();

router.post(
  "/",
  createCredential
);

router.get(
  "/",
  getCredentials
);

router.delete(
  "/:id",
  deleteCredential
);

module.exports = router;