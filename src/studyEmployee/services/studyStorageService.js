const fs = require("fs");
const path = require("path");

// ============================================================
// STUDY EMPLOYEE TEMP STORAGE
// ============================================================
//
// Temporary structure:
//
// tmp/
// └── studyEmployee/
//     └── <subject-slug>/
//         ├── page-01.png
//         ├── page-02.png
//         ├── ...
//         └── page-20.png
//
// Final PDF Google Drive me upload hone ke baad
// ye complete temporary folder delete kar diya jayega.
//
// ============================================================


// ============================================================
// BASE TEMP DIRECTORY
// ============================================================

const getStudyTempRoot = () => {
  return path.join(
    process.cwd(),
    "tmp",
    "studyEmployee"
  );
};


// ============================================================
// SUBJECT SLUG
// ============================================================
//
// Example:
//
// "Operating System"
//        ↓
// "operating-system"
//
// Special characters remove karenge taaki
// filesystem path safe rahe.
// ============================================================

const createSubjectSlug = (subject) => {
  return String(subject || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
};


// ============================================================
// CREATE STUDY JOB FOLDER
// ============================================================

const createStudyTempFolder = ({
  subject,
}) => {

  if (!subject) {
    throw new Error(
      "Study Storage: subject is required"
    );
  }

  const slug =
    createSubjectSlug(subject);

  if (!slug) {
    throw new Error(
      "Study Storage: invalid subject"
    );
  }

  const root =
    getStudyTempRoot();

  const subjectFolder =
    path.join(
      root,
      slug
    );

  fs.mkdirSync(
    subjectFolder,
    {
      recursive: true,
    }
  );

  console.log(
    "📁 STUDY TEMP FOLDER:",
    subjectFolder
  );

  return {
    root,
    subjectFolder,
    subjectSlug: slug,
  };
};


// ============================================================
// GET PAGE IMAGE PATH
// ============================================================

const getStudyPagePath = ({
  subjectFolder,
  pageNumber,
  extension = "png",
}) => {

  if (!subjectFolder) {
    throw new Error(
      "Study Storage: subjectFolder is required"
    );
  }

  if (!pageNumber) {
    throw new Error(
      "Study Storage: pageNumber is required"
    );
  }

  const paddedPage =
    String(pageNumber)
      .padStart(2, "0");

  return path.join(
    subjectFolder,
    `page-${paddedPage}.${extension}`
  );
};


// ============================================================
// SAVE / COPY GENERATED IMAGE
// ============================================================
//
// Image generation service se jo temporary image
// path milega usko hamare Study folder me copy karenge.
//
// Isse image generation service ka internal
// storage structure Study Employee se separate rahega.
// ============================================================

const saveStudyPageImage = ({
  sourcePath,
  subjectFolder,
  pageNumber,
}) => {

  if (!sourcePath) {
    throw new Error(
      "Study Storage: sourcePath is required"
    );
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Study Storage: generated image not found: ${sourcePath}`
    );
  }

  const destinationPath =
    getStudyPagePath({
      subjectFolder,
      pageNumber,
      extension:
        path.extname(sourcePath)
          .replace(".", "") ||
        "png",
    });

  fs.copyFileSync(
    sourcePath,
    destinationPath
  );

  console.log(
    `💾 STUDY PAGE ${pageNumber} SAVED:`,
    destinationPath
  );

  return destinationPath;
};


// ============================================================
// CHECK PAGE EXISTS
// ============================================================

const studyPageExists = ({
  subjectFolder,
  pageNumber,
}) => {

  const pagePath =
    getStudyPagePath({
      subjectFolder,
      pageNumber,
    });

  return fs.existsSync(
    pagePath
  );
};


// ============================================================
// GET ALL PAGE IMAGES
// ============================================================

const getStudyPageImages = ({
  subjectFolder,
  totalPages = 20,
}) => {

  if (!subjectFolder) {
    throw new Error(
      "Study Storage: subjectFolder is required"
    );
  }

  const images = [];

  for (
    let page = 1;
    page <= totalPages;
    page++
  ) {

    const pagePath =
      getStudyPagePath({
        subjectFolder,
        pageNumber: page,
      });

    if (!fs.existsSync(pagePath)) {
      throw new Error(
        `Study Storage: page ${page} image is missing`
      );
    }

    images.push({
      pageNumber: page,
      path: pagePath,
    });
  }

  return images;
};


// ============================================================
// DELETE STUDY TEMP FOLDER
// ============================================================

const cleanupStudyTempFolder = ({
  subjectFolder,
}) => {

  if (!subjectFolder) {
    return;
  }

  if (
    !fs.existsSync(
      subjectFolder
    )
  ) {
    return;
  }

  fs.rmSync(
    subjectFolder,
    {
      recursive: true,
      force: true,
    }
  );

  console.log(
    "🧹 STUDY TEMP FOLDER DELETED:",
    subjectFolder
  );
};


// ============================================================
// DELETE ALL STUDY TEMP DATA
// ============================================================

const cleanupAllStudyTemp = () => {

  const root =
    getStudyTempRoot();

  if (
    !fs.existsSync(root)
  ) {
    return;
  }

  fs.rmSync(
    root,
    {
      recursive: true,
      force: true,
    }
  );

  console.log(
    "🧹 ALL STUDY TEMP DATA DELETED"
  );
};


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  getStudyTempRoot,
  createSubjectSlug,
  createStudyTempFolder,
  getStudyPagePath,
  saveStudyPageImage,
  studyPageExists,
  getStudyPageImages,
  cleanupStudyTempFolder,
  cleanupAllStudyTemp,
};