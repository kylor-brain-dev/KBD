const contractions = {
  "what's": "what is",
  "whats": "what is",
  "how's": "how is",
  "hows": "how is",
  "can't": "cannot",
  "cant": "cannot",
  "don't": "do not",
  "dont": "do not",
  "doesn't": "does not",
  "doesnt": "does not",
  "isn't": "is not",
  "isnt": "is not",
  "i'm": "i am",
  "im": "i am",
  "you're": "you are",
  "youre": "you are",
  "it's": "it is",
  "its": "it is"
};

function normalizeMessage(input) {
  let text = String(input)
    .normalize("NFKC")
    .toLowerCase()
    .trim();

  text = text.replace(/[’]/g, "'");

  for (const [from, to] of Object.entries(contractions)) {
    text = text.replace(
      new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
      to
    );
  }

  text = text
    .replace(/[!?.,;:()[\]{}"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

module.exports = {
  normalizeMessage
};
