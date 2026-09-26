class ResponseValidator {
  constructor(options = {}) {
    this.minResponseLength =
      Number(options.minResponseLength) || 1;

    this.minClaimWords =
      Number(options.minClaimWords) || 3;

    this.strongMatchThreshold =
      Number(options.strongMatchThreshold) || 0.45;

    this.weakMatchThreshold =
      Number(options.weakMatchThreshold) || 0.2;

    this.phraseSize =
      Number(options.phraseSize) || 3;
  }

  normalize(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  tokenize(text) {
    return this.normalize(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  extractSentences(text) {
    const normalized = this.normalize(text);

    if (!normalized) {
      return [];
    }

    return normalized
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean);
  }

  extractClaims(text) {
    return this.extractSentences(text)
      .filter(sentence => {
        return (
          this.tokenize(sentence).length >=
          this.minClaimWords
        );
      })
      .map((sentence, index) => ({
        id: index + 1,
        text: sentence,
        words: this.tokenize(sentence)
      }));
  }

  getKnowledgeText(knowledge) {
    return knowledge
      .map(item =>
        [
          item?.title || "",
          item?.content || "",
          item?.description || ""
        ].join(" ")
      )
      .join(" ");
  }

  getPhrases(words, size) {
    if (words.length < size) {
      return [];
    }

    const phrases = [];

    for (
      let index = 0;
      index <= words.length - size;
      index++
    ) {
      phrases.push(
        words.slice(index, index + size).join(" ")
      );
    }

    return phrases;
  }

  extractNumbers(words) {
    return words.filter(word =>
      /^\d+(?:\.\d+)?$/.test(word)
    );
  }

  calculateOverlap(claimWords, knowledgeWords) {
    const meaningfulWords =
      claimWords.filter(word => word.length >= 3);

    if (!meaningfulWords.length) {
      return 0;
    }

    const knowledgeSet =
      new Set(knowledgeWords);

    const matched =
      meaningfulWords.filter(word =>
        knowledgeSet.has(word)
      ).length;

    return matched / meaningfulWords.length;
  }

  calculatePhraseOverlap(
    claimWords,
    knowledgeWords
  ) {
    const claimPhrases =
      this.getPhrases(
        claimWords,
        this.phraseSize
      );

    if (!claimPhrases.length) {
      return 0;
    }

    const knowledgePhrases =
      new Set(
        this.getPhrases(
          knowledgeWords,
          this.phraseSize
        )
      );

    const matched =
      claimPhrases.filter(phrase =>
        knowledgePhrases.has(phrase)
      ).length;

    return matched / claimPhrases.length;
  }

  classifyClaim(claim, knowledge) {
    const knowledgeText =
      this.getKnowledgeText(knowledge);

    const knowledgeWords =
      this.tokenize(knowledgeText);

    const keywordOverlap =
      this.calculateOverlap(
        claim.words,
        knowledgeWords
      );

    const phraseOverlap =
      this.calculatePhraseOverlap(
        claim.words,
        knowledgeWords
      );

    const claimNumbers =
      this.extractNumbers(claim.words);

    const knowledgeNumbers =
      new Set(
        this.extractNumbers(
          knowledgeWords
        )
      );

    const missingNumbers =
      claimNumbers.filter(
        number =>
          !knowledgeNumbers.has(number)
      );

    const numbersSupported =
      missingNumbers.length === 0;

    let status = "unsupported";

    if (
      keywordOverlap >=
        this.strongMatchThreshold &&
      (
        phraseOverlap >= 0.15 ||
        claim.words.length <= 6
      ) &&
      numbersSupported
    ) {
      status = "supported";
    } else if (
      keywordOverlap >=
        this.weakMatchThreshold &&
      numbersSupported
    ) {
      status = "weak";
    }

    return {
      id: claim.id,
      text: claim.text,
      status,
      keywordOverlap:
        Number(keywordOverlap.toFixed(3)),
      phraseOverlap:
        Number(phraseOverlap.toFixed(3)),
      missingNumbers
    };
  }

  validate(response, knowledge = []) {
    const text = this.normalize(response);
    const reasons = [];

    if (!text) {
      reasons.push("Response is empty.");
    }

    if (
      text.length > 0 &&
      text.length < this.minResponseLength
    ) {
      reasons.push(
        `Response is shorter than ${this.minResponseLength} characters.`
      );
    }

    const sources = Array.isArray(knowledge)
      ? knowledge
      : [];

    const sourceUrls =
      sources
        .map(item =>
          item && item.sourceUrl
        )
        .filter(Boolean);

    const sentences =
      this.extractSentences(text);

    const claims =
      this.extractClaims(text);

    const claimResults =
      sources.length
        ? claims.map(claim =>
            this.classifyClaim(
              claim,
              sources
            )
          )
        : claims.map(claim => ({
            id: claim.id,
            text: claim.text,
            status: "unsupported",
            keywordOverlap: 0,
            phraseOverlap: 0,
            missingNumbers:
              this.extractNumbers(
                claim.words
              )
          }));

    const supportedClaims =
      claimResults.filter(
        claim =>
          claim.status === "supported"
      ).length;

    const weakClaims =
      claimResults.filter(
        claim =>
          claim.status === "weak"
      ).length;

    const unsupportedClaims =
      claimResults.filter(
        claim =>
          claim.status === "unsupported"
      ).length;

    const groundedClaims =
      supportedClaims + weakClaims;

    const groundingScore =
      claimResults.length
        ? Number(
            (
              groundedClaims /
              claimResults.length
            ).toFixed(3)
          )
        : 0;

    if (
      sources.length > 0 &&
      unsupportedClaims > 0
    ) {
      reasons.push(
        `${unsupportedClaims} claim(s) were not sufficiently supported by approved knowledge.`
      );
    }

    const knowledgeUsed =
      sources.length > 0;

    const sourceMentioned =
      sourceUrls.some(url =>
        text.includes(url)
      );

    return {
      valid:
        reasons.length === 0,

      status:
        reasons.length === 0
          ? "valid"
          : "rejected",

      reasons,

      responseLength:
        text.length,

      sentenceCount:
        sentences.length,

      knowledgeUsed,

      sourceCount:
        sources.length,

      sourceUrls,

      sourceMentioned,

      claimCount:
        claimResults.length,

      supportedClaims,

      weakClaims,

      unsupportedClaims,

      groundingScore,

      claims:
        claimResults,

      checkedAt:
        new Date().toISOString()
    };
  }
}

module.exports = {
  ResponseValidator
};
