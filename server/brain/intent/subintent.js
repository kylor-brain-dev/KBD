const rules = {
  coding: [
    {
      name: "website",
      patterns: [
        /\bwebsite\b/,
        /\bweb site\b/,
        /\bwebpage\b/,
        /\blanding page\b/,
        /\bweb app\b/
      ]
    },
    {
      name: "game",
      patterns: [
        /\bgame\b/,
        /\bgames\b/,
        /\bgameplay\b/
      ]
    },
    {
      name: "debugging",
      patterns: [
        /\bbug\b/,
        /\berror\b/,
        /\bfix\b/,
        /\bdebug\b/,
        /\bnot working\b/
      ]
    },
    {
      name: "javascript",
      patterns: [
        /\bjavascript\b/,
        /\bjs\b/
      ]
    },
    {
      name: "python",
      patterns: [
        /\bpython\b/,
        /\bpy\b/
      ]
    },
    {
      name: "html",
      patterns: [
        /\bhtml\b/
      ]
    },
    {
      name: "css",
      patterns: [
        /\bcss\b/,
        /\bstyling\b/
      ]
    },
    {
      name: "api",
      patterns: [
        /\bapi\b/,
        /\bapis\b/,
        /\bendpoint\b/,
        /\bendpoints\b/,
        /\brest api\b/,
        /\brest apis\b/
      ]
    },
    {
      name: "documentation",
      patterns: [
        /\bdocumentation\b/,
        /\bdocs\b/,
        /\breference\b/
      ]
    }
  ],

  research: [
    {
      name: "latest",
      patterns: [
        /\blatest\b/,
        /\brecent\b/,
        /\bcurrent\b/,
        /\btoday\b/
      ]
    },
    {
      name: "sources",
      patterns: [
        /\bsources?\b/,
        /\bcitations?\b/,
        /\breferences?\b/
      ]
    },
    {
      name: "documentation",
      patterns: [
        /\bdocumentation\b/,
        /\bdocs\b/
      ]
    },
    {
      name: "fact_lookup",
      patterns: [
        /\bwhat is\b/,
        /\bwho is\b/,
        /\bwhen did\b/,
        /\bwhere is\b/
      ]
    },
    {
      name: "comparison",
      patterns: [
        /\bcompare\b/,
        /\bcomparison\b/,
        /\bdifference between\b/,
        /\bversus\b/,
        /\bvs\b/
      ]
    }
  ],

  math: [
    {
      name: "percentage",
      patterns: [
        /%/,
        /\bpercent\b/,
        /\bpercentage\b/
      ]
    },
    {
      name: "mean",
      patterns: [
        /\bmean\b/,
        /\baverage\b/
      ]
    },
    {
      name: "median",
      patterns: [
        /\bmedian\b/
      ]
    },
    {
      name: "mode",
      patterns: [
        /\bmode\b/
      ]
    },
    {
      name: "range",
      patterns: [
        /\brange\b/
      ]
    },
    {
      name: "algebra",
      patterns: [
        /\bsolve for\b/,
        /\bequation\b/,
        /\bx\s*[=+\-*/]/
      ]
    },
    {
      name: "arithmetic",
      patterns: [
        /-?\d+(?:\.\d+)?\s*[+\-*/]\s*-?\d+(?:\.\d+)?/
      ]
    }
  ],

  science: [
    {
      name: "physics",
      patterns: [
        /\bphysics\b/,
        /\bforce\b/,
        /\bvelocity\b/,
        /\benergy\b/,
        /\bmotion\b/
      ]
    },
    {
      name: "chemistry",
      patterns: [
        /\bchemistry\b/,
        /\batom\b/,
        /\bmolecule\b/,
        /\belement\b/,
        /\breaction\b/
      ]
    },
    {
      name: "biology",
      patterns: [
        /\bbiology\b/,
        /\bcell\b/,
        /\bdna\b/,
        /\borganism\b/,
        /\bgenetics\b/
      ]
    }
  ],

  training: [
    {
      name: "learning",
      patterns: [
        /\blearn\b/,
        /\blearning\b/,
        /\bteach\b/,
        /\btraining\b/
      ]
    }
  ]
};

function detectSubIntents(intent, message) {
  const categoryRules = rules[intent] || [];
  const matches = [];

  for (const rule of categoryRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(message)) {
        matches.push(rule.name);
        break;
      }
    }
  }

  return [...new Set(matches)];
}

module.exports = {
  detectSubIntents
};
