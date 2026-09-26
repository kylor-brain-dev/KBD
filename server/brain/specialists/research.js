const qwen = require("../reasoning/qwen");
const { StorageManager } = require("../../training/storage-manager");
const { KnowledgeRetriever } = require("../knowledge/retriever");
const { ResponseValidator } = require("../validation/response-validator");

const RESEARCH_SUBINTENTS = {
  latest: {
    name: "Latest Information",
    description: "Finds recent or current information."
  },

  sources: {
    name: "Sources",
    description: "Finds and organizes reliable sources for a question."
  },

  documentation: {
    name: "Documentation",
    description: "Researches technical documentation and references."
  },

  fact_lookup: {
    name: "Fact Lookup",
    description: "Finds specific factual information."
  },

  comparison: {
    name: "Comparison",
    description: "Researches multiple subjects and compares documented information."
  }
};

function getResearchSubintents(subIntents = []) {
  return subIntents
    .filter(id => RESEARCH_SUBINTENTS[id])
    .map(id => ({
      id,
      ...RESEARCH_SUBINTENTS[id]
    }));
}

function createKnowledgeRetriever(options = {}) {
  const storage = new StorageManager({
    root: options.storageRoot
  });

  return new KnowledgeRetriever(
    storage,
    {
      maxResults:
        options.maxResults || 5
    }
  );
}

function analyze(message, intent = {}) {
  const subIntents = getResearchSubintents(intent.subIntents);

  let taskType = subIntents[0]?.id || "general_research";

  if (subIntents.some(item => item.id === "latest")) {
    taskType = "latest";
  }

  return {
    specialist: "research",
    message: String(message ?? ""),
    subIntents,
    taskType,
    requiresModel: true,
    requiresWeb: true,
    requiresSources: true
  };
}

function buildResearchInstructions(analysis) {
  const subintentText = analysis.subIntents.length
    ? analysis.subIntents
        .map(item => `- ${item.id}: ${item.description}`)
        .join("\n")
    : "- general research";

  return `
RESEARCH TASK

Task type: ${analysis.taskType}

Detected sub-intents:
${subintentText}

RULES:
- Answer the user's actual research question.
- Separate established facts from uncertainty.
- Do not invent sources.
- Do not claim that information was searched or verified unless it actually was.
- Prefer primary or authoritative sources when available.
- For current or latest information, use current sources.
- For comparisons, keep each side factually distinct.
- Use concise explanations.
- If sources are provided later, use them as evidence rather than inventing citations.
`;
}

async function solve(message, intent = {}, context = [], options = {}) {
  const analysis = analyze(message, intent);

  const retriever = createKnowledgeRetriever({
    storageRoot: options.storageRoot,
    maxResults: options.maxKnowledgeResults || 5
  });

  const knowledge = retriever.search(
    message
  );

  const validator = new ResponseValidator();

  const knowledgeContext = knowledge.length
    ? knowledge
        .map(
          item =>
            `Title: ${item.title}\n` +
            `Source: ${item.sourceUrl}\n` +
            `Content: ${item.content}`
        )
        .join("\n\n---\n\n")
    : "No approved local knowledge matched this question.";

  const result = await qwen.think({
    specialist: "research",
    message,
    context,
    extraInstructions:
      buildResearchInstructions(analysis) +
      `

APPROVED LOCAL KNOWLEDGE

Use the following approved knowledge when it is relevant:

${knowledgeContext}

RULES FOR LOCAL KNOWLEDGE:
- Treat this as approved local research material.
- Do not claim a source says something that is not present.
- Preserve uncertainty.
- Do not invent citations.
- If local knowledge does not answer the question, say so.
`,
    options: {
      ...options,
      num_predict: options.num_predict ?? 160
    }
  });

  const validation = validator.validate(
    result.response || "",
    knowledge
  );

  return {
    ...result,
    analysis,
    knowledge,
    validation
  };
}

module.exports = {
  analyze,
  solve,
  getResearchSubintents,
  buildResearchInstructions,
  RESEARCH_SUBINTENTS
};
