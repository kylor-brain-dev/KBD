const { normalizeMessage } = require("./intent/normalize");
const { correctText } = require("./intent/typos");
const { detectIntent } = require("./intent/detect");

async function processMessage(message, context = {}) {
  const original = String(message ?? "").trim();

  if (!original) {
    return {
      ok: false,
      error: "Message cannot be empty."
    };
  }

  const typoResult = correctText(
    original
      .normalize("NFKC")
      .toLowerCase()
      .trim()
  );

  const normalized = normalizeMessage(typoResult.text);
  const intent = detectIntent(normalized, context);

  return {
    ok: true,
    original,
    normalized,
    corrections: typoResult.corrections,
    intent,
    context
  };
}

module.exports = {
  processMessage
};
