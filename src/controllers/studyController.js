const {
  getStudySubjects,
  readStudyNotes,
  getStudyPdf,
} = require("../services/studyService");

/*
 * =========================================
 * GET AVAILABLE STUDY SUBJECTS
 * =========================================
 */

const getAvailableSubjects = async (
  req,
  res
) => {
  try {

    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const subjects =
      await getStudySubjects();

    return res.status(200).json({
      success: true,
      subjects,
    });

  } catch (error) {

    console.error(
      "GET STUDY SUBJECTS ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get study subjects",
      error:
        error.message,
    });
  }
};
/*
 * =========================================
 * START STUDY
 * =========================================
 */

/*
 * =========================================
 * START STUDY
 * =========================================
 */

const startStudy = async (
  req,
  res
) => {
  try {

    const userId =
      req.user?.userId;


    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }


    const subject =
      String(
        req.body?.subject || ""
      ).trim();


    if (!subject) {
      return res.status(400).json({
        success: false,
        message:
          "Subject is required",
      });
    }


    console.log(
      "================================="
    );

    console.log(
      "📚 LAARA STUDY EMPLOYEE"
    );

    console.log(
      "User ID:",
      userId
    );

    console.log(
      "Subject:",
      subject
    );


    // ================================================
    // CHECK EXISTING NOTES
    // ================================================

    const studyNotes =
      await readStudyNotes({
        subject,
      });


    console.log(
      "Study Notes Found:",
      studyNotes.found
    );


    // ================================================
    // NOTES ALREADY EXIST
    // ================================================

    if (studyNotes.found) {

      return res.status(200).json({

        success: true,

        status: "READY",

        message:
          "Study notes found",

        subject:
          studyNotes.subject,

        files:
          studyNotes.files.map(
            (file) => ({
              id: file.id,

              name: file.name,

              mimeType:
                file.mimeType,

              size:
                file.size,
            })
          ),
      });
    }


    // ================================================
    // NOTES DON'T EXIST
    // ================================================

    return res.status(200).json({

      success: true,

      status:
        "GENERATE_REQUIRED",

      message:
        "Study notes are not available. They can be generated.",

      subject:
        studyNotes.subject,

      files: [],

    });

  } catch (error) {

    console.error(
      "START STUDY ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );


    return res.status(500).json({

      success: false,

      message:
        "Failed to start study",

      error:
        error.message,

    });
  }
};

/*
 * =========================================
 * OPEN / STREAM STUDY PDF
 * =========================================
 */

const openStudyPdf = async (
  req,
  res
) => {
  try {

    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }


    const subject =
      String(
        req.params.subject || ""
      ).trim();

    const fileId =
      String(
        req.params.fileId || ""
      ).trim();


    if (!subject) {
      return res.status(400).json({
        success: false,
        message:
          "Subject is required",
      });
    }


    if (!fileId) {
      return res.status(400).json({
        success: false,
        message:
          "File ID is required",
      });
    }


    console.log(
      "📄 OPEN STUDY PDF"
    );

    console.log(
      "User ID:",
      userId
    );

    console.log(
      "Subject:",
      subject
    );

    console.log(
      "File ID:",
      fileId
    );


    const result =
      await getStudyPdf({
        subject,
        fileId,
      });


    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.file.name}"`
    );

    res.setHeader(
      "Content-Length",
      result.buffer.length
    );


    return res.send(
      result.buffer
    );

  } catch (error) {

    console.error(
      "OPEN STUDY PDF ERROR:",
      error?.message ||
        error
    );


    if (
      error.statusCode
    ) {
      return res.status(
        error.statusCode
      ).json({
        success: false,
        message:
          error.message,
      });
    }


    return res.status(500).json({
      success: false,
      message:
        "Failed to open study PDF",
      error:
        error.message,
    });
  }
};


module.exports = {
  getAvailableSubjects,
  startStudy,
  openStudyPdf,
};