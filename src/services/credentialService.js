const Credential = require("../models/Credential");

const {
  decrypt
} = require("../utils/credentialCrypto");

const resolveCredential =
  async (credentialId) => {
    if (!credentialId) {
      throw new Error(
        "credentialId is required"
      );
    }

    const credential =
      await Credential.findById(
        credentialId
      );

    if (!credential) {
      throw new Error(
        "Credential not found"
      );
    }

    if (
      credential.status !== "active"
    ) {
      throw new Error(
        "Credential is inactive"
      );
    }

    return {
      id: credential._id.toString(),
      name: credential.name,
      type: credential.type,
      data: decrypt(
        credential.encryptedData
      )
    };
  };

module.exports = {
  resolveCredential
};