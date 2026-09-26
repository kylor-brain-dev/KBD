const crypto = require("crypto");

class SourceCollector {
  constructor(options = {}) {
    this.maxSourcesPerTarget = options.maxSourcesPerTarget || 10;
    this.sources = new Map();
  }

  normalizeResult(result = {}) {
    const title = String(result.title || "").trim();
    const url = String(result.url || "").trim();
    const snippet = String(
      result.snippet ||
      result.description ||
      ""
    ).trim();

    if (!title || !url) {
      return null;
    }

    return {
      id: crypto
        .createHash("sha256")
        .update(url)
        .digest("hex")
        .slice(0, 24),

      title,
      url,
      snippet,
      domain: this.getDomain(url),
      discoveredAt: new Date().toISOString(),
      status: "discovered"
    };
  }

  collect(subject, targetId, results = []) {
    const subjectName = String(subject || "")
      .trim()
      .toLowerCase();

    if (!subjectName) {
      throw new Error("Subject is required.");
    }

    if (!targetId) {
      throw new Error("Target ID is required.");
    }

    if (!Array.isArray(results)) {
      throw new Error("Search results must be an array.");
    }

    const key = `${subjectName}:${targetId}`;
    const existing = this.sources.get(key) || [];

    for (const result of results) {
      if (existing.length >= this.maxSourcesPerTarget) {
        break;
      }

      const source = this.normalizeResult(result);

      if (!source) {
        continue;
      }

      const duplicate = existing.some(
        item => item.id === source.id
      );

      if (!duplicate) {
        existing.push({
          ...source,
          subject: subjectName,
          targetId
        });
      }
    }

    this.sources.set(key, existing);

    return existing;
  }

  getSources(subject, targetId) {
    const subjectName = String(subject || "")
      .trim()
      .toLowerCase();

    return this.sources.get(
      `${subjectName}:${targetId}`
    ) || [];
  }

  getAllSources() {
    return [...this.sources.values()].flat();
  }

  getDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }
}

module.exports = {
  SourceCollector
};
