const {
  generateText,
} = require("../../services/ai/openaiService");

const {
  buildStudyContentPrompt,
} = require("../prompts/studyContentPrompt");

// ============================================================
// GENERATE STUDY CONTENT PLAN
// ============================================================

const generateStudyContentPlan = async ({
  subject,
  totalPages = 20,
}) => {
  if (!subject) {
    throw new Error(
      "Study Content: subject is required"
    );
  }

  if (
    !Number.isInteger(totalPages) ||
    totalPages <= 0
  ) {
    throw new Error(
      "Study Content: invalid totalPages"
    );
  }

  const cleanSubject =
    String(subject).trim();

  console.log("\n");
  console.log(
    "================================================"
  );
  console.log(
    "📚 STUDY EMPLOYEE — CONTENT PLANNER"
  );
  console.log(
    "================================================"
  );

  console.log(
    "Subject:",
    cleanSubject
  );

  console.log(
    "Total Pages:",
    totalPages
  );

  // ----------------------------------------------------------
  // BUILD PROMPT
  // ----------------------------------------------------------

  const userPrompt =
    buildStudyContentPrompt({
      subject: cleanSubject,
      totalPages,
    });

  // ----------------------------------------------------------
  // GENERATE CONTENT
  // ----------------------------------------------------------

  console.log(
    "Generating study content plan..."
  );

  const result =
    await generateText({
      systemPrompt: `
You are Laara Study Employee's
academic content planning engine.

Your task is to create an accurate,
logical and educational study curriculum
for the requested subject.

The subject provided by the user is the
ONLY source for deciding what concepts
should be included.

Do not assume a fixed subject.

Do not reuse concepts from another subject.

Follow the requested page count exactly.

Return ONLY valid JSON.

Do not use markdown.

Do not wrap the JSON inside code fences.
`,
      userPrompt,
      model:
        process.env.OPENAI_TEXT_MODEL ||
        "gpt-5-mini",
    });

  if (!result?.text) {
    throw new Error(
      "Study Content: AI returned empty response"
    );
  }

  // ----------------------------------------------------------
  // PARSE JSON
  // ----------------------------------------------------------

  let parsed;

  try {
    parsed =
      JSON.parse(result.text);
  } catch (error) {

    console.error(
      "❌ STUDY CONTENT JSON PARSE ERROR"
    );

    console.error(
      result.text
    );

    throw new Error(
      "Study Content: AI returned invalid JSON"
    );
  }

  // ----------------------------------------------------------
  // VALIDATE RESULT
  // ----------------------------------------------------------

  if (
    !parsed ||
    !Array.isArray(parsed.pages)
  ) {
    throw new Error(
      "Study Content: pages array missing"
    );
  }

  if (
    parsed.pages.length !==
    totalPages
  ) {
    throw new Error(
      `Study Content: expected ${totalPages} pages but received ${parsed.pages.length}`
    );
  }

  // ----------------------------------------------------------
  // VALIDATE EACH PAGE
  // ----------------------------------------------------------

  parsed.pages.forEach(
    (page, index) => {

      const expectedPage =
        index + 1;

      if (
        page.pageNumber !==
        expectedPage
      ) {
        throw new Error(
          `Study Content: invalid page number at index ${index}`
        );
      }

      if (
        !page.title ||
        typeof page.title !==
          "string"
      ) {
        throw new Error(
          `Study Content: page ${expectedPage} title missing`
        );
      }
    }
  );

  // ----------------------------------------------------------
  // FINAL RESULT
  // ----------------------------------------------------------

  const contentPlan = {
    subject: cleanSubject,
    totalPages,
    pages: parsed.pages,

    model:
      result.model ||
      process.env.OPENAI_TEXT_MODEL ||
      "gpt-5-mini",

    responseId:
      result.responseId || null,

    usage:
      result.usage || null,
  };

  console.log(
    "✅ STUDY CONTENT PLAN GENERATED"
  );

  console.log(
    "Pages:",
    contentPlan.pages.length
  );

  return contentPlan;
};

module.exports = {
  generateStudyContentPlan,
};