const buildStudyContentPrompt = ({
  subject,
  totalPages = 20,
}) => {
  return `
You are an expert college-level study notes planner.

CURRENT SUBJECT:
${subject}

TOTAL PAGES:
${totalPages}

LEVEL:
College / Undergraduate

LANGUAGE:
English

IMPORTANT:
The subject is dynamic.

Do NOT assume that the subject is Java, Python, DBMS,
Operating System, Networking, Accounting, or any other
specific subject.

Analyze the CURRENT SUBJECT first.

Create a complete logical ${totalPages}-page curriculum.

The curriculum must:

1. Start from fundamentals.
2. Progress logically toward intermediate and advanced concepts.
3. Avoid unnecessary repetition.
4. Make every page continue logically from the previous page.
5. Use only concepts relevant to the CURRENT SUBJECT.
6. Include definitions.
7. Include explanations.
8. Include useful examples.
9. Include important exam concepts.
10. Include diagrams wherever they genuinely help.
11. Include important comparisons where appropriate.
12. Use later pages for revision, summaries and exam-focused points.
13. Adapt the structure according to the CURRENT SUBJECT.
14. Do not use a fixed structure for every subject.
15. Do not add meaningless filler.

For every page return:

Page Number
Page Title
Topics
Key Concepts
Examples
Diagram / Flowchart
Exam Importance

Return exactly ${totalPages} pages.

Return ONLY valid JSON.

JSON format:

{
  "subject": "${subject}",
  "totalPages": ${totalPages},
  "pages": [
    {
      "pageNumber": 1,
      "title": "",
      "topics": [],
      "keyConcepts": [],
      "examples": [],
      "diagram": "",
      "examImportance": ""
    }
  ]
}
`;
};

module.exports = {
  buildStudyContentPrompt,
};