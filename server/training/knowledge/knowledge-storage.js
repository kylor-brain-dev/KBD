const fs = require("fs");
const path = require("path");

class KnowledgeStorage {
  constructor(options = {}) {
    this.root =
      options.root ||
      path.resolve(process.cwd(), "data/knowledge");

    fs.mkdirSync(this.root, {
      recursive: true
    });
  }

  safeName(value) {
    return String(value || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "unknown";
  }

  subjectDirectory(subject) {
    const directory = path.join(
      this.root,
      this.safeName(subject)
    );

    fs.mkdirSync(directory, {
      recursive: true
    });

    return directory;
  }

  save(record) {
    if (!record || !record.id) {
      throw new Error("Knowledge record with an ID is required.");
    }

    const directory = this.subjectDirectory(
      record.subject || "unknown"
    );

    const filePath = path.join(
      directory,
      `${record.id}.json`
    );

    fs.writeFileSync(
      filePath,
      JSON.stringify(record, null, 2),
      "utf8"
    );

    return filePath;
  }

  saveMany(records = []) {
    if (!Array.isArray(records)) {
      throw new Error("Knowledge records must be an array.");
    }

    return records.map(record => this.save(record));
  }

  load(id, subject) {
    const filePath = path.join(
      this.subjectDirectory(subject),
      `${id}.json`
    );

    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );
  }

  list(subject) {
    const directory = this.subjectDirectory(subject);

    return fs
      .readdirSync(directory)
      .filter(file => file.endsWith(".json"))
      .map(file => {
        const filePath = path.join(directory, file);

        return JSON.parse(
          fs.readFileSync(filePath, "utf8")
        );
      });
  }

  count(subject) {
    return this.list(subject).length;
  }
}

module.exports = {
  KnowledgeStorage
};
