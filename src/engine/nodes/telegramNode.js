const {
  resolveMappings,
} = require("../../utils/dataMapper");

const {
  resolveCredential,
} = require("../../services/credentialService");

const fs =
  require("fs");

const path =
  require("path");

const execute = async ({
  input,
  node,
  context,
}) => {
  const config =
    node?.config || {};

  const userId =
    context?.userId || null;

  const employeeId =
    context?.employeeId || null;

  const executionId =
    context?.executionId || null;

  console.log(
    "========== TELEGRAM NODE =========="
  );

  console.log(
    "USER:",
    userId
  );

  console.log(
    "EMPLOYEE:",
    employeeId
  );

  console.log(
    "EXECUTION:",
    executionId
  );

  // ========================================
  // CREDENTIAL
  // ========================================

  if (!config.credentialId) {
    throw new Error(
      "Telegram credential is required"
    );
  }

  const credential =
    await resolveCredential(
      config.credentialId
    );

  const botToken =
    credential.data?.token ||
    credential.data?.value ||
    credential.data?.botToken;

  if (!botToken) {
    throw new Error(
      "Telegram bot token not found in credential"
    );
  }

  // ========================================
  // CHAT ID
  // ========================================

  const chatId =
    resolveMappings(
      config.chatId,
      input
    );

  if (!chatId) {
    throw new Error(
      "Telegram chat ID is required"
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

  const hashtags =
    input?.hashtags ||
    resolveMappings(
      config.hashtags || "",
      input
    ) ||
    "";

  const finalCaption = [
    caption,
    hashtags,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ========================================
  // IMAGE
  // ========================================

  const generatedPath =
    input?.generatedPath ||
    input?.data?.generatedPath;

  if (!generatedPath) {
    throw new Error(
      "Telegram generated image path is required"
    );
  }

  if (
    !fs.existsSync(
      generatedPath
    )
  ) {
    throw new Error(
      `Generated image file not found: ${generatedPath}`
    );
  }

  // ========================================
  // TELEGRAM API
  // ========================================

  const telegramUrl =
    `https://api.telegram.org/bot${botToken}/sendPhoto`;

  const form =
    new FormData();

  form.append(
    "chat_id",
    String(chatId)
  );

  if (finalCaption) {
    form.append(
      "caption",
      finalCaption
    );
  }

  const fileBuffer =
    fs.readFileSync(
      generatedPath
    );

  const fileName =
    path.basename(
      generatedPath
    );

  const blob =
    new Blob(
      [fileBuffer],
      {
        type:
          "image/png",
      }
    );

  form.append(
    "photo",
    blob,
    fileName
  );

  const response =
    await fetch(
      telegramUrl,
      {
        method:
          "POST",

        body:
          form,
      }
    );

  const responseData =
    await response.json();

  if (
    !response.ok ||
    !responseData.ok
  ) {
    console.error(
      "TELEGRAM ERROR:",
      responseData
    );

    throw new Error(
      responseData?.description ||
      "Telegram API request failed"
    );
  }

  return {
    success:
      true,

    messageId:
      responseData.result
        ?.message_id ||
      null,

    chatId,

    generatedPath,

    caption,

    hashtags,

    telegramResponse:
      responseData.result,
  };
};

module.exports = {
  execute,
};