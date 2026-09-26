const crypto = require("crypto");

class KnowledgeRefiner {
  constructor(options = {}) {
    this.maxContentLength =
      Number(options.maxContentLength) || 20000;
  }

  cleanText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim();
  }

  createChecksum(text) {
    return crypto
      .createHash("sha256")
      .update(text, "utf8")
      .digest("hex");
  }

  refine(source) {
    if (!source || typeof source !== "object") {
      throw new Error("Source is required.");
    }

    if (source.stage !== "inspected") {
      throw new Error(
        "Only inspected sources can be refined."
      );
    }

    const original = String(
      source.content || ""
    ).trim();

    if (!original) {
      throw new Error(
        "Source contains no content."
      );
    }

    const cleaned = this.cleanText(
      original
    ).slice(
      0,
      this.maxContentLength
    );

    if (!cleaned) {
      throw new Error(
        "Source produced no usable content."
      );
    }

    return {
      id: crypto.randomUUID(),
      sourceId: source.id,
      subject: source.subject,
      topic: source.topic,
      title: source.title,
      sourceUrl: source.url,
      sourceChecksum: source.checksum,
      content: cleaned,
      contentChecksum:
        this.createChecksum(cleaned),
      originalLength: original.length,
      refinedLength: cleaned.length,
      refinement: {
        method: "deterministic-cleaning",
        truncated:
          cleaned.length < original.length
      },
      status: "refined",
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = {
  KnowledgeRefiner
};
