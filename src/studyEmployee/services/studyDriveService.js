const fs = require("fs");

const {
  getMasterDriveClient,
} = require("../../services/masterGoogleDriveService");

// ============================================================
// CONSTANTS
// ============================================================

const GOOGLE_FOLDER_MIME =
  "application/vnd.google-apps.folder";

const PDF_MIME =
  "application/pdf";

// ============================================================
// ESCAPE GOOGLE DRIVE QUERY VALUE
// ============================================================

const escapeDriveQueryValue = (value) => {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
};

// ============================================================
// GET STUDY ROOT FOLDER
// ============================================================

const getStudyRootFolder = async ({
  drive,
}) => {

  const rootFolderId =
    process.env.LAARA_STUDY_ROOT_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error(
      "LAARA_STUDY_ROOT_FOLDER_ID_NOT_CONFIGURED"
    );
  }

  const response =
    await drive.files.get({
      fileId: rootFolderId,
      fields:
        "id,name,mimeType,trashed",
    });

  const folder =
    response.data;

  if (
    folder.trashed ||
    folder.mimeType !==
      GOOGLE_FOLDER_MIME
  ) {
    throw new Error(
      "STUDY_ROOT_FOLDER_INVALID"
    );
  }

  return folder;
};

// ============================================================
// FIND SUBJECT FOLDER
// ============================================================
//
// IMPORTANT:
// Ye function folder create nahi karta.
//
// Existing folder milega to return karega.
// Nahi milega to null.
//
// Folder creation sirf generation ke waqt
// createStudySubjectFolder() karega.
// ============================================================

const findStudySubjectFolder = async ({
  drive,
  subject,
}) => {

  if (!subject) {
    throw new Error(
      "Study Drive: subject is required"
    );
  }

  const cleanSubject =
    String(subject).trim();

  const rootFolder =
    await getStudyRootFolder({
      drive,
    });

  const escapedRootId =
    escapeDriveQueryValue(
      rootFolder.id
    );

  const escapedSubject =
    escapeDriveQueryValue(
      cleanSubject
    );

  const response =
    await drive.files.list({
      q:
        `'${escapedRootId}' in parents and ` +
        `name = '${escapedSubject}' and ` +
        `mimeType = '${GOOGLE_FOLDER_MIME}' and ` +
        `trashed = false`,

      fields:
        "files(id,name,mimeType,createdTime,modifiedTime)",

      pageSize: 10,
    });

  const folders =
    response.data.files || [];

  if (!folders.length) {
    return null;
  }

  return folders[0];
};

// ============================================================
// CREATE SUBJECT FOLDER
// ============================================================
//
// Ye ONLY generation flow me use hoga.
//
// Example:
//
// Laara Study Notes
//      ↓
// Graphic
//
// ============================================================

const createStudySubjectFolder = async ({
  drive,
  subject,
}) => {

  if (!subject) {
    throw new Error(
      "Study Drive: subject is required"
    );
  }

  const cleanSubject =
    String(subject)
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-");

  if (!cleanSubject) {
    throw new Error(
      "Study Drive: invalid subject"
    );
  }

  // ----------------------------------------------------------
  // ROOT
  // ----------------------------------------------------------

  const rootFolder =
    await getStudyRootFolder({
      drive,
    });

  // ----------------------------------------------------------
  // CHECK EXISTING
  // ----------------------------------------------------------

  const existingFolder =
    await findStudySubjectFolder({
      drive,
      subject: cleanSubject,
    });

  if (existingFolder) {

    console.log(
      "📁 STUDY SUBJECT FOLDER ALREADY EXISTS"
    );

    console.log(
      existingFolder.id
    );

    return existingFolder;
  }

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  console.log(
    "📁 CREATING STUDY SUBJECT FOLDER:"
  );

  console.log(
    cleanSubject
  );

  const response =
    await drive.files.create({
      requestBody: {
        name: cleanSubject,
        mimeType:
          GOOGLE_FOLDER_MIME,
        parents: [
          rootFolder.id,
        ],
      },

      fields:
        "id,name,mimeType,createdTime,modifiedTime",
    });

  console.log(
    "✅ STUDY SUBJECT FOLDER CREATED:"
  );

  console.log(
    response.data
  );

  return response.data;
};

// ============================================================
// UPLOAD STUDY PDF
// ============================================================

const uploadStudyPdf = async ({
  drive,
  pdfPath,
  subject,
}) => {

  if (!pdfPath) {
    throw new Error(
      "Study Drive: pdfPath is required"
    );
  }

  if (
    !fs.existsSync(pdfPath)
  ) {
    throw new Error(
      `Study Drive: PDF not found: ${pdfPath}`
    );
  }

  if (!subject) {
    throw new Error(
      "Study Drive: subject is required"
    );
  }

  // ----------------------------------------------------------
  // GET / CREATE SUBJECT FOLDER
  // ----------------------------------------------------------

  const subjectFolder =
    await createStudySubjectFolder({
      drive,
      subject,
    });

  // ----------------------------------------------------------
  // FILE NAME
  // ----------------------------------------------------------

  const cleanSubject =
    String(subject)
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-");

  const fileName =
    `${cleanSubject} Complete Notes.pdf`;

  // ----------------------------------------------------------
  // UPLOAD
  // ----------------------------------------------------------

  console.log(
    "\n📤 UPLOADING STUDY PDF"
  );

  console.log(
    "File:",
    fileName
  );

  console.log(
    "Folder:",
    subjectFolder.id
  );

  const response =
    await drive.files.create({
      requestBody: {
        name: fileName,

        mimeType:
          PDF_MIME,

        parents: [
          subjectFolder.id,
        ],
      },

      media: {
        mimeType:
          PDF_MIME,

        body:
          fs.createReadStream(
            pdfPath
          ),
      },

      fields:
        "id,name,mimeType,size,parents,createdTime,modifiedTime,webViewLink",
    });

  console.log(
    "\n✅ STUDY PDF UPLOADED"
  );

  console.log(
    "File ID:",
    response.data.id
  );

  console.log(
    "File Name:",
    response.data.name
  );

  return {
    file:
      response.data,

    subjectFolder,
  };
};

// ============================================================
// GET EXISTING STUDY PDF
// ============================================================
//
// Generation complete hone ke baad ya existing notes
// check karne ke liye useful.
// ============================================================

const findStudyPdf = async ({
  drive,
  subject,
}) => {

  const subjectFolder =
    await findStudySubjectFolder({
      drive,
      subject,
    });

  if (!subjectFolder) {
    return null;
  }

  const escapedFolderId =
    escapeDriveQueryValue(
      subjectFolder.id
    );

  const response =
    await drive.files.list({
      q:
        `'${escapedFolderId}' in parents and ` +
        `mimeType = '${PDF_MIME}' and ` +
        `trashed = false`,

      fields:
        "files(id,name,mimeType,size,parents,createdTime,modifiedTime,webViewLink)",

      orderBy:
        "modifiedTime desc",

      pageSize: 100,
    });

  const files =
    response.data.files || [];

  if (!files.length) {
    return null;
  }

  return files[0];
};

// ============================================================
// COMPLETE PDF UPLOAD FLOW
// ============================================================

const uploadGeneratedStudyPdf = async ({
  pdfPath,
  subject,
}) => {

  if (!pdfPath) {
    throw new Error(
      "Study Drive: pdfPath is required"
    );
  }

  if (!subject) {
    throw new Error(
      "Study Drive: subject is required"
    );
  }

  const drive =
    await getMasterDriveClient();

  const result =
    await uploadStudyPdf({
      drive,
      pdfPath,
      subject,
    });

  return {
    success: true,

    subject,

    file:
      result.file,

    subjectFolder:
      result.subjectFolder,
  };
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  getStudyRootFolder,
  findStudySubjectFolder,
  createStudySubjectFolder,
  uploadStudyPdf,
  findStudyPdf,
  uploadGeneratedStudyPdf,
};