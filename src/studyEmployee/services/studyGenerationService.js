const {
  generateStudyContentPlan,
} = require("./studyContentService");

const {
  generateStudyPageImages,
} = require("./studyImageService");

const {
  createStudyTempFolder,
  saveStudyPageImage,
  getStudyPageImages,
  cleanupStudyTempFolder,
} = require("./studyStorageService");

const {
  createStudyPdf,
} = require("./studyPdfService");

const {
  uploadGeneratedStudyPdf,
} = require("./studyDriveService");

// ============================================================
// GENERATE COMPLETE STUDY NOTES
// ============================================================
//
// Flow:
//
// Subject
//   ↓
// 20 Page Content Plan
//   ↓
// Temporary Study Folder
//   ↓
// Handwritten Images × 20
//   ↓
// Save Images
//   ↓
// PDF
//   ↓
// Google Drive
//   ↓
// Cleanup Temporary Files
//
// ============================================================

const generateStudyNotes = async ({
  subject,
  totalPages = 20,
  referenceImage = "",
}) => {

  if (!subject) {
    throw new Error(
      "Study Generation: subject is required"
    );
  }

  const cleanSubject =
    String(subject).trim();

  if (!cleanSubject) {
    throw new Error(
      "Study Generation: subject is required"
    );
  }

  if (
    !Number.isInteger(totalPages) ||
    totalPages <= 0
  ) {
    throw new Error(
      "Study Generation: invalid totalPages"
    );
  }

  console.log("\n");
  console.log(
    "================================================"
  );
  console.log(
    "📚 LAARA STUDY EMPLOYEE"
  );
  console.log(
    "🚀 COMPLETE NOTE GENERATION"
  );
  console.log(
    "================================================"
  );

  console.log(
    "Subject:",
    cleanSubject
  );

  console.log(
    "Pages:",
    totalPages
  );

  let tempFolder = null;

  try {

    // ========================================================
    // STEP 1 — CONTENT PLAN
    // ========================================================

    console.log("\n");
    console.log(
      "📋 STEP 1 — CONTENT PLAN"
    );

    const contentPlan =
      await generateStudyContentPlan({
        subject: cleanSubject,
        totalPages,
      });

    if (
      !contentPlan?.pages ||
      contentPlan.pages.length !==
        totalPages
    ) {
      throw new Error(
        "Study Generation: invalid content plan"
      );
    }

    console.log(
      "✅ Content plan ready"
    );

    // ========================================================
    // STEP 2 — CREATE TEMP STORAGE
    // ========================================================

    console.log("\n");
    console.log(
      "📁 STEP 2 — TEMP STORAGE"
    );

    tempFolder =
      createStudyTempFolder({
        subject: cleanSubject,
      });

    console.log(
      "Temporary folder:",
      tempFolder.subjectFolder
    );

    // ========================================================
    // STEP 3 — GENERATE 20 IMAGES
    // ========================================================

    console.log("\n");
    console.log(
      "🎨 STEP 3 — HANDWRITTEN IMAGES"
    );

    const generatedPages =
      await generateStudyPageImages({
        subject: cleanSubject,

        pages:
          contentPlan.pages,

        totalPages,

        referenceImage,
      });

    if (
      !Array.isArray(generatedPages) ||
      generatedPages.length !==
        totalPages
    ) {
      throw new Error(
        `Study Generation: expected ${totalPages} generated images`
      );
    }

    console.log(
      "✅ All images generated:",
      generatedPages.length
    );

    // ========================================================
    // STEP 4 — SAVE IMAGES TO STUDY TEMP FOLDER
    // ========================================================

    console.log("\n");
    console.log(
      "💾 STEP 4 — SAVE PAGE IMAGES"
    );

    const savedPages = [];

    for (
      const generatedPage
      of generatedPages
    ) {

      const savedPath =
        saveStudyPageImage({
          sourcePath:
            generatedPage.generatedPath,

          subjectFolder:
            tempFolder.subjectFolder,

          pageNumber:
            generatedPage.pageNumber,
        });

      savedPages.push({
        pageNumber:
          generatedPage.pageNumber,

        path:
          savedPath,
      });
    }

    console.log(
      "✅ Images saved:",
      savedPages.length
    );

    // ========================================================
    // STEP 5 — VERIFY ALL 20 IMAGES
    // ========================================================

    console.log("\n");
    console.log(
      "🔎 STEP 5 — VERIFY PAGE IMAGES"
    );

    const pageImages =
      getStudyPageImages({
        subjectFolder:
          tempFolder.subjectFolder,

        totalPages,
      });

    if (
      pageImages.length !==
        totalPages
    ) {
      throw new Error(
        "Study Generation: page verification failed"
      );
    }

    console.log(
      "✅ All pages verified"
    );

    // ========================================================
    // STEP 6 — CREATE PDF
    // ========================================================

    console.log("\n");
    console.log(
      "📄 STEP 6 — CREATE PDF"
    );

    const pdfResult =
      await createStudyPdf({
        subject: cleanSubject,

        subjectFolder:
          tempFolder.subjectFolder,

        totalPages,
      });

    if (
      !pdfResult?.pdfPath
    ) {
      throw new Error(
        "Study Generation: PDF creation failed"
      );
    }

    console.log(
      "✅ PDF created"
    );

    console.log(
      "PDF:",
      pdfResult.pdfPath
    );

    // ========================================================
    // STEP 7 — UPLOAD PDF TO GOOGLE DRIVE
    // ========================================================

    console.log("\n");
    console.log(
      "☁️ STEP 7 — GOOGLE DRIVE UPLOAD"
    );

    const driveResult =
      await uploadGeneratedStudyPdf({
        pdfPath:
          pdfResult.pdfPath,

        subject:
          cleanSubject,
      });

    if (
      !driveResult?.success ||
      !driveResult?.file?.id
    ) {
      throw new Error(
        "Study Generation: Google Drive upload failed"
      );
    }

    console.log(
      "✅ PDF uploaded to Google Drive"
    );

    console.log(
      "Drive File ID:",
      driveResult.file.id
    );

    // ========================================================
    // STEP 8 — CLEANUP
    // ========================================================

    console.log("\n");
    console.log(
      "🧹 STEP 8 — CLEANUP"
    );

    cleanupStudyTempFolder({
      subjectFolder:
        tempFolder.subjectFolder,
    });

    tempFolder = null;

    console.log(
      "✅ Temporary files deleted"
    );

    // ========================================================
    // COMPLETE
    // ========================================================

    console.log("\n");
    console.log(
      "================================================"
    );
    console.log(
      "🎉 STUDY NOTES GENERATION COMPLETE"
    );
    console.log(
      "================================================"
    );

    return {
      success: true,

      status:
        "READY",

      subject:
        cleanSubject,

      totalPages,

      file: {
        id:
          driveResult.file.id,

        name:
          driveResult.file.name,

        mimeType:
          driveResult.file.mimeType,

        size:
          driveResult.file.size,

        parents:
          driveResult.file.parents,

        webViewLink:
          driveResult.file.webViewLink ||
          null,
      },

      contentPlan: {
        subject:
          contentPlan.subject,

        totalPages:
          contentPlan.totalPages,
      },
    };

  } catch (error) {

    console.error("\n");
    console.error(
      "❌ STUDY GENERATION FAILED"
    );

    console.error(
      error?.message ||
        error
    );

    // --------------------------------------------------------
    // CLEANUP ON FAILURE
    // --------------------------------------------------------
    //
    // Agar generation ke beech me error aaya,
    // temporary images ko bhi delete karenge.
    //
    // --------------------------------------------------------

    if (tempFolder?.subjectFolder) {

      try {

        cleanupStudyTempFolder({
          subjectFolder:
            tempFolder.subjectFolder,
        });

      } catch (
        cleanupError
      ) {

        console.error(
          "⚠️ STUDY TEMP CLEANUP FAILED:",
          cleanupError?.message ||
            cleanupError
        );
      }
    }

    throw error;
  }
};

module.exports = {
  generateStudyNotes,
};