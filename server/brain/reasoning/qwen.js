const ollama = require("../../providers/ollama");

const SPECIALIST_PROMPTS = {
  general: "You are Kylor, a helpful, accurate, concise local AI assistant.",
  coding: "You are Kylor's Coding specialist. Help with programming, debugging, websites, games, APIs, HTML, CSS, JavaScript, TypeScript, Python, and software architecture. Answer the exact request, keep simple answers short, provide usable code, avoid unnecessary files and duplicate systems, and never claim code was tested when it was not.",
  research: "You are Kylor's Research specialist. Analyze questions carefully, distinguish evidence from uncertainty, and never pretend you searched the web when you did not.",
  maths: "You are Kylor's Maths specialist. Solve problems carefully, check arithmetic, and show useful calculation steps.",
  science: "You are Kylor's Science specialist. Explain scientific concepts accurately and clearly while distinguishing established knowledge from uncertainty.",
  trainer: "You are Kylor's Training specialist. Help Kylor learn, evaluate information, and separate reliable knowledge from unverified information."
};

function getSystemPrompt(specialist = "general", extraInstructions = "") {
  const base = SPECIALIST_PROMPTS[specialist] || SPECIALIST_PROMPTS.general;
  return `${base}\n\n${String(extraInstructions || "").trim()}`.trim();
}

function buildMessages({
  specialist = "general",
  message,
  context = [],
  extraInstructions = ""
}) {
  const messages = [
    {
      role: "system",
      content: getSystemPrompt(specialist, extraInstructions)
    }
  ];

  if (Array.isArray(context)) {
    for (const item of context) {
      if (
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
      ) {
        messages.push({
          role: item.role,
          content: item.content
        });
      }
    }
  }

  messages.push({
    role: "user",
    content: String(message ?? "")
  });

  return messages;
}

async function think({
  specialist = "general",
  message,
  context = [],
  extraInstructions = "",
  options = {}
}) {
  if (!String(message ?? "").trim()) {
    return {
      ok: false,
      error: "Cannot reason about an empty message."
    };
  }

  const result = await ollama.generate(
    buildMessages({
      specialist,
      message,
      context,
      extraInstructions
    }),
    {
      model: options.model,
      temperature: options.temperature ?? 0.3,
      num_ctx: options.num_ctx ?? 1024,
      num_predict: options.num_predict ?? 160,
      timeout: options.timeout ?? 180000
    }
  );

  if (!result.ok) {
    return {
      ok: false,
      specialist,
      error: result.error,
      details: result.details || null
    };
  }

  return {
    ok: true,
    specialist,
    model: result.model,
    response: result.text,
    done: result.done !== false,
    usage: result.usage || null
  };
}

module.exports = {
  think,
  buildMessages,
  getSystemPrompt,
  SPECIALIST_PROMPTS
};
