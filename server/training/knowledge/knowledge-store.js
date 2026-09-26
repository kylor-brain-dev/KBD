const crypto = require("crypto");

class KnowledgeStore {
  constructor() {
    this.records = new Map();
  }

  createRecord(source, metadata = {}) {
    if (!source || typeof source !== "object") {
      throw new Error("Source is required.");
    }

    if (source.status !== "approved") {
      throw new Error("Only approved sources can become knowledge.");
    }

    const text = String(
      source.page?.text ||
      source.text ||
      ""
    ).trim();

    if (!text) {
      throw new Error("Approved source contains no usable text.");
    }

    const checksum = crypto
      .createHash("sha256")
      .update(text)
      .digest("hex");

    const id = crypto
      .createHash("sha256")
      .update(
        `${source.url}|${checksum}|${metadata.subject || ""}|${metadata.topic || ""}`
      )
      .digest("hex")
      .slice(0, 32);

    const record = {
      id,
      subject: String(metadata.subject || "").trim().toLowerCase(),
      topic: String(metadata.topic || "").trim(),
      title: String(source.title || "").trim(),
      url: String(source.url || "").trim(),
      domain: String(source.domain || "").trim(),
      content: text,
      checksum,
      sourceId: source.id || null,
      provenance: {
        sourceUrl: source.url || null,
        sourceTitle: source.title || null,
        sourceChecksum: source.checksum || null
      },
      createdAt: new Date().toISOString()
    };

    this.records.set(id, record);

    return record;
  }

  addApprovedSources(sources = [], metadata = {}) {
    if (!Array.isArray(sources)) {
      throw new Error("Sources must be an array.");
    }

    const records = [];

    for (const source of sources) {
      if (!source || source.status !== "approved") {
        continue;
      }

      records.push(
        this.createRecord(source, metadata)
      );
    }

    return records;
  }

  get(id) {
    return this.records.get(id) || null;
  }

  list() {
    return [...this.records.values()];
  }

  count() {
    return this.records.size;
  }

  clear() {
    this.records.clear();
  }
}

module.exports = {
  KnowledgeStore
};
