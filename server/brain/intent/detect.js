const { detectSubIntents } = require("./subintent");

const intents = [
  {
    name: "greeting",
    patterns: [
      /\bhello\b/,
      /\bhi\b/,
      /\bhey\b/,
      /\bhiya\b/,
      /\bhowdy\b/,
      /\bgood morning\b/,
      /\bgood afternoon\b/,
      /\bgood evening\b/
    ]
  },
  {
    name: "math",
    patterns: [
      /\bcalculate\b/,
      /\bsolve\b.*\bnumber\b/,
      /\bwhat is\b.*[%+\-*/]/,
      /\bpercent(age)?\b/,
      /\bmean\b/,
      /\bmedian\b/,
      /\bmode\b/,
      /\brange\b/,
      /\baverage\b/,
      /\bprobability\b/,
      /^-?\d+(?:\.\d+)?\s*[+\-*/]\s*-?\d+(?:\.\d+)?$/,
      /^-?\d+(?:\.\d+)?\s*%\s*(?:of\s+)?-?\d+(?:\.\d+)?$/
    ]
  },
  {
    name: "coding",
    patterns: [
      /\bcode\b/,
      /\bcoding\b/,
      /\bprogram\b/,
      /\bprogramming\b/,
      /\bjavascript\b/,
      /\bjs\b/,
      /\btypescript\b/,
      /\bpython\b/,
      /\bhtml\b/,
      /\bcss\b/,
      /\breact\b/,
      /\bnode\b/,
      /\bnodejs\b/,
      /\bapi\b/,
      /\bapis\b/,
      /\bendpoint\b/,
      /\bendpoints\b/,
      /\bbug\b/,
      /\berror\b/,
      /\bdebug\b/,
      /\bwebsite\b/,
      /\bweb app\b/,
      /\bwebpage\b/,
      /\bgame\b/
    ]
  },
  {
    name: "research",
    patterns: [
      /\bresearch\b/,
      /\bsearch\b/,
      /\blook up\b/,
      /\bfind information\b/,
      /\blatest\b/,
      /\bcurrent\b/,
      /\brecent\b/,
      /\bsources?\b/,
      /\bdocumentation\b/
    ]
  },
  {
    name: "science",
    patterns: [
      /\bscience\b/,
      /\bphysics\b/,
      /\bchemistry\b/,
      /\bbiology\b/,
      /\bspace\b/,
      /\batom\b/,
      /\bmolecule\b/,
      /\benergy\b/
    ]
  },
  {
    name: "training",
    patterns: [
      /\btrain\b/,
      /\btraining\b/,
      /\blearn\b/,
      /\blearning\b/,
      /\bteach yourself\b/,
      /\bimprove yourself\b/
    ]
  }
];

function scoreIntent(intent, message) {
  let score = 0;

  for (const pattern of intent.patterns) {
    if (pattern.test(message)) {
      score++;
    }
  }

  return score;
}

function detectIntent(message, context = {}) {
  const text = String(message ?? "").toLowerCase().trim();
  const scores = {};

  const codingActionPatterns = [
    /\bhow do i (make|build|create|write|code|program|fix|debug)\b/,
    /\bhow can i (make|build|create|write|code|program|fix|debug)\b/,
    /\bmake me\b/,
    /\bbuild me\b/,
    /\bcreate me\b/,
    /\bwrite (code|a script|a program)\b/,
    /\bfix (my|this|the)\b/,
    /\bdebug\b/,
    /\bprogramming\b/,
    /\bcoding\b/
  ];

  const researchQuestionPatterns = [
    /^what is\b/,
    /^what are\b/,
    /^who is\b/,
    /^who was\b/,
    /^when did\b/,
    /^when was\b/,
    /^where is\b/,
    /^why is\b/,
    /^why does\b/,
    /^how does\b/,
    /^how do\b/
  ];

  const hasCodingAction = codingActionPatterns.some(
    pattern => pattern.test(text)
  );

  const isResearchQuestion =
    researchQuestionPatterns.some(pattern => pattern.test(text)) &&
    !hasCodingAction;

  const codingSubIntents = detectSubIntents("coding", text);

  if (isResearchQuestion && codingSubIntents.length > 0) {
    const researchRules = intents.find(intent => intent.name === "research");
    const researchScore = Math.max(
      1,
      scoreIntent(researchRules, text)
    );

    scores.research = researchScore;

    return {
      primary: "research",
      secondary: [],
      subIntents: detectSubIntents("research", text),
      confidence: Math.min(1, researchScore / 3),
      scores,
      contextUsed: Boolean(context?.intent)
    };
  }

  /*
   * Coding sub-intents are checked first for actual coding requests.
   * This keeps website/game/debugging/programming requests in Coding.
   */
  if (codingSubIntents.length > 0) {
    scores.coding = Math.max(
      1,
      scoreIntent(
        intents.find(intent => intent.name === "coding"),
        text
      )
    );

    const secondary = [];

    for (const intent of intents) {
      if (intent.name === "coding") {
        continue;
      }

      const score = scoreIntent(intent, text);

      if (score > 0) {
        scores[intent.name] = score;
        secondary.push(intent.name);
      }
    }

    return {
      primary: "coding",
      secondary,
      subIntents: codingSubIntents,
      confidence: Math.min(1, scores.coding / 3),
      scores,
      contextUsed: Boolean(context?.intent)
    };
  }

  for (const intent of intents) {
    const score = scoreIntent(intent, text);

    if (score > 0) {
      scores[intent.name] = score;
    }
  }

  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    return {
      primary: "general",
      secondary: [],
      subIntents: [],
      confidence: 0,
      scores,
      contextUsed: Boolean(context?.intent)
    };
  }

  const primary = ranked[0][0];

  const secondary = ranked
    .slice(1)
    .map(([name]) => name);

  const subIntents = detectSubIntents(primary, text);

  return {
    primary,
    secondary,
    subIntents,
    confidence: Math.min(1, ranked[0][1] / 3),
    scores,
    contextUsed: Boolean(context?.intent)
  };
}
module.exports = {
  detectIntent
};
