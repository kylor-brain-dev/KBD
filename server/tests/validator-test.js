const {
  ResponseValidator
} = require("../brain/validation/response-validator");

const validator =
  new ResponseValidator();

const knowledge = [
  {
    title:
      "6. JavaScript fundamentals - MDN Web Docs",
    sourceUrl:
      "https://developer.mozilla.org/en-US/curriculum/core/javascript-fundamentals/",
    content:
      "JavaScript is a programming language."
  }
];

const response =
  "JavaScript is a programming language used to create interactive behaviour on web pages.";

const result =
  validator.validate(
    response,
    knowledge
  );

console.log("=== RESPONSE VALIDATOR TEST ===");
console.log("Valid:", result.valid);
console.log("Status:", result.status);
console.log("Response length:", result.responseLength);
console.log("Sentences:", result.sentenceCount);
console.log("Knowledge used:", result.knowledgeUsed);
console.log("Sources:", result.sourceCount);
console.log("Reasons:", result.reasons);

if (!result.valid) {
  process.exitCode = 1;
}
