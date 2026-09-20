const axios = require("axios");
const crypto = require("crypto");
const { google } = require("googleapis");
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

/* ============================================================
   GOOGLE DRIVE
============================================================ */

const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
  "profile",
];

const getGoogleDriveConfig = () => {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  };
};

const createGoogleOAuthClient = () => {
  const {
    clientId,
    clientSecret,
    redirectUri,
  } = getGoogleDriveConfig();

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    throw new Error(
      "GOOGLE_DRIVE_OAUTH_CONFIG_NOT_CONFIGURED"
    );
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
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
   START GOOGLE DRIVE OAUTH
============================================================ */

const startGoogleDriveOAuth = async (
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

    const oauth2Client =
      createGoogleOAuthClient();

    /*
     * Reuse the same signed state system.
     *
     * IMPORTANT:
     * Current state helper uses Instagram secret
     * as fallback. We will use a dedicated Google
     * secret if available.
     */

    const payload = {
      userId: String(userId),
      createdAt: Date.now(),
      nonce: crypto.randomBytes(24).toString("hex"),
      provider: "GOOGLE_DRIVE",
    };

    const encodedPayload =
      Buffer.from(
        JSON.stringify(payload),
        "utf8"
      ).toString("base64url");

    const stateSecret =
      process.env.GOOGLE_OAUTH_STATE_SECRET ||
      process.env.INSTAGRAM_OAUTH_STATE_SECRET ||
      process.env.INSTAGRAM_APP_SECRET;

    if (!stateSecret) {
      return res.status(500).json({
        success: false,
        message:
          "Google OAuth state secret is not configured.",
      });
    }

    const signature =
      crypto
        .createHmac(
          "sha256",
          stateSecret
        )
        .update(encodedPayload)
        .digest("base64url");

    const state =
      `${encodedPayload}.${signature}`;

    const authUrl =
      oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: GOOGLE_DRIVE_SCOPES,
        state,
      });

    return res.status(200).json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error(
      "Start Google Drive OAuth error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to start Google Drive connection.",
    });
  }
};

/* ============================================================
   GOOGLE DRIVE OAUTH CALLBACK
============================================================ */

const googleDriveOAuthCallback = async (
  req,
  res
) => {
  try {
    const {
      code,
      state,
      error,
      error_description,
    } = req.query;

    if (error) {
      console.log(
        "Google Drive OAuth denied:",
        {
          error,
          error_description,
        }
      );

      return res.redirect(
        "laara://google-drive-error"
      );
    }

    if (!code || !state) {
      return res.redirect(
        "laara://google-drive-error"
      );
    }

    /* ========================================================
       VERIFY STATE
    ======================================================== */

    const parts = state.split(".");

    if (parts.length !== 2) {
      return res.redirect(
        "laara://google-drive-error?reason=invalid_state"
      );
    }

    const [
      encodedPayload,
      receivedSignature,
    ] = parts;

    const stateSecret =
      process.env.GOOGLE_OAUTH_STATE_SECRET ||
      process.env.INSTAGRAM_OAUTH_STATE_SECRET ||
      process.env.INSTAGRAM_APP_SECRET;

    if (!stateSecret) {
      return res.redirect(
        "laara://google-drive-error?reason=server_config"
      );
    }

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          stateSecret
        )
        .update(encodedPayload)
        .digest("base64url");

    const receivedBuffer =
      Buffer.from(receivedSignature);

    const expectedBuffer =
      Buffer.from(expectedSignature);

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {
      return res.redirect(
        "laara://google-drive-error?reason=invalid_state"
      );
    }

    if (
      !crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      return res.redirect(
        "laara://google-drive-error?reason=invalid_state"
      );
    }

    let statePayload;

    try {
      statePayload =
        JSON.parse(
          Buffer.from(
            encodedPayload,
            "base64url"
          ).toString("utf8")
        );
    } catch {
      return res.redirect(
        "laara://google-drive-error?reason=invalid_state"
      );
    }

    if (
      !statePayload?.userId ||
      !statePayload?.createdAt ||
      !statePayload?.nonce ||
      statePayload?.provider !==
        "GOOGLE_DRIVE"
    ) {
      return res.redirect(
        "laara://google-drive-error?reason=invalid_state"
      );
    }

    const stateAge =
      Date.now() -
      Number(statePayload.createdAt);

    if (
      stateAge > OAUTH_STATE_TTL_MS
    ) {
      return res.redirect(
        "laara://google-drive-error?reason=expired_state"
      );
    }

    const userId =
      statePayload.userId;

    /* ========================================================
       EXCHANGE CODE
    ======================================================== */

    const oauth2Client =
      createGoogleOAuthClient();

    const {
      tokens,
    } =
      await oauth2Client.getToken(code);

    if (!tokens?.access_token) {
      throw new Error(
        "GOOGLE_ACCESS_TOKEN_MISSING"
      );
    }

    oauth2Client.setCredentials(
      tokens
    );

    /* ========================================================
       GET GOOGLE USER PROFILE
    ======================================================== */

    const oauth2 =
      google.oauth2({
        auth: oauth2Client,
        version: "v2",
      });

    const {
      data: profile,
    } =
      await oauth2.userinfo.get();

    if (!profile?.id) {
      throw new Error(
        "GOOGLE_PROFILE_MISSING"
      );
    }

    const accountId =
      String(profile.id);

    const accountName =
      profile.name || "";

    const username =
      profile.email || "";

    const profileImage =
      profile.picture || "";

    /* ========================================================
       TOKEN EXPIRY
    ======================================================== */

    const expiresAt =
      tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null;

    /* ========================================================
       SAVE CONNECTION
    ======================================================== */

    const updateData = {
      userId,

      platform:
        "GOOGLE_DRIVE",

      accountId,

      username,

      accountName,

      profileImage,

      accessToken:
        tokens.access_token,

      status:
        "CONNECTED",

      connectedAt:
        new Date(),

      expiresAt,

      metadata: {
        email:
          profile.email || "",
      },
    };

    /*
     * Google may not return a refresh token
     * every time if the user already authorized
     * the application.
     *
     * Therefore only overwrite refreshToken
     * when Google actually gives us one.
     */

    if (tokens.refresh_token) {
      updateData.refreshToken =
        tokens.refresh_token;
    }

    const connection =
      await Connection.findOne({
        userId,
        platform: "GOOGLE_DRIVE",
        accountId,
      });

    if (connection) {
      Object.assign(
        connection,
        updateData
      );

      await connection.save();
    } else {
      await Connection.create({
        ...updateData,
        refreshToken:
          tokens.refresh_token || "",
      });
    }

    console.log(
      "Google Drive connection saved:",
      {
        userId: String(userId),
        accountId,
        email: profile.email,
      }
    );

    return res.redirect(
      "laara://google-drive-connected"
    );
  } catch (error) {
    console.error(
      "Google Drive OAuth callback error:",
      error?.response?.data ||
        error?.message ||
        error
    );

    return res.redirect(
      "laara://google-drive-error"
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

  startGoogleDriveOAuth,
  googleDriveOAuthCallback,

  disconnectConnection,
};