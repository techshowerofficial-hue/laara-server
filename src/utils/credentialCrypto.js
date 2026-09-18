const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

const getEncryptionKey = () => {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is not configured"
    );
  }

  return crypto
    .createHash("sha256")
    .update(secret)
    .digest();
};

const encrypt = (value) => {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(
      JSON.stringify(value),
      "utf8"
    ),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    content: encrypted.toString("hex"),
    authTag: authTag.toString("hex")
  };
};

const decrypt = (encryptedData) => {
  const key = getEncryptionKey();

  const iv = Buffer.from(
    encryptedData.iv,
    "hex"
  );

  const content = Buffer.from(
    encryptedData.content,
    "hex"
  );

  const authTag = Buffer.from(
    encryptedData.authTag,
    "hex"
  );

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(content),
    decipher.final()
  ]);

  return JSON.parse(
    decrypted.toString("utf8")
  );
};

module.exports = {
  encrypt,
  decrypt
};