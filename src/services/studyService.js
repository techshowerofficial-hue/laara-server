const {
  getMasterDriveClient,
} = require("./masterGoogleDriveService");


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
// READ ONLY - NEVER CREATES FOLDER
// ============================================================

const getStudyRootFolder = async ({ drive }) => {
  const rootFolderId =
    process.env.LAARA_STUDY_ROOT_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error(
      "LAARA_STUDY_ROOT_FOLDER_ID_NOT_CONFIGURED"
    );
  }

  try {
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
        "application/vnd.google-apps.folder"
    ) {
      const error =
        new Error(
          "STUDY_ROOT_FOLDER_INVALID"
        );

      error.statusCode = 500;

      throw error;
    }

    return folder;

  } catch (error) {

    console.error(
      "STUDY ROOT FOLDER ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    if (error.statusCode) {
      throw error;
    }

    const notFound =
      new Error(
        "STUDY_ROOT_FOLDER_NOT_FOUND"
      );

    notFound.statusCode = 500;

    throw notFound;
  }
};


// ============================================================
// GET ALL AVAILABLE SUBJECTS
// DYNAMIC FROM GOOGLE DRIVE
// ============================================================

const getStudySubjects = async () => {

  const drive =
    await getMasterDriveClient();

  const rootFolder =
    await getStudyRootFolder({
      drive,
    });

  const escapedRootId =
    escapeDriveQueryValue(
      rootFolder.id
    );

  const response =
    await drive.files.list({
      q:
        `'${escapedRootId}' in parents and ` +
        `mimeType = 'application/vnd.google-apps.folder' and ` +
        `trashed = false`,

      fields:
        "files(id,name,mimeType,createdTime,modifiedTime)",

      orderBy:
        "name",

      pageSize: 1000,
    });

  const folders =
    response.data.files || [];

  return folders.map(
    (folder) => ({
      id: folder.id,
      name: folder.name,
      mimeType: folder.mimeType,
    })
  );
};


// ============================================================
// FIND SUBJECT FOLDER
// READ ONLY
// ============================================================

const getStudySubjectFolder = async ({
  drive,
  subject,
}) => {

  const cleanSubject =
    String(subject)
      .trim()
      .replace(/[\\/:*?"<>|]/g, "-");

  if (!cleanSubject) {
    throw new Error(
      "STUDY_SUBJECT_REQUIRED"
    );
  }

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
        `mimeType = 'application/vnd.google-apps.folder' and ` +
        `trashed = false`,

      fields:
        "files(id,name,mimeType,createdTime,modifiedTime)",

      pageSize: 10,
    });

  const folders =
    response.data.files || [];

  if (!folders.length) {
    const error =
      new Error(
        "STUDY_SUBJECT_FOLDER_NOT_FOUND"
      );

    error.statusCode = 404;

    throw error;
  }

  return {
    cleanSubject,
    subjectFolder: folders[0],
  };
};


// ============================================================
// DOWNLOAD DRIVE FILE
// ============================================================

const downloadDriveFile = async ({
  drive,
  fileId,
}) => {

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
// READ STUDY NOTES
// ============================================================

const readStudyNotes = async ({
  subject,
}) => {

  if (!subject) {
    throw new Error(
      "STUDY_SUBJECT_REQUIRED"
    );
  }

  const drive =
    await getMasterDriveClient();

  let folderData;

  try {

    folderData =
      await getStudySubjectFolder({
        drive,
        subject,
      });

  } catch (error) {

    if (
      error.message ===
      "STUDY_SUBJECT_FOLDER_NOT_FOUND"
    ) {

      return {
        found: false,
        subject: String(
          subject
        ).trim(),
        files: [],
      };
    }

    throw error;
  }

  const {
    cleanSubject,
    subjectFolder,
  } =
    folderData;

  const response =
    await drive.files.list({
      q:
        `'${subjectFolder.id}' in parents and ` +
        `trashed = false`,

      fields:
        "files(id,name,mimeType,size,createdTime,modifiedTime)",

      orderBy:
        "modifiedTime desc",

      pageSize: 100,
    });

  const files =
    response.data.files || [];

  const pdfFiles =
    files.filter(
      (file) =>
        file.mimeType ===
        "application/pdf"
    );

  if (!pdfFiles.length) {

    return {
      found: false,
      subject: cleanSubject,
      files: [],
    };
  }

  return {
    found: true,
    subject: cleanSubject,
    files: pdfFiles,
  };
};


// ============================================================
// GET STUDY PDF
// ============================================================

const getStudyPdf = async ({
  subject,
  fileId,
}) => {

  if (!subject) {
    throw new Error(
      "STUDY_SUBJECT_REQUIRED"
    );
  }

  if (!fileId) {
    throw new Error(
      "STUDY_FILE_ID_REQUIRED"
    );
  }

  const drive =
    await getMasterDriveClient();


  // ----------------------------------------------------------
  // FIND EXISTING SUBJECT FOLDER
  // ----------------------------------------------------------

  let subjectFolder;

  try {

    const result =
      await getStudySubjectFolder({
        drive,
        subject,
      });

    subjectFolder =
      result.subjectFolder;

  } catch (error) {

    if (
      error.message ===
      "STUDY_SUBJECT_FOLDER_NOT_FOUND"
    ) {

      const notFound =
        new Error(
          "STUDY_FILE_NOT_FOUND"
        );

      notFound.statusCode = 404;

      throw notFound;
    }

    throw error;
  }


  console.log(
    "STUDY SUBJECT FOLDER:",
    subjectFolder.id
  );

  console.log(
    "STUDY FILE ID:",
    fileId
  );


  // ----------------------------------------------------------
  // GET FILE DIRECTLY
  // ----------------------------------------------------------

  let file;

  try {

    const response =
      await drive.files.get({
        fileId,
        fields:
          "id,name,mimeType,size,parents",
      });

    file =
      response.data;

  } catch (error) {

    console.error(
      "GOOGLE DRIVE FILE GET ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    const notFound =
      new Error(
        "STUDY_FILE_NOT_FOUND"
      );

    notFound.statusCode = 404;

    throw notFound;
  }


  // ----------------------------------------------------------
  // VERIFY FILE BELONGS TO SUBJECT FOLDER
  // ----------------------------------------------------------

  const parents =
    file.parents || [];

  const belongsToSubject =
    parents.includes(
      subjectFolder.id
    );

  if (!belongsToSubject) {

    const error =
      new Error(
        "STUDY_FILE_NOT_FOUND"
      );

    error.statusCode = 404;

    throw error;
  }


  // ----------------------------------------------------------
  // VERIFY PDF
  // ----------------------------------------------------------

  if (
    file.mimeType !==
    "application/pdf"
  ) {

    const error =
      new Error(
        "STUDY_FILE_IS_NOT_PDF"
      );

    error.statusCode = 400;

    throw error;
  }


  // ----------------------------------------------------------
  // DOWNLOAD
  // ----------------------------------------------------------

  const buffer =
    await downloadDriveFile({
      drive,
      fileId: file.id,
    });

  console.log(
    "STUDY PDF BUFFER SIZE:",
    buffer.length
  );

  return {
    buffer,
    file,
  };
};


module.exports = {
  getStudySubjects,
  readStudyNotes,
  downloadDriveFile,
  getStudyPdf,
};