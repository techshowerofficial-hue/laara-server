const { google } = require("googleapis");
const {Readable} = require("stream");
const Connection = require("../models/Connection");
// ============================================================
// EMPLOYEE DRIVE STRUCTURES
// ============================================================

const EMPLOYEE_DRIVE_STRUCTURES = {
  IMAGE_REEL: {
    folders: {
      references: "References",
      outputs: "Outputs",
      images: "Outputs/Images",
      videos: "Outputs/Videos",
    },
  },

  // Future employee types yaha add honge
  BLOG: {
    folders: {
      references: "References",
      content: "Content",
      outputs: "Outputs",
    },
  },

  VIDEO: {
    folders: {
      references: "References",
      scripts: "Scripts",
      assets: "Assets",
      outputs: "Outputs",
    },
  },
};

// ============================================================
// GOOGLE OAUTH CLIENT
// ============================================================

const createOAuthClient = () => {
  const clientId =
    process.env.GOOGLE_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET;

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI;

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

// ============================================================
// GET USER GOOGLE DRIVE CONNECTION
// ============================================================

const getGoogleDriveConnection =
  async (userId) => {
    const connection =
      await Connection.findOne({
        userId,
        platform: "GOOGLE_DRIVE",
        status: "CONNECTED",
      }).select(
        "+accessToken +refreshToken"
      );

    if (!connection) {
      throw new Error(
        "GOOGLE_DRIVE_NOT_CONNECTED"
      );
    }

    return connection;
  };

// ============================================================
// GET DRIVE CLIENT
// ============================================================

const getDriveClient = async (
  userId
) => {
  const connection =
    await getGoogleDriveConnection(
      userId
    );

  const oauth2Client =
    createOAuthClient();

  oauth2Client.setCredentials({
    access_token:
      connection.accessToken,

    refresh_token:
      connection.refreshToken || undefined,

    expiry_date:
      connection.expiresAt
        ? new Date(
            connection.expiresAt
          ).getTime()
        : undefined,
  });

  // ----------------------------------------------------------
  // Save refreshed token automatically
  // ----------------------------------------------------------

  oauth2Client.on(
    "tokens",
    async (tokens) => {
      try {
        const update = {};

        if (tokens.access_token) {
          update.accessToken =
            tokens.access_token;
        }

        if (tokens.refresh_token) {
          update.refreshToken =
            tokens.refresh_token;
        }

        if (tokens.expiry_date) {
          update.expiresAt =
            new Date(
              tokens.expiry_date
            );
        }

        if (
          Object.keys(update)
            .length
        ) {
          await Connection.findByIdAndUpdate(
            connection._id,
            update
          );
        }
      } catch (error) {
        console.error(
          "Google Drive token update error:",
          error
        );
      }
    }
  );

  return {
    drive: google.drive({
      version: "v3",
      auth: oauth2Client,
    }),

    connection,
  };
};

// ============================================================
// CREATE FOLDER
// ============================================================

const createFolder = async ({
  drive,
  name,
  parentId,
}) => {
  const response =
    await drive.files.create({
      requestBody: {
        name,
        mimeType:
          "application/vnd.google-apps.folder",

        parents: parentId
          ? [parentId]
          : undefined,
      },

      fields: "id,name",
    });

  return response.data;
};

// ============================================================
// FIND FOLDER
// ============================================================

const findFolder = async ({
  drive,
  name,
  parentId,
}) => {
  const escapedName =
    String(name).replace(
      /'/g,
      "\\'"
    );

  let query =
    `'${parentId || "root"}' in parents` +
    ` and name = '${escapedName}'` +
    ` and mimeType = 'application/vnd.google-apps.folder'` +
    ` and trashed = false`;

  const response =
    await drive.files.list({
      q: query,

      fields:
        "files(id,name)",

      pageSize: 1,
    });

  return (
    response.data.files?.[0] ||
    null
  );
};

// ============================================================
// FIND OR CREATE FOLDER
// ============================================================

const findOrCreateFolder =
  async ({
    drive,
    name,
    parentId,
  }) => {
    const existing =
      await findFolder({
        drive,
        name,
        parentId,
      });

    if (existing) {
      return existing;
    }

    return createFolder({
      drive,
      name,
      parentId,
    });
  };

// ============================================================
// GET / CREATE FOLDER PATH
// ============================================================

const createFolderPath = async ({
  drive,
  rootId,
  path,
}) => {
  const parts = String(path)
    .split("/")
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);

  let currentParentId =
    rootId;

  for (const part of parts) {
    const folder =
      await findOrCreateFolder({
        drive,
        name: part,
        parentId:
          currentParentId,
      });

    currentParentId =
      folder.id;
  }

  return currentParentId;
};

// ============================================================
// NORMALIZE EMPLOYEE TYPE
// ============================================================

const normalizeEmployeeType =
  (type) => {
    if (!type) {
      return "";
    }

    return String(type)
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  };

// ============================================================
// GET STRUCTURE
// ============================================================

const getEmployeeDriveStructure =
  (employeeType) => {
    const normalizedType =
      normalizeEmployeeType(
        employeeType
      );

    const structure =
      EMPLOYEE_DRIVE_STRUCTURES[
        normalizedType
      ];

    if (!structure) {
      throw new Error(
        `UNSUPPORTED_EMPLOYEE_DRIVE_TYPE:${normalizedType}`
      );
    }

    return structure;
  };

// ============================================================
// CREATE EMPLOYEE STORAGE
// ============================================================

const createEmployeeStorage =
  async ({
    userId,
    employeeId,
    employeeName,
    employeeType,
  }) => {
    if (!userId) {
      throw new Error(
        "USER_ID_REQUIRED"
      );
    }

    if (!employeeId) {
      throw new Error(
        "EMPLOYEE_ID_REQUIRED"
      );
    }

    const {
      drive,
    } = await getDriveClient(
      userId
    );

    const structure =
      getEmployeeDriveStructure(
        employeeType
      );

    // --------------------------------------------------------
    // ROOT
    // --------------------------------------------------------

    const laaraFolder =
      await findOrCreateFolder({
        drive,
        name: "Laara",
        parentId: "root",
      });

    // --------------------------------------------------------
    // EMPLOYEES
    // --------------------------------------------------------

    const employeesFolder =
      await findOrCreateFolder({
        drive,
        name: "Employees",
        parentId:
          laaraFolder.id,
      });

    // --------------------------------------------------------
    // EMPLOYEE FOLDER
    // --------------------------------------------------------

    const safeEmployeeName =
      String(
        employeeName || "Employee"
      )
        .trim()
        .replace(
          /[\\/:*?"<>|]/g,
          "-"
        );

    const employeeFolderName =
      `${safeEmployeeName} - ${employeeId}`;

    const employeeFolder =
      await findOrCreateFolder({
        drive,
        name:
          employeeFolderName,
        parentId:
          employeesFolder.id,
      });

    // --------------------------------------------------------
    // TYPE-SPECIFIC FOLDERS
    // --------------------------------------------------------

    const folderIds = {};

    for (const [
      key,
      path,
    ] of Object.entries(
      structure.folders
    )) {
      folderIds[key] =
        await createFolderPath({
          drive,

          rootId:
            employeeFolder.id,

          path,
        });
    }

    return {
      provider:
        "GOOGLE_DRIVE",

      rootFolderId:
        employeeFolder.id,

      folders:
        folderIds,

      status: "READY",
    };
  };

  // ============================================================
// CREATE CHARACTER FOLDER
// ============================================================

const createCharacterFolder = async ({
  userId,
  referencesFolderId,
  characterName,
  characterId,
}) => {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!referencesFolderId) {
    throw new Error("REFERENCES_FOLDER_ID_REQUIRED");
  }

  if (!characterId) {
    throw new Error("CHARACTER_ID_REQUIRED");
  }

  const {drive} = await getDriveClient(userId);

  const safeCharacterName = String(
    characterName || "Character"
  )
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-");

  const folderName =
    `${safeCharacterName} - ${characterId}`;

  return findOrCreateFolder({
    drive,
    name: folderName,
    parentId: referencesFolderId,
  });
};


// ============================================================
// UPLOAD CHARACTER REFERENCE IMAGE
// ============================================================

const uploadCharacterReference = async ({
  userId,
  referencesFolderId,
  characterName,
  characterId,
  fileName,
  buffer,
  mimeType,
}) => {
  if (!buffer) {
    throw new Error(
      "CHARACTER_REFERENCE_BUFFER_REQUIRED"
    );
  }

  const characterFolder =
    await createCharacterFolder({
      userId,
      referencesFolderId,
      characterName,
      characterId,
    });

  const {drive} =
    await getDriveClient(userId);

  const response =
    await drive.files.create({
      requestBody: {
        name:
          fileName ||
          "reference-image.jpg",

        mimeType:
          mimeType ||
          "image/jpeg",

        parents: [
          characterFolder.id,
        ],
      },

      media: {
        mimeType:
          mimeType ||
          "image/jpeg",

        body:
          Readable.from(buffer),
      },

      fields:
        "id,name,mimeType,webViewLink",
    });

  return {
    fileId: response.data.id,

    fileName:
      response.data.name,

    mimeType:
      response.data.mimeType,

    folderId:
      characterFolder.id,

    webViewLink:
      response.data.webViewLink || null,
  };
};


// ============================================================
// DOWNLOAD CHARACTER REFERENCE
// ============================================================

const downloadCharacterReference = async ({
  userId,
  fileId,
}) => {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!fileId) {
    throw new Error("DRIVE_FILE_ID_REQUIRED");
  }

  const {drive} =
    await getDriveClient(userId);

  const response =
    await drive.files.get(
      {
        fileId,

        alt: "media",
      },
      {
        responseType: "arraybuffer",
      }
    );

  return Buffer.from(
    response.data
  );
};
// ============================================================
// UPLOAD CHARACTER TO LIBRARY
// ============================================================

const uploadCharacterToLibrary = async ({
  userId,
  characterId,
  characterName,
  fileName,
  buffer,
  mimeType,
}) => {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!characterId) {
    throw new Error("CHARACTER_ID_REQUIRED");
  }

  if (!buffer) {
    throw new Error(
      "CHARACTER_REFERENCE_BUFFER_REQUIRED"
    );
  }

  const {drive} =
    await getDriveClient(userId);

  // ----------------------------------------------------------
  // LAARA
  // ----------------------------------------------------------

  const laaraFolder =
    await findOrCreateFolder({
      drive,
      name: "Laara",
      parentId: "root",
    });

  // ----------------------------------------------------------
  // CHARACTER LIBRARY
  // ----------------------------------------------------------

  const libraryFolder =
    await findOrCreateFolder({
      drive,
      name: "Character Library",
      parentId: laaraFolder.id,
    });

  // ----------------------------------------------------------
  // CHARACTER FOLDER
  // ----------------------------------------------------------

  const safeCharacterName =
    String(characterName || "Character")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-");

  const characterFolder =
    await findOrCreateFolder({
      drive,

      name:
        `${safeCharacterName} - ${characterId}`,

      parentId:
        libraryFolder.id,
    });

  // ----------------------------------------------------------
  // IMAGE
  // ----------------------------------------------------------

  const response =
    await drive.files.create({
      requestBody: {
        name:
          fileName ||
          "reference-image.jpg",

        mimeType:
          mimeType ||
          "image/jpeg",

        parents: [
          characterFolder.id,
        ],
      },

      media: {
        mimeType:
          mimeType ||
          "image/jpeg",

        body:
          Readable.from(buffer),
      },

      fields:
        "id,name,mimeType",
    });

  return {
    fileId: response.data.id,

    fileName:
      response.data.name,

    mimeType:
      response.data.mimeType,

    folderId:
      characterFolder.id,
  };
};

// ============================================================
// MOVE CHARACTER REFERENCE TO EMPLOYEE
// ============================================================

const moveCharacterReferenceToEmployee = async ({
  userId,
  characterFileId,
  characterName,
  characterId,
  referencesFolderId,
}) => {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!characterFileId) {
    throw new Error(
      "CHARACTER_FILE_ID_REQUIRED"
    );
  }

  if (!referencesFolderId) {
    throw new Error(
      "REFERENCES_FOLDER_ID_REQUIRED"
    );
  }

  const {drive} =
    await getDriveClient(userId);

  // ----------------------------------------------------------
  // CHARACTER FOLDER
  // ----------------------------------------------------------

  const safeCharacterName =
    String(characterName || "Character")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-");

  const characterFolder =
    await findOrCreateFolder({
      drive,

      name:
        `${safeCharacterName} - ${characterId}`,

      parentId:
        referencesFolderId,
    });

  // ----------------------------------------------------------
  // GET CURRENT PARENT
  // ----------------------------------------------------------

  const file =
    await drive.files.get({
      fileId: characterFileId,

      fields: "id,parents",
    });

  const oldParents =
    file.data.parents || [];

  // ----------------------------------------------------------
  // MOVE FILE
  // ----------------------------------------------------------

  await drive.files.update({
    fileId: characterFileId,

    addParents:
      characterFolder.id,

    removeParents:
      oldParents.join(","),

    fields:
      "id,name,parents",
  });

  return {
    fileId:
      characterFileId,

    folderId:
      characterFolder.id,
  };
};
// ============================================================
// UPLOAD GENERATED IMAGE TO EMPLOYEE OUTPUTS
// ============================================================

const uploadGeneratedImage = async ({
  userId,
  employeeId,
  employeeName,
  employeeType = "IMAGE_REEL",
  employeeStorage,
  filePath,
  fileName,
  mimeType = "image/png",
 
}) => {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  if (!employeeId) {
    throw new Error("EMPLOYEE_ID_REQUIRED");
  }

  if (!filePath) {
    throw new Error("GENERATED_FILE_PATH_REQUIRED");
  }

  const fs = require("fs");

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `GENERATED_FILE_NOT_FOUND:${filePath}`
    );
  }

  const { drive } =
    await getDriveClient(userId);

  /*
   * Make sure employee storage exists.
   *
   * This returns:
   *
   * folders.images
   * = Outputs/Images folder ID
   */
let imagesFolderId = employeeStorage?.folders?.images;

if (!imagesFolderId) {
  const storage = await createEmployeeStorage({
    userId,
    employeeId,
    employeeName,
    employeeType,
  });

  imagesFolderId = storage.folders?.images;
}

  if (!imagesFolderId) {
    throw new Error(
      "EMPLOYEE_OUTPUT_IMAGES_FOLDER_NOT_FOUND"
    );
  }

  const finalFileName =
    fileName ||
    `image-${Date.now()}.png`;

  const response =
    await drive.files.create({
      
      requestBody: {
        name: finalFileName,

        mimeType,

        parents: [
          imagesFolderId,
        ],
      },

      media: {
        mimeType,

        body:
          fs.createReadStream(filePath),
      },

      fields:
        "id,name,mimeType,size,createdTime,webViewLink",
    });
    
await drive.permissions.create({
  fileId: response.data.id,

  requestBody: {
    type: "anyone",
    role: "reader",
  },
});
const publicUrl =
  `https://drive.google.com/uc?export=download&id=${response.data.id}`;

return {
  fileId: response.data.id,

  fileName:
    response.data.name,

  mimeType:
    response.data.mimeType,

  size:
    response.data.size || null,

  createdTime:
    response.data.createdTime || null,

  webViewLink:
    response.data.webViewLink || null,

  publicUrl,

  folderId:
    imagesFolderId,
};
};
const renameEmployeeStorageFolder = async ({
  userId,
  employeeFolderId,
  employeeName,
  employeeId,
}) => {
  if (!employeeFolderId) {
    throw new Error(
      "Employee Drive folder ID is missing"
    );
  }

  if (!employeeName) {
    throw new Error(
      "Employee name is required"
    );
  }

  const drive = await getDriveClient(userId);

  const newName =
    `${employeeName.trim()} - ${employeeId}`;

  const response =
    await drive.files.update({
      fileId: employeeFolderId,

      requestBody: {
        name: newName,
      },

      fields: "id,name",
    });

  return {
    fileId: response.data.id,
    name: response.data.name,
  };
};
// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getGoogleDriveConnection,
  getDriveClient,
  createFolder,
  findFolder,
  findOrCreateFolder,
  createFolderPath,
  getEmployeeDriveStructure,
  createEmployeeStorage,
  createCharacterFolder,
  uploadCharacterReference,
  downloadCharacterReference,
   uploadCharacterToLibrary,
   moveCharacterReferenceToEmployee,
  uploadGeneratedImage,
  renameEmployeeStorageFolder,
};