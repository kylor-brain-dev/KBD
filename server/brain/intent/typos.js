const dictionary = [
  "hello",
  "hi",
  "hey",
  "how",
  "what",
  "why",
  "when",
  "where",
  "who",
  "make",
  "build",
  "create",
  "website",
  "web",
  "game",
  "coding",
  "code",
  "javascript",
  "typescript",
  "python",
  "html",
  "css",
  "search",
  "research",
  "latest",
  "documentation",
  "math",
  "calculate",
  "mean",
  "median",
  "mode",
  "range",
  "average",
  "science",
  "physics",
  "chemistry",
  "biology",
  "train",
  "training",
  "learn",
  "help"
];

const protectedWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "i",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your"
]);

function distance(a, b) {
  const matrix = Array.from(
    { length: a.length + 1 },
    () => Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function correctionLimit(word) {
  if (word.length <= 3) return 1;
  if (word.length <= 6) return 2;
  return 3;
}

function correctWord(word) {
  if (!word || word.length < 2) {
    return {
      word,
      corrected: word,
      changed: false
    };
  }

  if (protectedWords.has(word) || dictionary.includes(word)) {
    return {
      word,
      corrected: word,
      changed: false
    };
  }

  let best = null;

  for (const candidate of dictionary) {
    const limit = correctionLimit(word);

    if (Math.abs(candidate.length - word.length) > limit) {
      continue;
    }

    const score = distance(word, candidate);

    if (score <= limit && (!best || score < best.score)) {
      best = {
        candidate,
        score
      };
    }
  }

  if (!best) {
    return {
      word,
      corrected: word,
      changed: false
    };
  }

  return {
    word,
    corrected: best.candidate,
    changed: true,
    distance: best.score
  };
}

function correctText(text) {
  const words = text.split(/\s+/);
  const corrections = [];

  const correctedWords = words.map(word => {
    const result = correctWord(word);

    if (result.changed) {
      corrections.push(result);
    }

    return result.corrected;
  });

  return {
    text: correctedWords.join(" "),
    corrections
  };
}

module.exports = {
  correctWord,
  correctText
};
