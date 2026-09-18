const Credential = require("../models/Credential");
const {
  encrypt,
  decrypt
} = require("../utils/credentialCrypto");
const {
  resolveCredential
} = require("../services/credentialService");
const createCredential = async (req, res) => {
  try {
    const {
      name,
      type,
      data
    } = req.body;

    if (!name || !type || !data) {
      return res.status(400).json({
        success: false,
        message:
          "name, type and data are required"
      });
    }

    const encryptedData = encrypt(data);

    const credential =
      await Credential.create({
        name,
        type,
        encryptedData
      });

    res.status(201).json({
      success: true,
      credential: {
        id: credential._id,
        name: credential.name,
        type: credential.type,
        status: credential.status,
        createdAt: credential.createdAt
      }
    });
  } catch (error) {
    console.error(
      "Create credential error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to create credential"
    });
  }
};

const getCredentials = async (req, res) => {
  try {
    const credentials =
      await Credential.find({
        status: "active"
      })
        .select(
          "_id name type status createdAt updatedAt"
        )
        .sort({
          createdAt: -1
        });

    res.json({
      success: true,
      credentials
    });
  } catch (error) {
    console.error(
      "Get credentials error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch credentials"
    });
  }
};


const deleteCredential =
  async (req, res) => {
    try {
      const credential =
        await Credential.findByIdAndUpdate(
          req.params.id,
          {
            status: "inactive"
          },
          {
            new: true
          }
        );

      if (!credential) {
        return res.status(404).json({
          success: false,
          message:
            "Credential not found"
        });
      }

      res.json({
        success: true,
        message:
          "Credential disabled successfully"
      });
    } catch (error) {
      console.error(
        "Delete credential error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to disable credential"
      });
    }
  };

module.exports = {
  createCredential,
  getCredentials,
  deleteCredential
};