const { google } = require("googleapis");

const getMasterDriveClient = async () => {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  const refreshToken =
    process.env.LAARA_MASTER_GOOGLE_REFRESH_TOKEN;

  if (!clientId) {
    throw new Error(
      "GOOGLE_CLIENT_ID_NOT_CONFIGURED"
    );
  }

  if (!clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_SECRET_NOT_CONFIGURED"
    );
  }

  if (!refreshToken) {
    throw new Error(
      "LAARA_MASTER_GOOGLE_REFRESH_TOKEN_NOT_CONFIGURED"
    );
  }

  const oauth2Client =
    new google.auth.OAuth2(
      clientId,
      clientSecret
    );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const drive = google.drive({
    version: "v3",
    auth: oauth2Client,
  });

  return drive;
};

module.exports = {
  getMasterDriveClient,
};