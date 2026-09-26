const DEFAULT_TARGETS = [
  {
    type: "fundamentals",
    template: "fundamentals of {subject}"
  },
  {
    type: "concepts",
    template: "key concepts in {subject}"
  },
  {
    type: "history",
    template: "history and development of {subject}"
  },
  {
    type: "applications",
    template: "real world applications of {subject}"
  },
  {
    type: "advanced",
    template: "advanced topics in {subject}"
  },
  {
    type: "misconceptions",
    template: "common misconceptions about {subject}"
  },
  {
    type: "terminology",
    template: "important terminology in {subject}"
  },
  {
    type: "authoritative",
    template: "authoritative sources about {subject}"
  }
];

class ResearchPlanner {
  constructor(options = {}) {
    this.targetsPerSubject =
      options.targetsPerSubject || DEFAULT_TARGETS.length;

    this.targets = new Map();
  }

  createTargets(subject) {
    const name = String(subject || "").trim().toLowerCase();

    if (!name) {
      throw new Error("Subject is required.");
    }

    if (this.targets.has(name)) {
      return this.targets.get(name);
    }

    const targets = DEFAULT_TARGETS
      .slice(0, this.targetsPerSubject)
      .map((target, index) => ({
        id: `${name}-${target.type}-${index + 1}`,
        subject: name,
        type: target.type,
        query: target.template.replace("{subject}", name),
        status: "pending",
        sourcesFound: 0,
        createdAt: new Date().toISOString()
      }));

    this.targets.set(name, targets);

    return targets;
  }

  createTargetsForSubjects(subjects = []) {
    if (!Array.isArray(subjects)) {
      throw new Error("Subjects must be an array.");
    }

    return subjects.flatMap(subject =>
      this.createTargets(subject)
    );
  }

  markSearching(subject, targetId) {
    const target = this.getTarget(subject, targetId);

    target.status = "searching";
    target.startedAt = target.startedAt || new Date().toISOString();

    return target;
  }

  recordSources(subject, targetId, count) {
    const target = this.getTarget(subject, targetId);

    target.sourcesFound = Math.max(0, Number(count) || 0);
    target.status = "sources_found";
    target.lastActivityAt = new Date().toISOString();

    return target;
  }

  completeTarget(subject, targetId) {
    const target = this.getTarget(subject, targetId);

    target.status = "completed";
    target.completedAt = new Date().toISOString();

    return target;
  }

  getTarget(subject, targetId) {
    const name = String(subject || "").trim().toLowerCase();
    const targets = this.targets.get(name);

    if (!targets) {
      throw new Error(`No research plan exists for ${name}.`);
    }

    const target = targets.find(item => item.id === targetId);

    if (!target) {
      throw new Error(`Unknown research target: ${targetId}`);
    }

    return target;
  }

  getSubjectPlan(subject) {
    const name = String(subject || "").trim().toLowerCase();

    return this.targets.get(name) || [];
  }

  getAllPlans() {
    return Object.fromEntries(this.targets);
  }
}

module.exports = {
  ResearchPlanner,
  DEFAULT_TARGETS
};
