const {
  generateImage,
} = require("../../services/ai/imageGenerationService");

// ============================================================
// BUILD HANDWRITTEN PAGE PROMPT
// ============================================================

const buildHandwrittenPagePrompt = ({
  subject,
  page,
  totalPages,
  referenceImage = "",
}) => {
  return `
Create exactly ONE realistic handwritten college notebook page.

CURRENT SUBJECT:
${subject}

CURRENT PAGE:
${page.pageNumber}/${totalPages}

CURRENT PAGE TITLE:
${page.title}

CURRENT PAGE TOPICS:
${JSON.stringify(page.topics || [])}

CURRENT PAGE KEY CONCEPTS:
${JSON.stringify(page.keyConcepts || [])}

CURRENT PAGE EXAMPLES:
${JSON.stringify(page.examples || [])}

CURRENT PAGE DIAGRAM:
${page.diagram || "No diagram required"}

CURRENT PAGE EXAM IMPORTANCE:
${page.examImportance || ""}

REFERENCE IMAGE:
${referenceImage || "No reference image provided."}

IMPORTANT VISUAL RULES:

The reference image is the PRIMARY VISUAL MASTER.

Make the generated page look like the SAME student
wrote these notes in the SAME notebook.

Maintain:

- same handwriting character
- same notebook
- same paper
- same page texture
- same horizontal ruling
- same left margin
- same pen style
- same ink colors
- same heading style
- same underline style
- same highlighting style
- same diagram style
- same background
- same lighting
- same camera angle
- same photographic realism

The result must look like a REAL photograph
of handwritten college notes.

HANDWRITING:

- realistic student handwriting
- neat but slightly imperfect
- readable
- natural letter spacing
- natural baseline variation
- natural pen pressure
- slightly different letter sizes
- NOT a computer font

NOTEBOOK:

- light grey/off-white paper
- subtle paper texture
- thin horizontal ruling
- subtle blue/grey lines
- thin reddish/pink left margin

INK:

- body text: dark blue / blue-black
- headings: green / teal
- important terms: occasional red
- important keywords: natural yellow highlighter

Do not overuse colors.

DIAGRAM:

If a diagram is specified, make it genuinely relevant
to the CURRENT SUBJECT.

The diagram must look hand-drawn.

Use:
- imperfect boxes
- hand-drawn arrows
- handwritten labels
- thin pen lines

Do NOT create professional vector graphics.

PAGE FILL:

Use the notebook space naturally.

Do not leave a huge empty area.

Do not overcrowd the page.

If more space is available, use useful:
- examples
- key points
- exam tips
- summaries
- diagrams

Do not add meaningless filler.

PAGE NUMBER:

Clearly include:

Page ${page.pageNumber}/${totalPages}

Keep the page-number style consistent.

PHOTOGRAPHY:

The notebook page should look photographed with
a smartphone from approximately top-down.

Include:
- slight natural perspective
- subtle shadows
- realistic indoor lighting
- slight lens softness
- natural exposure
- subtle table/background around notebook edges

Do NOT create:
- a digital infographic
- a typed document
- a scanned PDF
- a studio mockup
- a plain isolated white page

EDUCATIONAL CONTENT:

Use ONLY the CURRENT SUBJECT and CURRENT PAGE information.

Do not introduce unrelated concepts.

Do not reuse concepts from another subject.

Generate exactly ONE notebook page image.

No explanation.
`;
};

// ============================================================
// GENERATE ONE STUDY PAGE
// ============================================================

const generateStudyPageImage = async ({
  subject,
  page,
  totalPages = 20,
  referenceImage = "",
  size,
  quality,
}) => {
  if (!subject) {
    throw new Error(
      "Study Image: subject is required"
    );
  }

  if (!page) {
    throw new Error(
      "Study Image: page is required"
    );
  }

  if (!page.pageNumber) {
    throw new Error(
      "Study Image: page number is required"
    );
  }

  const prompt =
    buildHandwrittenPagePrompt({
      subject,
      page,
      totalPages,
      referenceImage,
    });

  console.log("\n");
  console.log(
    "================================================"
  );
  console.log(
    "📝 STUDY EMPLOYEE — HANDWRITTEN PAGE"
  );
  console.log(
    "================================================"
  );

  console.log(
    "Subject:",
    subject
  );

  console.log(
    "Page:",
    `${page.pageNumber}/${totalPages}`
  );

  console.log(
    "Title:",
    page.title
  );

  console.log(
    "Generating image..."
  );

  const result =
    await generateImage({
      prompt,

      size:
        size ||
        process.env.OPENAI_IMAGE_SIZE ||
        "1024x1536",

      quality:
        quality ||
        process.env.OPENAI_IMAGE_QUALITY ||
        "auto",
    });

  if (!result?.generatedPath) {
    throw new Error(
      `Study Image: page ${page.pageNumber} generated but path is missing`
    );
  }

  console.log(
    `✅ Page ${page.pageNumber} generated`
  );

  console.log(
    "Path:",
    result.generatedPath
  );

  return {
    pageNumber:
      page.pageNumber,

    title:
      page.title,

    generatedPath:
      result.generatedPath,

    generatedFile:
      result.generatedFile,

    model:
      result.model || null,

    prompt,
  };
};

// ============================================================
// GENERATE ALL STUDY PAGE IMAGES
// ============================================================

const generateStudyPageImages = async ({
  subject,
  pages,
  totalPages = 20,
  referenceImage = "",
  size,
  quality,
}) => {
  if (!subject) {
    throw new Error(
      "Study Image: subject is required"
    );
  }

  if (
    !Array.isArray(pages) ||
    !pages.length
  ) {
    throw new Error(
      "Study Image: pages are required"
    );
  }

  if (
    pages.length !== totalPages
  ) {
    throw new Error(
      `Study Image: expected ${totalPages} pages but received ${pages.length}`
    );
  }

  const generatedPages = [];

  console.log("\n");
  console.log(
    "================================================"
  );
  console.log(
    "📚 GENERATING ALL STUDY PAGE IMAGES"
  );
  console.log(
    "================================================"
  );

  /*
   * Sequential generation intentionally.
   *
   * Isse:
   * - order clear rahega
   * - API par sudden 20 requests nahi jayengi
   * - failed page ko identify karna easy rahega
   */

  for (
    let index = 0;
    index < pages.length;
    index++
  ) {
    const page =
      pages[index];

    const generatedPage =
      await generateStudyPageImage({
        subject,
        page,
        totalPages,
        referenceImage,
        size,
        quality,
      });

    generatedPages.push(
      generatedPage
    );
  }

  console.log("\n");
  console.log(
    "✅ ALL STUDY PAGE IMAGES GENERATED"
  );

  console.log(
    "Total:",
    generatedPages.length
  );

  return generatedPages;
};

module.exports = {
  buildHandwrittenPagePrompt,
  generateStudyPageImage,
  generateStudyPageImages,
};