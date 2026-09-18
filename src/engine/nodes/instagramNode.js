const {
  resolveMappings,
} = require("../../utils/dataMapper");

const Connection =
  require("../../models/Connection");

const execute = async ({
  input,
  node,
  context,
}) => {
  const config =
    node?.config || {};

  const userId =
    context?.userId;

  const employeeId =
    context?.employeeId;

  const executionId =
    context?.executionId;

  // ========================================
  // CONTEXT
  // ========================================

  if (!userId) {
    throw new Error(
      "Instagram node requires authenticated user context"
    );
  }

  if (!employeeId) {
    throw new Error(
      "Instagram node requires employee context"
    );
  }

  // ========================================
  // CONNECTION
  // ========================================

  const connectionId =
    config.connectionId ||
    config.instagramConnectionId;

  if (!connectionId) {
    throw new Error(
      "Instagram connection is required"
    );
  }

  const connection =
    await Connection.findOne({
      _id:
        connectionId,

      userId,

      platform:
        "INSTAGRAM",
    }).select(
      "+accessToken +refreshToken"
    );

  if (!connection) {
    throw new Error(
      "Instagram connection not found"
    );
  }

  // ========================================
  // STATUS
  // ========================================

  if (
    connection.status !==
    "CONNECTED"
  ) {
    throw new Error(
      `Instagram connection is ${String(
        connection.status ||
        "UNKNOWN"
      ).toLowerCase()}`
    );
  }

  // ========================================
  // TOKEN
  // ========================================

  const accessToken =
    connection.accessToken;

    console.log("[Instagram] Token exists:", !!accessToken);
console.log("[Instagram] Token length:", accessToken?.length);
console.log("[Instagram] Token prefix:", accessToken?.slice(0, 12));
  if (!accessToken) {
    throw new Error(
      "Instagram access token not found"
    );
  }

  // ========================================
  // INSTAGRAM USER ID
  // ========================================

  const igUserId =
    connection.accountId;

  if (!igUserId) {
    throw new Error(
      "Instagram account ID not found"
    );
  }

  // ========================================
  // IMAGE URL
  // ========================================

const imageUrl =
  input?.imageUrl ||
  resolveMappings(
    config.imageUrl || "",
    input
  );

if (!imageUrl) {
  throw new Error(
    "Instagram image URL is required"
  );
}

  // ========================================
  // CAPTION
  // ========================================
const caption =
  input?.caption ||
  resolveMappings(
    config.caption || "",
    input
  ) ||
  "";
  // ========================================
  // HASHTAGS
  // ========================================

const hashtags =
  Array.isArray(input?.hashtags)
    ? input.hashtags.join(" ")
    : input?.hashtags ||
      resolveMappings(
        config.hashtags || "",
        input
      ) ||
      "";
  // ========================================
  // FINAL CAPTION
  // ========================================

  const finalCaption = [
    caption,
    hashtags,
  ]
    .filter(Boolean)
    .join("\n\n");

  console.log(
    "========================================"
  );

  console.log(
    "INSTAGRAM NODE"
  );

  console.log(
    "USER:",
    userId.toString()
  );

  console.log(
    "EMPLOYEE:",
    employeeId.toString()
  );

  console.log(
    "EXECUTION:",
    executionId
  );

  console.log(
    "CONNECTION:",
    connection._id.toString()
  );

  console.log(
    "INSTAGRAM:",
    connection.username ||
      igUserId
  );

  console.log(
    "IMAGE:",
    imageUrl
  );

  console.log(
    "CAPTION:",
    finalCaption
  );

  console.log(
    "========================================"
  );

  // ========================================
  // META GRAPH API
  // ========================================

  const API_VERSION =
    "v23.0";

 const baseUrl =
  `https://graph.instagram.com/${API_VERSION}`;
  // ========================================
  // CREATE MEDIA CONTAINER
  // ========================================

  const containerParams =
    new URLSearchParams();

  containerParams.append(
    "image_url",
    imageUrl
  );

  if (finalCaption) {
    containerParams.append(
      "caption",
      finalCaption
    );
  }

  containerParams.append(
    "access_token",
    accessToken
  );

  const containerResponse =
    await fetch(
      `${baseUrl}/${igUserId}/media`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          containerParams.toString(),
      }
    );

  const containerData =
    await containerResponse.json();

  console.log(
    "INSTAGRAM CONTAINER RESPONSE:",
    containerData
  );

  if (
    !containerResponse.ok ||
    !containerData.id
  ) {
    throw new Error(
      containerData?.error?.message ||
      "Instagram media container creation failed"
    );
  }

  const creationId =
    containerData.id;

  // ========================================
  // PUBLISH
  // ========================================

  const publishParams =
    new URLSearchParams();

  publishParams.append(
    "creation_id",
    creationId
  );

  publishParams.append(
    "access_token",
    accessToken
  );

  const publishResponse =
    await fetch(
      `${baseUrl}/${igUserId}/media_publish`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          publishParams.toString(),
      }
    );

  const publishData =
    await publishResponse.json();

  console.log(
    "INSTAGRAM PUBLISH RESPONSE:",
    publishData
  );

  if (
    !publishResponse.ok ||
    !publishData.id
  ) {
    throw new Error(
      publishData?.error?.message ||
      "Instagram media publish failed"
    );
  }

  // ========================================
  // OUTPUT
  // ========================================

  return {
    success:
      true,

    platform:
      "instagram",

    connectionId:
      connection._id.toString(),

    instagramUserId:
      igUserId,

    username:
      connection.username ||
      "",

    mediaId:
      publishData.id,

    creationId,

    imageUrl,

    caption,

    hashtags,

    finalCaption,
  };
};

module.exports = {
  execute,
};