const qwen = require("../reasoning/qwen");

const CODING_SUBINTENTS = {
  website: {
    name: "Website Builder",
    description: "Creates and improves websites, web pages, and web applications."
  },

  game: {
    name: "Game Development",
    description: "Creates and improves browser games and game systems."
  },

  debugging: {
    name: "Debugging",
    description: "Finds, explains, and fixes programming errors and broken behavior."
  },

  javascript: {
    name: "JavaScript",
    description: "Handles JavaScript programming and JavaScript-based applications."
  },

  python: {
    name: "Python",
    description: "Handles Python programming, scripts, automation, and applications."
  },

  html: {
    name: "HTML",
    description: "Handles HTML structure and document generation."
  },

  css: {
    name: "CSS",
    description: "Handles styling, layout, responsive design, and visual presentation."
  },

  api: {
    name: "API",
    description: "Handles APIs, endpoints, requests, responses, and integrations."
  },

  documentation: {
    name: "Documentation",
    description: "Handles programming documentation, references, and technical APIs."
  }
};

const TASK_BEHAVIOR = {
  explain: {
    goal: "Teach or explain the requested coding concept.",
    rules: [
      "Answer the exact question first.",
      "Keep the explanation concise and practical.",
      "Explain the steps or concept before showing code.",
      "If code is useful, show only a small focused example.",
      "Do not generate a complete website, application, game, or project.",
      "Do not output a full HTML document unless the user explicitly asks for one.",
      "Do not invent files or architecture the user did not ask for.",
      "Prefer explanation over implementation in explain mode."
    ]
  },

  build: {
    goal: "Build the implementation requested by the user.",
    rules: [
      "Prioritize usable implementation over lengthy explanation.",
      "Generate the code needed for the requested result.",
      "Keep the implementation focused on the user's requirements.",
      "Do not create unnecessary files, systems, dependencies, or duplicate architectures.",
      "If multiple files are genuinely required, clearly separate them by filename.",
      "Do not claim that code was tested unless it was actually tested."
    ]
  },

  debug: {
    goal: "Diagnose and fix the user's existing code or technical problem.",
    rules: [
      "Identify the likely cause of the problem.",
      "Explain the cause briefly.",
      "Provide the corrected code or exact change needed.",
      "Do not rewrite unrelated parts of the project.",
      "Do not invent errors that were not shown.",
      "Do not claim the fix was tested unless it was actually tested."
    ]
  }
};

function getCodingSubintents(subIntents = []) {
  return subIntents
    .filter(id => CODING_SUBINTENTS[id])
    .map(id => ({
      id,
      ...CODING_SUBINTENTS[id]
    }));
}

function detectTaskMode(message, taskType) {
  const text = String(message ?? "").toLowerCase().trim();

  const explanationPatterns = [
    /^how do i\b/,
    /^how can i\b/,
    /^how does\b/,
    /^how is\b/,
    /^what is\b/,
    /^what are\b/,
    /^why\b/,
    /^explain\b/,
    /^can you explain\b/,
    /^tell me how\b/
  ];

  if (explanationPatterns.some(pattern => pattern.test(text))) {
    return "explain";
  }

  const buildPatterns = [
    /\bmake me\b/,
    /\bbuild me\b/,
    /\bcreate me\b/,
    /\bmake a\b/,
    /\bbuild a\b/,
    /\bcreate a\b/,
    /\bgenerate a\b/,
    /\bgenerate the\b/,
    /\bwrite the code\b/,
    /\bwrite me\b/,
    /\bcode this\b/,
    /^make\b/,
    /^build\b/,
    /^create\b/,
    /^generate\b/
  ];

  if (buildPatterns.some(pattern => pattern.test(text))) {
    return "build";
  }

  if (taskType === "debugging") {
    return "debug";
  }

  return "explain";
}

function getTokenBudget(taskType, subIntents, mode = "explain") {
  const ids = new Set(subIntents);

  if (mode === "build") {
    if (taskType === "website" || taskType === "game") {
      return 300;
    }

    if (taskType === "api") {
      return 220;
    }

    return 200;
  }

  if (mode === "debug") {
    return 180;
  }

  if (taskType === "website") {
    return 80;
  }

  if (taskType === "game") {
    return 120;
  }

  if (taskType === "api") {
    return 120;
  }

  if (taskType === "documentation") {
    return 100;
  }

  if (
    ids.has("javascript") ||
    ids.has("python") ||
    ids.has("html") ||
    ids.has("css")
  ) {
    return 100;
  }

  return 80;
}

function analyze(message, intent = {}) {
  const subIntents = getCodingSubintents(intent.subIntents);

  const taskType = subIntents[0]?.id || "general_coding";
  const mode = detectTaskMode(message, taskType);
  const behavior = TASK_BEHAVIOR[mode];

  return {
    specialist: "coding",
    message: String(message ?? ""),
    subIntents,
    requiresModel: true,
    requiresTools: false,
    requiresProjectFiles: mode === "build",
    taskType,
    mode,
    goal: behavior.goal,
    behaviorRules: behavior.rules,
    tokenBudget: getTokenBudget(
      taskType,
      subIntents.map(item => item.id),
      mode
    )
  };
}

function buildTaskInstructions(analysis) {
  const behavior = TASK_BEHAVIOR[analysis.mode];

  const subintentText = analysis.subIntents.length
    ? analysis.subIntents
        .map(item => `- ${item.id}: ${item.description}`)
        .join("\n")
    : "- general coding";

  return `
CODING TASK
Task type: ${analysis.taskType}
Mode: ${analysis.mode}
Goal: ${behavior.goal}

Detected sub-intents:
${subintentText}

MODE RULES:
${behavior.rules.map(rule => `- ${rule}`).join("\n")}

PRIORITY:
1. Follow the user's actual request.
2. Use the detected task and sub-intents as guidance.
3. Stay within the response budget.
4. Do not add unnecessary architecture or explanation.
`;
}

async function solve(message, intent = {}, context = [], options = {}) {
  const analysis = analyze(message, intent);

  const result = await qwen.think({
    specialist: "coding",
    message,
    context,
    extraInstructions: buildTaskInstructions(analysis),
    options: {
      ...options,
      num_predict: options.num_predict ?? analysis.tokenBudget
    }
  });

  return {
    ...result,
    analysis
  };
}

module.exports = {
  analyze,
  solve,
  getCodingSubintents,
  getTokenBudget,
  detectTaskMode,
  buildTaskInstructions,
  CODING_SUBINTENTS,
  TASK_BEHAVIOR
};
