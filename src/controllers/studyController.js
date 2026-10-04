const {
  findStudyNotes,
} = require("../services/studyService");


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


    console.log("");
    console.log(
      "========================================"
    );

    console.log(
      "📚 LAARA STUDY EMPLOYEE"
    );

    console.log(
      "========================================"
    );

    console.log(
      "User ID:",
      userId
    );

    console.log(
      "Subject:",
      subject
    );


    // ========================================================
    // CHECK MASTER DRIVE
    // ========================================================

    const notes =
      await findStudyNotes({
        subject,
      });


    // ========================================================
    // NOTES FOUND
    // ========================================================

    if (notes.found) {

      console.log(
        "✅ STUDY NOTES FOUND IN MASTER DRIVE"
      );

      return res.status(200).json({

        success: true,

        status: "READY",

        message:
          "Study notes already available",

        subject:
          notes.subject,

        files:
          notes.files,

      });
    }


    // ========================================================
    // NOTES NOT FOUND
    // ========================================================

    console.log(
      "📭 STUDY NOTES NOT FOUND"
    );

    return res.status(200).json({

      success: true,

      status: "NOT_FOUND",

      message:
        "Study notes need to be generated",

      subject:
        notes.subject,

      files: [],

    });


  } catch (error) {

    console.error(
      "Study Employee Error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Study Employee failed",

    });
  }
};


module.exports = {
  startStudy,
};