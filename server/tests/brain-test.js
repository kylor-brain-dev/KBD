const { processMessage } = require("../brain/core");
const {
  StorageManager
} = require("../training/storage-manager");
const {
  KnowledgeRetriever
} = require("../brain/knowledge/retriever");
const {
  ResponseValidator
} = require("../brain/validation/response-validator");

(async () => {
  console.log("=== KYLOR OFFLINE BRAIN TEST ===");

  const question =
    "What is JavaScript and what is it used for?";

  const core =
    await processMessage(question);

  console.log(
    "Core:",
    core.ok ? "PASS" : "FAIL"
  );

  console.log(
    "Intent:",
    core.intent
      ? core.intent.primary
      : "(none)"
  );

  if (
    !core.ok ||
    !core.intent ||
    core.intent.primary !== "research"
  ) {
    console.error(
      "ERROR: Research intent failed."
    );
    process.exitCode = 1;
    return;
  }

  const storage =
    new StorageManager({
      root: "./data/training/storage"
    });

  const retriever =
    new KnowledgeRetriever(
      storage
    );

  const knowledge =
    retriever.search(question);

  console.log(
    "Approved knowledge:",
    knowledge.length
  );

  if (knowledge.length === 0) {
    console.error(
      "ERROR: No approved knowledge found."
    );
    process.exitCode = 1;
    return;
  }

  for (const item of knowledge) {
    console.log(
      "-",
      item.title,
      "| score:",
      item.score
    );
  }

  const validator =
    new ResponseValidator();

  const validation =
    validator.validate(
      "JavaScript is a programming language used to create interactive behaviour on web pages.",
      knowledge
    );

  console.log(
    "Validator:",
    validation.valid
      ? "PASS"
      : "FAIL"
  );

  if (!validation.valid) {
    console.error(
      "ERROR:",
      validation.reasons
    );
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log(
    "OFFLINE BRAIN TEST: PASS"
  );
})();
