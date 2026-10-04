const {
  getMasterDriveClient,
} = require("./masterGoogleDriveService");

const {
  findOrCreateFolder,
} = require("./googleDriveService");


// ============================================================
// FIND STUDY NOTES IN MASTER DRIVE
// ============================================================

const findStudyNotes = async ({
  subject,
}) => {

  if (!subject) {
    throw new Error(
      "STUDY_SUBJECT_REQUIRED"
    );
  }

  const drive =
    await getMasterDriveClient();

  const cleanSubject =
    String(subject)
      .trim()
      .replace(
        /[\\/:*?"<>|]/g,
        "-"
      );

  console.log("");
  console.log(
    "📚 CHECKING MASTER STUDY DRIVE"
  );
  console.log(
    "Subject:",
    cleanSubject
  );

  // ----------------------------------------------------------
  // 1. LAARA
  // ----------------------------------------------------------

  const laaraFolder =
    await findOrCreateFolder({
      drive,

      name: "Laara",

      parentId: "root",
    });

  // ----------------------------------------------------------
  // 2. STUDY NOTES
  // ----------------------------------------------------------

  const studyFolder =
    await findOrCreateFolder({
      drive,

      name: "Study Notes",

      parentId:
        laaraFolder.id,
    });

  // ----------------------------------------------------------
  // 3. SUBJECT
  // ----------------------------------------------------------

  const subjectFolder =
    await findOrCreateFolder({
      drive,

      name: cleanSubject,

      parentId:
        studyFolder.id,
    });

  // ----------------------------------------------------------
  // 4. CHECK FILES
  // ----------------------------------------------------------

  const response =
    await drive.files.list({
      q:
        `'${subjectFolder.id}' in parents` +
        ` and trashed = false`,

      fields:
        "files(id,name,mimeType,size,createdTime,webViewLink)",

      orderBy:
        "createdTime desc",

      pageSize: 100,
    });

  const files =
    response.data.files || [];

  console.log(
    "📁 Subject Folder:",
    subjectFolder.id
  );

  console.log(
    "📄 Files:",
    files.length
  );

  return {
    found:
      files.length > 0,

    subject:
      cleanSubject,

    folderId:
      subjectFolder.id,

    files,
  };
};


module.exports = {
  findStudyNotes,
};