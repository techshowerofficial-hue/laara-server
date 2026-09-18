const axios = require("axios");
const crypto = require("crypto");

const Connection = require("../models/Connection");
const Employee = require("../models/Employee");

/* ============================================================
   CONFIG
============================================================ */

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
];

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/* ============================================================
   HELPERS
============================================================ */

const getUserId = (req) => {
  return req?.user?.userId;
};

const getInstagramConfig = () => {
  return {
    clientId: process.env.INSTAGRAM_APP_ID,
    clientSecret: process.env.INSTAGRAM_APP_SECRET,
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI,
  };
};

/*
 * IMPORTANT:
 * State is signed using HMAC so the userId cannot simply
 * be modified by changing the Base64 string.
 *
 * For production, Redis/DB based one-time state storage
 * is even better. For now this gives us a proper signed state.
 */

const createOAuthState = (userId) => {
  const payload = {
    userId: String(userId),
    createdAt: Date.now(),
    nonce: crypto.randomBytes(24).toString("hex"),
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8"
  ).toString("base64url");

  const secret =
    process.env.INSTAGRAM_OAUTH_STATE_SECRET ||
    process.env.INSTAGRAM_APP_SECRET;

  if (!secret) {
    throw new Error("INSTAGRAM_OAUTH_STATE_SECRET_NOT_CONFIGURED");
  }

  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
};

const verifyOAuthState = (state) => {
  if (!state || typeof state !== "string") {
    throw new Error("INVALID_OAUTH_STATE");
  }

  const parts = state.split(".");

  if (parts.length !== 2) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  const [encodedPayload, receivedSignature] = parts;

  const secret =
    process.env.INSTAGRAM_OAUTH_STATE_SECRET ||
    process.env.INSTAGRAM_APP_SECRET;

  if (!secret) {
    throw new Error("INSTAGRAM_OAUTH_STATE_SECRET_NOT_CONFIGURED");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  const receivedBuffer = Buffer.from(
    receivedSignature
  );

  const expectedBuffer = Buffer.from(
    expectedSignature
  );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  if (
    !crypto.timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    )
  ) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(
        encodedPayload,
        "base64url"
      ).toString("utf8")
    );
  } catch (error) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  if (
    !payload?.userId ||
    !payload?.createdAt ||
    !payload?.nonce
  ) {
    throw new Error("INVALID_OAUTH_STATE");
  }

  if (
    Date.now() -
      Number(payload.createdAt) >
    OAUTH_STATE_TTL_MS
  ) {
    throw new Error("OAUTH_STATE_EXPIRED");
  }

  return payload;
};

/* ============================================================
   GET ALL CONNECTIONS
============================================================ */

const getConnections = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const connections =
      await Connection.find({
        userId,
      })
        .select(
          "_id platform accountId username accountName profileImage status connectedAt expiresAt createdAt updatedAt"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      connections,
    });
  } catch (error) {
    console.error(
      "Get connections error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load connections.",
    });
  }
};

/* ============================================================
   GET SINGLE CONNECTION
============================================================ */

const getConnectionById = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);
    const connectionId =
      req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const connection =
      await Connection.findOne({
        _id: connectionId,
        userId,
      })
        .select(
          "_id platform accountId username accountName profileImage status connectedAt expiresAt createdAt updatedAt"
        )
        .lean();

    if (!connection) {
      return res.status(404).json({
        success: false,
        message:
          "Connection not found.",
      });
    }

    return res.status(200).json({
      success: true,
      connection,
    });
  } catch (error) {
    console.error(
      "Get connection error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load connection.",
    });
  }
};

/* ============================================================
   START INSTAGRAM OAUTH
============================================================ */

const startInstagramOAuth = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const {
      clientId,
      redirectUri,
    } = getInstagramConfig();

    if (!clientId) {
      return res.status(500).json({
        success: false,
        message:
          "Instagram App ID is not configured on the server.",
      });
    }

    if (!redirectUri) {
      return res.status(500).json({
        success: false,
        message:
          "Instagram redirect URI is not configured on the server.",
      });
    }

    /*
     * Create signed OAuth state.
     */

    const state =
      createOAuthState(userId);

    /*
     * Build Instagram Login URL.
     */

    const params =
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope:
          INSTAGRAM_SCOPES.join(","),
        state,
      });

    const authUrl =
      `https://www.instagram.com/oauth/authorize?${params.toString()}`;

    console.log(
      "Instagram OAuth started for user:",
      String(userId)
    );

    return res.status(200).json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error(
      "Start Instagram OAuth error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to start Instagram connection.",
    });
  }
};

/* ============================================================
   INSTAGRAM OAUTH CALLBACK
============================================================ */

const instagramOAuthCallback = async (
  req,
  res
) => {
  try {
    const {
      code,
      state,
      error,
      error_reason,
      error_description,
    } = req.query;

    /*
     * User denied Instagram authorization.
     */

    if (error) {
      console.log(
        "Instagram OAuth denied:",
        {
          error,
          error_reason,
          error_description,
        }
      );

      return res.redirect(
        "laara://instagram-error"
      );
    }

    if (!code || !state) {
      console.error(
        "Instagram callback missing code/state."
      );

      return res.redirect(
        "laara://instagram-error"
      );
    }

    /*
     * Verify OAuth state.
     */

    let statePayload;

    try {
      statePayload =
        verifyOAuthState(state);
    } catch (stateError) {
      console.error(
        "Instagram OAuth state error:",
        stateError.message
      );

      return res.redirect(
        "laara://instagram-error?reason=invalid_state"
      );
    }

    const userId =
      statePayload.userId;

    /*
     * Get configuration.
     */

    const {
      clientId,
      clientSecret,
      redirectUri,
    } = getInstagramConfig();

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      console.error(
        "Instagram OAuth configuration missing."
      );

      return res.redirect(
        "laara://instagram-error?reason=server_config"
      );
    }

    /* ========================================================
       STEP 1
       Exchange authorization code for short-lived token
    ======================================================== */

    console.log(
      "Instagram OAuth: exchanging authorization code..."
    );

    const tokenBody =
      new URLSearchParams();

    tokenBody.append(
      "client_id",
      clientId
    );

    tokenBody.append(
      "client_secret",
      clientSecret
    );

    tokenBody.append(
      "grant_type",
      "authorization_code"
    );

    tokenBody.append(
      "redirect_uri",
      redirectUri
    );

    tokenBody.append(
      "code",
      code
    );

    const tokenResponse =
      await axios.post(
        "https://api.instagram.com/oauth/access_token",
        tokenBody.toString(),
        {
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          timeout: 20000,
        }
      );

    const shortLivedToken =
      tokenResponse?.data?.access_token;

    if (!shortLivedToken) {
      throw new Error(
        "INSTAGRAM_SHORT_TOKEN_MISSING"
      );
    }

    const instagramUserId =
      tokenResponse?.data?.user_id;

    console.log(
      "Instagram short-lived token received."
    );

    /* ========================================================
       STEP 2
       Exchange short-lived token for long-lived token
    ======================================================== */

    console.log(
      "Instagram OAuth: exchanging for long-lived token..."
    );

    const longTokenResponse =
      await axios.get(
        "https://graph.instagram.com/access_token",
        {
          params: {
            grant_type:
              "ig_exchange_token",

            client_secret:
              clientSecret,

            access_token:
              shortLivedToken,
          },

          timeout: 20000,
        }
      );

    const longLivedToken =
      longTokenResponse?.data?.access_token;

    const expiresIn =
      Number(
        longTokenResponse?.data?.expires_in || 0
      );

    if (!longLivedToken) {
      throw new Error(
        "INSTAGRAM_LONG_TOKEN_MISSING"
      );
    }

    console.log(
      "Instagram long-lived token received."
    );

    /* ========================================================
       STEP 3
       Fetch Instagram profile
    ======================================================== */

    console.log(
      "Instagram OAuth: fetching profile..."
    );

    const profileResponse =
      await axios.get(
        "https://graph.instagram.com/me",
        {
          params: {
            fields:
              "id,username,name,profile_picture_url",

            access_token:
              longLivedToken,
          },

          timeout: 20000,
        }
      );

    const profile =
      profileResponse?.data;

    if (!profile?.id) {
      throw new Error(
        "INSTAGRAM_PROFILE_MISSING"
      );
    }

    const accountId =
      String(profile.id);

    const username =
      profile.username || "";

    const accountName =
      profile.name || "";

    const profileImage =
      profile.profile_picture_url || "";

    /* ========================================================
       STEP 4
       Calculate token expiry
    ======================================================== */

    const expiresAt =
      expiresIn > 0
        ? new Date(
            Date.now() +
              expiresIn * 1000
          )
        : null;

    /* ========================================================
       STEP 5
       Save REAL Instagram connection
    ======================================================== */

    const connection =
      await Connection.findOneAndUpdate(
        {
          userId,
          platform: "INSTAGRAM",
          accountId,
        },
        {
          $set: {
            userId,

            platform:
              "INSTAGRAM",

            accountId,

            username,

            accountName,

            profileImage,

            /*
             * IMPORTANT:
             * accessToken has select:false
             * in Connection schema, but it is
             * still stored here.
             */

            accessToken:
              longLivedToken,

            status:
              "CONNECTED",

            connectedAt:
              new Date(),

            expiresAt,
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    console.log(
      "Instagram connection saved:",
      {
        connectionId:
          connection?._id
            ?.toString(),

        userId:
          String(userId),

        instagramUserId:
          accountId,

        username,
      }
    );

    /* ========================================================
       STEP 6
       Redirect back to Laara app
    ======================================================== */

    return res.redirect(
      "laara://instagram-connected"
    );
  } catch (error) {
    console.error(
      "Instagram OAuth callback error:",
      error?.response?.data ||
        error?.message ||
        error
    );

    return res.redirect(
      "laara://instagram-error"
    );
  }
};

/* ============================================================
   DISCONNECT CONNECTION
============================================================ */

const disconnectConnection = async (
  req,
  res
) => {
  try {
    const userId = getUserId(req);

    const connectionId =
      req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const connection =
      await Connection.findOne({
        _id: connectionId,
        userId,
      });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message:
          "Connection not found.",
      });
    }

    /*
     * Remove this connection from
     * any employee that is using it.
     */

    await Employee.updateMany(
      {
        userId,

        "connections.instagramConnectionId":
          connection._id,
      },
      {
        $set: {
          "connections.instagramConnectionId":
            null,
        },
      }
    );

    /*
     * Delete the actual stored connection.
     */

    await Connection.deleteOne({
      _id: connection._id,
      userId,
    });

    return res.status(200).json({
      success: true,
      message:
        "Connection disconnected successfully.",
    });
  } catch (error) {
    console.error(
      "Disconnect connection error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to disconnect connection.",
    });
  }
};

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  getConnections,
  getConnectionById,
  startInstagramOAuth,
  instagramOAuthCallback,
  disconnectConnection,
};