const crypto = require("crypto");

const DEFAULT_MIN_TEXT_LENGTH = 200;
const DEFAULT_MAX_TEXT_LENGTH = 30000;

class SourceInspector {
  constructor(options = {}) {
    this.minTextLength =
      Number(options.minTextLength) || DEFAULT_MIN_TEXT_LENGTH;

    this.maxTextLength =
      Number(options.maxTextLength) || DEFAULT_MAX_TEXT_LENGTH;

    this.seenChecksums = new Set();
  }

  inspect(source) {
    const reasons = [];
    const text = String(source?.page?.text || "").trim();
    const url = String(source?.url || "").trim();
    const title = String(source?.title || "").trim();

    if (!title) {
      reasons.push("missing_title");
    }

    if (!url) {
      reasons.push("missing_url");
    }

    if (!source?.fetched || !source?.page?.ok) {
      reasons.push("page_not_fetched");
    }

    if (text.length < this.minTextLength) {
      reasons.push("insufficient_text");
    }

    if (text.length > this.maxTextLength) {
      reasons.push("text_exceeds_limit");
    }

    const checksum = text
      ? crypto.createHash("sha256").update(text).digest("hex")
      : null;

    if (checksum && this.seenChecksums.has(checksum)) {
      reasons.push("duplicate_content");
    }

    if (checksum && !reasons.includes("duplicate_content")) {
      this.seenChecksums.add(checksum);
    }

    const approved = reasons.length === 0;

    return {
      ok: true,
      approved,
      status: approved ? "approved" : "rejected",
      reasons,
      checksum,
      title,
      url,
      domain: source.domain || "",
      textLength: text.length,
      inspectedAt: new Date().toISOString()
    };
  }

  inspectMany(sources = []) {
    if (!Array.isArray(sources)) {
      throw new Error("Sources must be an array.");
    }

    return sources.map(source => this.inspect(source));
  }

  reset() {
    this.seenChecksums.clear();
  }
}

module.exports = {
  SourceInspector
};
