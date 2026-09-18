const express = require("express");

const {
  getConnections,
  getConnectionById,
  startInstagramOAuth,
  instagramOAuthCallback,
  disconnectConnection,
} = require("../controllers/connectionController.js");

const authMiddleware = require("../middleware/authMiddleware.js");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Instagram OAuth
|--------------------------------------------------------------------------
*/

/*
 * IMPORTANT:
 * Instagram specific routes MUST come before /:id
 * otherwise Express can treat "instagram" as an ID.
 */

/*
 * Start Instagram OAuth
 *
 * GET /api/connections/instagram/start
 */
router.get(
  "/instagram/start",
  authMiddleware,
  startInstagramOAuth
);

/*
 * Instagram OAuth callback
 *
 * GET /api/connections/instagram/callback
 *
 * No auth middleware here because Instagram/Meta
 * redirects the browser to this endpoint.
 */
router.get(
  "/instagram/callback",
  instagramOAuthCallback
);

/*
|--------------------------------------------------------------------------
| User Connections
|--------------------------------------------------------------------------
*/

/*
 * Get all logged-in user's connections
 *
 * GET /api/connections
 */
router.get(
  "/",
  authMiddleware,
  getConnections
);

/*
 * Get one connection
 *
 * GET /api/connections/:id
 */
router.get(
  "/:id",
  authMiddleware,
  getConnectionById
);

/*
|--------------------------------------------------------------------------
| Disconnect
|--------------------------------------------------------------------------
*/

/*
 * DELETE /api/connections/:id
 */
router.delete(
  "/:id",
  authMiddleware,
  disconnectConnection
);

module.exports = router;