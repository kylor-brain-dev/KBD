const crypto = require("crypto");

class KnowledgeApproval {
  constructor(options = {}) {
    this.minContentLength =
      Number(options.minContentLength) || 120;
  }

  checksum(content) {
    return crypto
      .createHash("sha256")
      .update(String(content), "utf8")
      .digest("hex");
  }

  approve(refined, source = null) {
    if (!refined || typeof refined !== "object") {
      throw new Error("Refined knowledge is required.");
    }

    const reasons = [];

    if (refined.stage !== "refined") {
      reasons.push("Record is not in refined stage.");
    }

    if (!refined.sourceId) {
      reasons.push("Missing source reference.");
    }

    if (!refined.sourceUrl) {
      reasons.push("Missing source URL.");
    }

    if (!refined.sourceChecksum) {
      reasons.push("Missing source checksum.");
    }

    const content = String(
      refined.content || ""
    ).trim();

    if (!content) {
      reasons.push("Knowledge content is empty.");
    }

    if (content.length < this.minContentLength) {
      reasons.push(
        `Knowledge content is shorter than ${this.minContentLength} characters.`
      );
    }

    const actualChecksum = this.checksum(content);

    if (
      refined.contentChecksum &&
      refined.contentChecksum !== actualChecksum
    ) {
      reasons.push("Refined content checksum does not match.");
    }

    if (source) {
      if (source.id !== refined.sourceId) {
        reasons.push("Source ID does not match.");
      }

      if (
        source.checksum &&
        source.checksum !== refined.sourceChecksum
      ) {
        reasons.push(
          "Source checksum does not match the refined provenance."
        );
      }

      if (source.url && source.url !== refined.sourceUrl) {
        reasons.push("Source URL does not match.");
      }
    }

    return {
      approved: reasons.length === 0,
      status:
        reasons.length === 0
          ? "approved"
          : "rejected",
      reasons,
      sourceId: refined.sourceId,
      refinedId: refined.id,
      checksum: actualChecksum,
      checkedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  KnowledgeApproval
};
