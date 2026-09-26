class SearchProvider {
  constructor(options = {}) {
    this.name = options.name || "unknown";
  }

  async search() {
    throw new Error(
      `Search provider "${this.name}" does not implement search().`
    );
  }
}

function validateResults(results) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .filter(result => result && typeof result === "object")
    .map(result => ({
      title: String(result.title || "").trim(),
      url: String(result.url || "").trim(),
      snippet: String(
        result.snippet ||
        result.description ||
        ""
      ).trim()
    }))
    .filter(result => result.title && result.url);
}

module.exports = {
  SearchProvider,
  validateResults
};
