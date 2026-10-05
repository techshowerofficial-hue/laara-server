const fs = require("fs");
const path = require("path");
const {
  PDFDocument,
} = require("pdf-lib");

// ============================================================
// CREATE STUDY PDF
// ============================================================
//
// Input:
//   subjectFolder
//   subject
//   totalPages
//
// Input folder:
//   page-01.png
//   page-02.png
//   ...
//   page-20.png
//
// Output:
//   <subjectFolder>/<subject>-complete-notes.pdf
//
// Every image becomes exactly ONE PDF page.
//
// ============================================================

const createStudyPdf = async ({
  subject,
  subjectFolder,
  totalPages = 20,
}) => {

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!subject) {
    throw new Error(
      "Study PDF: subject is required"
    );
  }

  if (!subjectFolder) {
    throw new Error(
      "Study PDF: subjectFolder is required"
    );
  }

  if (
    !Number.isInteger(totalPages) ||
    totalPages <= 0
  ) {
    throw new Error(
      "Study PDF: invalid totalPages"
    );
  }

  if (
    !fs.existsSync(subjectFolder)
  ) {
    throw new Error(
      "Study PDF: subject folder does not exist"
    );
  }

  // ----------------------------------------------------------
  // CREATE PDF
  // ----------------------------------------------------------

  const pdfDoc =
    await PDFDocument.create();

  console.log("\n");
  console.log(
    "================================================"
  );
  console.log(
    "📄 STUDY EMPLOYEE — PDF CREATOR"
  );
  console.log(
    "================================================"
  );

  console.log(
    "Subject:",
    subject
  );

  console.log(
    "Total Pages:",
    totalPages
  );

  // ----------------------------------------------------------
  // ADD EACH IMAGE
  // ----------------------------------------------------------

  for (
    let pageNumber = 1;
    pageNumber <= totalPages;
    pageNumber++
  ) {

    const paddedPage =
      String(pageNumber)
        .padStart(2, "0");

    const pngPath =
      path.join(
        subjectFolder,
        `page-${paddedPage}.png`
      );

    const jpgPath =
      path.join(
        subjectFolder,
        `page-${paddedPage}.jpg`
      );

    let imagePath = null;
    let imageType = null;

    // --------------------------------------------------------
    // PNG
    // --------------------------------------------------------

    if (
      fs.existsSync(pngPath)
    ) {
      imagePath = pngPath;
      imageType = "png";
    }

    // --------------------------------------------------------
    // JPG FALLBACK
    // --------------------------------------------------------

    else if (
      fs.existsSync(jpgPath)
    ) {
      imagePath = jpgPath;
      imageType = "jpg";
    }

    // --------------------------------------------------------
    // IMAGE MISSING
    // --------------------------------------------------------

    else {
      throw new Error(
        `Study PDF: page ${pageNumber} image is missing`
      );
    }

    console.log(
      `Adding page ${pageNumber}/${totalPages}`
    );

    const imageBytes =
      fs.readFileSync(
        imagePath
      );

    let image;

    if (
      imageType === "png"
    ) {
      image =
        await pdfDoc.embedPng(
          imageBytes
        );
    } else {
      image =
        await pdfDoc.embedJpg(
          imageBytes
        );
    }

    // --------------------------------------------------------
    // IMAGE SIZE
    // --------------------------------------------------------

    const imageWidth =
      image.width;

    const imageHeight =
      image.height;

    // --------------------------------------------------------
    // PDF PAGE SAME AS IMAGE ASPECT RATIO
    // --------------------------------------------------------

    const pageWidth =
      imageWidth;

    const pageHeight =
      imageHeight;

    const pdfPage =
      pdfDoc.addPage([
        pageWidth,
        pageHeight,
      ]);

    // --------------------------------------------------------
    // DRAW FULL IMAGE
    // --------------------------------------------------------

    pdfPage.drawImage(
      image,
      {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      }
    );
  }

  // ----------------------------------------------------------
  // FINAL PDF
  // ----------------------------------------------------------

  const pdfBytes =
    await pdfDoc.save();

  const safeSubject =
    String(subject)
      .trim()
      .replace(
        /[\\/:*?"<>|]/g,
        "-"
      );

  const pdfPath =
    path.join(
      subjectFolder,
      `${safeSubject} Complete Notes.pdf`
    );

  fs.writeFileSync(
    pdfPath,
    pdfBytes
  );

  // ----------------------------------------------------------
  // VALIDATE FINAL FILE
  // ----------------------------------------------------------

  if (
    !fs.existsSync(pdfPath)
  ) {
    throw new Error(
      "Study PDF: PDF file was not created"
    );
  }

  const stats =
    fs.statSync(
      pdfPath
    );

  if (stats.size <= 0) {
    throw new Error(
      "Study PDF: generated PDF is empty"
    );
  }

  console.log("\n");
  console.log(
    "✅ STUDY PDF CREATED"
  );

  console.log(
    "File:",
    pdfPath
  );

  console.log(
    "Size:",
    stats.size,
    "bytes"
  );

  console.log(
    "Pages:",
    totalPages
  );

  return {
    pdfPath,
    fileName:
      `${safeSubject} Complete Notes.pdf`,
    size:
      stats.size,
    totalPages,
  };
};

module.exports = {
  createStudyPdf,
};