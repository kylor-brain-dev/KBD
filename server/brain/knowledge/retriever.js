class KnowledgeRetriever {
  constructor(storage, options = {}) {
    if (!storage) {
      throw new Error("Storage manager is required.");
    }

    this.storage = storage;
    this.maxResults =
      Number(options.maxResults) || 5;
  }

  tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) || [];
  }

  score(query, record) {
    const queryWords = new Set(
      this.tokenize(query)
    );

    const contentWords =
      this.tokenize(record.content);

    if (
      queryWords.size === 0 ||
      contentWords.length === 0
    ) {
      return 0;
    }

    const contentSet = new Set(
      contentWords
    );

    let matches = 0;

    for (const word of queryWords) {
      if (contentSet.has(word)) {
        matches++;
      }
    }

    const titleWords = new Set(
      this.tokenize(record.title)
    );

    for (const word of queryWords) {
      if (titleWords.has(word)) {
        matches += 2;
      }
    }

    return matches;
  }

  search(query, subject = null) {
    const records = this.storage.list(
      "approved",
      subject
    );

    const results = [];

    for (const metadata of records) {
      const record =
        this.storage.readSource(
          "approved",
          metadata.subject,
          metadata.id
        );

      if (!record) {
        continue;
      }

      const score = this.score(
        query,
        record
      );

      if (score <= 0) {
        continue;
      }

      results.push({
        id: record.id,
        subject: record.subject,
        topic: record.topic,
        title: record.title,
        sourceUrl:
          record.sourceUrl ||
          record.url,
        score,
        content: record.content
      });
    }

    results.sort(
      (a, b) => b.score - a.score
    );

    return results.slice(
      0,
      this.maxResults
    );
  }
}

module.exports = {
  KnowledgeRetriever
};
