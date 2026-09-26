const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_ROOT = path.resolve(
  process.env.KYLOR_STORAGE_ROOT ||
  "data/training/storage"
);

const STAGES = [
  "incoming",
  "inspected",
  "refined",
  "approved",
  "rejected",
  "integration-queue"
];

class StorageManager {
  constructor(options = {}) {
    this.root = path.resolve(
      options.root || DEFAULT_ROOT
    );

    this.initialize();
  }

  initialize() {
    fs.mkdirSync(this.root, {
      recursive: true
    });

    for (const stage of STAGES) {
      fs.mkdirSync(
        path.join(this.root, stage),
        { recursive: true }
      );
    }
  }

  safeName(value) {
    return String(value || "unknown")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "unknown";
  }

  createId(value = "") {
    return crypto
      .createHash("sha256")
      .update(
        `${value}|${Date.now()}|${crypto.randomBytes(8).toString("hex")}`
      )
      .digest("hex")
      .slice(0, 32);
  }

  checksum(content) {
    return crypto
      .createHash("sha256")
      .update(String(content), "utf8")
      .digest("hex");
  }

  validateStage(stage) {
    if (!STAGES.includes(stage)) {
      throw new Error(
        `Invalid storage stage: ${stage}`
      );
    }
  }

  subjectDirectory(stage, subject) {
    this.validateStage(stage);

    const directory = path.join(
      this.root,
      stage,
      this.safeName(subject)
    );

    fs.mkdirSync(directory, {
      recursive: true
    });

    return directory;
  }

  saveSource({
    subject,
    topic = "",
    title,
    url,
    content,
    stage = "incoming",
    metadata = {}
  }) {
    if (!subject) {
      throw new Error("Subject is required.");
    }

    if (!title) {
      throw new Error("Source title is required.");
    }

    if (!url) {
      throw new Error("Source URL is required.");
    }

    if (content == null || String(content).trim() === "") {
      throw new Error("Source content is required.");
    }

    this.validateStage(stage);

    const text = String(content);
    const id = this.createId(url);
    const checksum = this.checksum(text);

    const directory = this.subjectDirectory(
      stage,
      subject
    );

    const sourceDirectory = path.join(
      directory,
      id
    );

    fs.mkdirSync(sourceDirectory, {
      recursive: true
    });

    const record = {
      id,
      subject: this.safeName(subject),
      topic: String(topic || "").trim(),
      title: String(title).trim(),
      url: String(url).trim(),
      checksum,
      contentLength: Buffer.byteLength(
        text,
        "utf8"
      ),
      stage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata
    };

    fs.writeFileSync(
      path.join(sourceDirectory, "content.txt"),
      text,
      "utf8"
    );

    fs.writeFileSync(
      path.join(sourceDirectory, "source.json"),
      JSON.stringify(record, null, 2),
      "utf8"
    );

    fs.writeFileSync(
      path.join(sourceDirectory, "checksum.sha256"),
      `${checksum}\n`,
      "utf8"
    );

    return {
      ...record,
      path: sourceDirectory
    };
  }

  readSource(stage, subject, id) {
    this.validateStage(stage);

    const directory = path.join(
      this.root,
      stage,
      this.safeName(subject),
      id
    );

    const sourceMetadataPath = path.join(
      directory,
      "source.json"
    );

    const knowledgeMetadataPath = path.join(
      directory,
      "knowledge.json"
    );

    let metadataPath = null;

    if (fs.existsSync(sourceMetadataPath)) {
      metadataPath = sourceMetadataPath;
    } else if (fs.existsSync(knowledgeMetadataPath)) {
      metadataPath = knowledgeMetadataPath;
    }

    if (!metadataPath) {
      return null;
    }

    const metadata = JSON.parse(
      fs.readFileSync(
        metadataPath,
        "utf8"
      )
    );

    const contentPath = path.join(
      directory,
      "content.txt"
    );

    const content = fs.existsSync(contentPath)
      ? fs.readFileSync(
          contentPath,
          "utf8"
        )
      : "";

    return {
      ...metadata,
      content,
      path: directory
    };
  }


  list(stage, subject = null) {
    this.validateStage(stage);

    const base = path.join(
      this.root,
      stage
    );

    if (!fs.existsSync(base)) {
      return [];
    }

    const subjects = subject
      ? [this.safeName(subject)]
      : fs.readdirSync(base, {
          withFileTypes: true
        })
          .filter(item => item.isDirectory())
          .map(item => item.name);

    const results = [];

    for (const subjectName of subjects) {
      const subjectPath = path.join(
        base,
        subjectName
      );

      if (!fs.existsSync(subjectPath)) {
        continue;
      }

      const sources = fs.readdirSync(
        subjectPath,
        { withFileTypes: true }
      );

      for (const source of sources) {
        if (!source.isDirectory()) {
          continue;
        }

        const sourceDirectory = path.join(
          subjectPath,
          source.name
        );

        const sourceMetadataPath = path.join(
          sourceDirectory,
          "source.json"
        );

        const knowledgeMetadataPath = path.join(
          sourceDirectory,
          "knowledge.json"
        );

        let metadataPath = null;

        if (fs.existsSync(sourceMetadataPath)) {
          metadataPath = sourceMetadataPath;
        } else if (fs.existsSync(knowledgeMetadataPath)) {
          metadataPath = knowledgeMetadataPath;
        }

        if (!metadataPath) {
          continue;
        }

        const metadata = JSON.parse(
          fs.readFileSync(
            metadataPath,
            "utf8"
          )
        );

        results.push({
          ...metadata,
          path: sourceDirectory
        });
      }
    }

    return results;
  }


  move(stage, subject, id, destinationStage) {
    this.validateStage(stage);
    this.validateStage(destinationStage);

    if (stage === destinationStage) {
      throw new Error(
        "Source is already in that storage stage."
      );
    }

    const sourceDirectory = path.join(
      this.root,
      stage,
      this.safeName(subject),
      id
    );

    if (!fs.existsSync(sourceDirectory)) {
      throw new Error(
        `Source not found: ${stage}/${subject}/${id}`
      );
    }

    const destinationSubjectDirectory =
      this.subjectDirectory(
        destinationStage,
        subject
      );

    const destinationDirectory = path.join(
      destinationSubjectDirectory,
      id
    );

    if (fs.existsSync(destinationDirectory)) {
      throw new Error(
        "Destination already contains this source."
      );
    }

    fs.renameSync(
      sourceDirectory,
      destinationDirectory
    );

    const metadataPath = path.join(
      destinationDirectory,
      "source.json"
    );

    const metadata = JSON.parse(
      fs.readFileSync(
        metadataPath,
        "utf8"
      )
    );

    metadata.stage = destinationStage;
    metadata.updatedAt =
      new Date().toISOString();

    fs.writeFileSync(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      "utf8"
    );

    return metadata;
  }

  inspectStoredSource(stage, subject, id, inspection) {
    const source = this.readSource(
      stage,
      subject,
      id
    );

    if (!source) {
      throw new Error(
        `Source not found: ${stage}/${subject}/${id}`
      );
    }

    if (!inspection || typeof inspection !== "object") {
      throw new Error("Inspection result is required.");
    }

    const inspectionRecord = {
      approved: Boolean(inspection.approved),
      status: inspection.approved
        ? "approved"
        : "rejected",
      reasons: Array.isArray(inspection.reasons)
        ? inspection.reasons
        : [],
      inspectedAt:
        inspection.inspectedAt ||
        new Date().toISOString(),
      checksumVerified:
        this.verify(stage, subject, id).ok
    };

    const inspectionPath = path.join(
      source.path,
      "inspection.json"
    );

    fs.writeFileSync(
      inspectionPath,
      JSON.stringify(
        inspectionRecord,
        null,
        2
      ),
      "utf8"
    );

    const destination =
      inspectionRecord.approved
        ? "inspected"
        : "rejected";

    const moved = this.move(
      stage,
      subject,
      id,
      destination
    );

    return {
      ...moved,
      inspection: inspectionRecord,
      destination
    };
  }

  saveRefined(refined) {
    if (!refined || typeof refined !== "object") {
      throw new Error("Refined knowledge is required.");
    }

    if (!refined.sourceId) {
      throw new Error("Refined knowledge must reference its source.");
    }

    if (!refined.subject) {
      throw new Error("Refined knowledge subject is required.");
    }

    if (!refined.content || !String(refined.content).trim()) {
      throw new Error("Refined knowledge content is required.");
    }

    const subject = this.safeName(refined.subject);
    const id = String(refined.id || this.createId(refined.sourceId));
    const directory = this.subjectDirectory("refined", subject);
    const refinedDirectory = path.join(directory, id);

    if (fs.existsSync(refinedDirectory)) {
      throw new Error("Refined knowledge already exists.");
    }

    fs.mkdirSync(refinedDirectory, { recursive: true });

    const content = String(refined.content).trim();
    const checksum = this.checksum(content);

    const record = {
      ...refined,
      id,
      subject,
      checksum,
      stage: "refined",
      refinedAt: refined.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(refinedDirectory, "content.txt"),
      content,
      "utf8"
    );

    fs.writeFileSync(
      path.join(refinedDirectory, "knowledge.json"),
      JSON.stringify(record, null, 2),
      "utf8"
    );

    fs.writeFileSync(
      path.join(refinedDirectory, "checksum.sha256"),
      `${checksum}\n`,
      "utf8"
    );

    return {
      ...record,
      path: refinedDirectory
    };
  }

  approveRefined(subject, id, approval) {
    if (!approval || typeof approval !== "object") {
      throw new Error("Approval result is required.");
    }

    if (!approval.approved) {
      throw new Error("Cannot store rejected knowledge as approved.");
    }

    const source = this.readSource(
      "refined",
      subject,
      id
    );

    if (!source) {
      throw new Error(
        `Refined knowledge not found: ${subject}/${id}`
      );
    }

    const destinationSubject = this.subjectDirectory(
      "approved",
      subject
    );

    const destination = path.join(
      destinationSubject,
      id
    );

    if (fs.existsSync(destination)) {
      throw new Error(
        "Approved knowledge already exists."
      );
    }

    fs.cpSync(
      source.path,
      destination,
      { recursive: true }
    );

    const approvalRecord = {
      ...approval,
      approvedAt:
        approval.checkedAt ||
        new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(
        destination,
        "approval.json"
      ),
      JSON.stringify(
        approvalRecord,
        null,
        2
      ),
      "utf8"
    );

    const metadataPath = path.join(
      destination,
      "knowledge.json"
    );

    const metadata = JSON.parse(
      fs.readFileSync(
        metadataPath,
        "utf8"
      )
    );

    metadata.stage = "approved";
    metadata.updatedAt =
      new Date().toISOString();

    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        metadata,
        null,
        2
      ),
      "utf8"
    );

    return {
      ...metadata,
      path: destination,
      approval: approvalRecord
    };
  }

  deleteSource(stage, subject, id) {
    this.validateStage(stage);

    const directory = path.join(
      this.root,
      stage,
      this.safeName(subject),
      id
    );

    if (!fs.existsSync(directory)) {
      return false;
    }

    fs.rmSync(directory, {
      recursive: true,
      force: false
    });

    return true;
  }

  verify(stage, subject, id) {
    const source = this.readSource(
      stage,
      subject,
      id
    );

    if (!source) {
      return {
        ok: false,
        error: "Source not found."
      };
    }

    const actualChecksum =
      this.checksum(source.content);

    return {
      ok: actualChecksum === source.checksum,
      id: source.id,
      expectedChecksum: source.checksum,
      actualChecksum
    };
  }

  stats() {
    const result = {};

    for (const stage of STAGES) {
      const sources = this.list(stage);

      result[stage] = {
        sources: sources.length,
        bytes: sources.reduce(
          (total, source) =>
            total + Number(
              source.contentLength || 0
            ),
          0
        )
      };
    }

    return result;
  }
}

module.exports = {
  StorageManager,
  STAGES
};
