const crypto = require("crypto");

const {
  TrainingStateManager
} = require("./runtime/state-manager");

const {
  ResearchPlanner
} = require("./planner");

const DEFAULT_SUBJECTS = [
  "mathematics",
  "science",
  "programming",
  "history",
  "biology",
  "physics",
  "chemistry",
  "english"
];

class TrainingEngine {
  constructor(options = {}) {
    this.maxActiveSubjects =
      options.maxActiveSubjects || 4;

    this.sourceTarget =
      options.sourceTarget || 10;

    this.subjects = new Map();

    this.running = false;
    this.startedAt = null;

    this.runtimeStartedAt = null;
    this.runtimeTimer = null;

    this.saveIntervalMs =
      options.saveIntervalMs || 30000;

    this.checkpointIntervalMs =
      options.checkpointIntervalMs || 300000;

    this.lastSaveAt = null;
    this.lastCheckpointAt = null;

    this.stateManager =
      options.stateManager ||
      new TrainingStateManager({
        root: options.stateRoot
      });

    this.planner =
      options.planner ||
      new ResearchPlanner(
        options.plannerOptions || {}
      );

    this.researchPipeline =
      options.researchPipeline || null;

    this.subjectWorkers =
      new Map();

    this.restoreState();
  }

  restoreState() {
    const state =
      this.stateManager.load();

    if (
      state &&
      state.updatedAt
    ) {
      this.applyState(state);

      return {
        restored: true,
        source: "state"
      };
    }

    const result =
      this.stateManager.restore();

    if (!result.ok) {
      this.applyState(
        this.stateManager.createDefaultState()
      );

      return {
        restored: false,
        reason: result.error
      };
    }

    this.applyState(result.state);

    return {
      restored: true,
      source: "checkpoint"
    };
  }

  applyState(state = {}) {
    this.running =
      state.status === "running";

    this.startedAt =
      state.startedAt || null;

    this.subjects.clear();

    const subjects =
      state.subjects || {};

    for (
      const [name, record]
      of Object.entries(subjects)
    ) {
      this.subjects.set(
        name,
        {
          ...record,
          targets:
            Array.isArray(record.targets)
              ? record.targets
              : [],
          currentTargetId:
            record.currentTargetId || null,
          targetsCompleted:
            Number(
              record.targetsCompleted || 0
            ),
          targetsTotal:
            Number(
              record.targetsTotal || 0
            )
        }
      );
    }

    if (
      this.running &&
      this.subjects.size > 0
    ) {
      this.activateSubjects();
    }
  }

  ensureSubjectPlan(subject) {
    const name =
      String(subject || "")
        .trim()
        .toLowerCase();

    if (!name) {
      throw new Error(
        "Subject is required."
      );
    }

    const record =
      this.subjects.get(name);

    if (!record) {
      throw new Error(
        `Unknown training subject: ${name}`
      );
    }

    const targets =
      this.planner.createTargets(name);

    if (
      !Array.isArray(record.targets) ||
      record.targets.length === 0
    ) {
      record.targets =
        targets.map(target => ({
          id: target.id,
          type: target.type,
          query: target.query,
          status: target.status,
          sourcesFound: 0,
          sourcesApproved: 0,
          startedAt: null,
          completedAt: null,
          lastActivityAt: null
        }));
    } else {
      const existing =
        new Map(
          record.targets.map(
            target => [
              target.id,
              target
            ]
          )
        );

      record.targets =
        targets.map(target => {
          const saved =
            existing.get(target.id);

          return saved || {
            id: target.id,
            type: target.type,
            query: target.query,
            status: target.status,
            sourcesFound: 0,
            sourcesApproved: 0,
            startedAt: null,
            completedAt: null,
            lastActivityAt: null
          };
        });
    }

    record.targetsTotal =
      record.targets.length;

    record.targetsCompleted =
      record.targets.filter(
        target =>
          target.status ===
          "completed"
      ).length;

    return record.targets;
  }

  serializeState() {
    const subjects = {};

    for (
      const [name, record]
      of this.subjects.entries()
    ) {
      subjects[name] = record;
    }

    const allSubjects =
      Object.values(subjects);

    return {
      version: 2,

      status:
        this.running
          ? "running"
          : "stopped",

      startedAt:
        this.startedAt,

      stoppedAt:
        this.running
          ? null
          : new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),

      subjects,

      activeSubjects:
        allSubjects
          .filter(
            subject =>
              subject.status ===
              "researching"
          )
          .map(
            subject =>
              subject.subject
          ),

      completedTargets:
        allSubjects.reduce(
          (total, subject) =>
            total +
            Number(
              subject.targetsCompleted || 0
            ),
          0
        ),

      totalTargets:
        allSubjects.reduce(
          (total, subject) =>
            total +
            Number(
              subject.targetsTotal || 0
            ),
          0
        ),

      collectedSources:
        allSubjects.reduce(
          (total, subject) =>
            total +
            Number(
              subject.sourcesFound || 0
            ),
          0
        ),

      approvedSources:
        allSubjects.reduce(
          (total, subject) =>
            total +
            Number(
              subject.sourcesApproved || 0
            ),
          0
        ),

      errors:
        allSubjects.reduce(
          (total, subject) =>
            total +
            Number(
              subject.errors || 0
            ),
          0
        ),

      recoveries: [],

      lastCheckpoint:
        this.lastCheckpointAt,

      runtime: {
        totalSeconds:
          this.getRuntimeSeconds(),

        sessionSeconds:
          this.runtimeStartedAt
            ? Math.floor(
                (
                  Date.now() -
                  this.runtimeStartedAt
                ) / 1000
              )
            : 0
      }
    };
  }

  persist(checkpoint = false) {
    const state =
      this.serializeState();

    if (checkpoint) {
      const result =
        this.stateManager.checkpoint(
          state
        );

      if (result && result.ok !== false) {
        this.lastCheckpointAt =
          new Date().toISOString();
      }

      return result;
    }

    const result =
      this.stateManager.save(
        state
      );

    this.lastSaveAt =
      new Date().toISOString();

    return result;
  }

  addSubject(subject) {
    const name =
      String(subject || "")
        .trim()
        .toLowerCase();

    if (!name) {
      throw new Error(
        "Subject name is required."
      );
    }

    if (this.subjects.has(name)) {
      return this.subjects.get(name);
    }

    const record = {
      id:
        crypto.randomUUID(),

      subject:
        name,

      status:
        "queued",

      sourcesFound:
        0,

      sourcesApproved:
        0,

      sourceTarget:
        this.sourceTarget,

      queue:
        [],

      targets:
        [],

      currentTargetId:
        null,

      targetsCompleted:
        0,

      targetsTotal:
        0,

      startedAt:
        null,

      completedAt:
        null,

      lastActivityAt:
        null,

      errors:
        0
    };

    this.subjects.set(
      name,
      record
    );

    this.ensureSubjectPlan(
      name
    );

    this.persist();

    return record;
  }

  addSubjects(subjects = []) {
    if (!Array.isArray(subjects)) {
      throw new Error(
        "Subjects must be an array."
      );
    }

    return subjects.map(
      subject =>
        this.addSubject(subject)
    );
  }

  initializeDefaults() {
    return this.addSubjects(
      DEFAULT_SUBJECTS
    );
  }

  setResearchPipeline(
    researchPipeline
  ) {
    this.researchPipeline =
      researchPipeline || null;

    return Boolean(
      this.researchPipeline
    );
  }

  start() {
    if (this.running) {
      return this.getStatus();
    }

    this.running = true;

    this.startedAt =
      this.startedAt ||
      new Date().toISOString();

    for (
      const subject
      of this.subjects.values()
    ) {
      this.ensureSubjectPlan(
        subject.subject
      );
    }

    this.activateSubjects();

    this.startRuntimeLoop();

    this.persist(true);

    this.runActiveSubjects();

    return this.getStatus();
  }

  stop() {
    this.running = false;

    this.stopRuntimeLoop();

    for (
      const record
      of this.subjects.values()
    ) {
      if (
        record.status ===
        "researching"
      ) {
        record.status =
          "paused";
      }
    }

    this.persist(true);

    return this.getStatus();
  }

  startRuntimeLoop() {
    if (this.runtimeTimer) {
      return;
    }

    this.runtimeStartedAt =
      Date.now();

    this.runtimeTimer =
      setInterval(() => {
        if (!this.running) {
          return;
        }

        this.persist();

        const now =
          new Date().toISOString();

        this.lastSaveAt =
          now;

        if (
          !this.lastCheckpointAt ||
          Date.now() -
            new Date(
              this.lastCheckpointAt
            ).getTime() >=
            this.checkpointIntervalMs
        ) {
          this.persist(true);

          this.lastCheckpointAt =
            new Date().toISOString();
        }
      }, this.saveIntervalMs);

    if (
      this.runtimeTimer.unref
    ) {
      this.runtimeTimer.unref();
    }
  }

  stopRuntimeLoop() {
    if (!this.runtimeTimer) {
      return;
    }

    clearInterval(
      this.runtimeTimer
    );

    this.runtimeTimer = null;
    this.runtimeStartedAt = null;
  }

  getRuntimeSeconds() {
    if (!this.startedAt) {
      return 0;
    }

    const started =
      new Date(
        this.startedAt
      ).getTime();

    const end =
      this.running
        ? Date.now()
        : (
            this.lastSaveAt
              ? new Date(
                  this.lastSaveAt
                ).getTime()
              : Date.now()
          );

    return Math.max(
      0,
      Math.floor(
        (end - started) / 1000
      )
    );
  }

  activateSubjects() {
    if (!this.running) {
      return;
    }

    const active =
      [
        ...this.subjects.values()
      ].filter(
        subject =>
          subject.status ===
          "researching"
      );

    const availableSlots =
      this.maxActiveSubjects -
      active.length;

    if (availableSlots <= 0) {
      return;
    }

    const queued =
      [
        ...this.subjects.values()
      ]
        .filter(
          subject =>
            subject.status ===
              "queued" ||
            subject.status ===
              "paused"
        )
        .slice(
          0,
          availableSlots
        );

    const now =
      new Date().toISOString();

    for (
      const subject
      of queued
    ) {
      this.ensureSubjectPlan(
        subject.subject
      );

      subject.status =
        "researching";

      subject.startedAt =
        subject.startedAt ||
        now;

      subject.lastActivityAt =
        now;
    }
  }

  getNextTarget(subject) {
    const targets =
      this.ensureSubjectPlan(
        subject.subject
      );

    return (
      targets.find(
        target =>
          target.status !==
            "completed"
      ) || null
    );
  }

  syncPlannerTarget(
    subject,
    target
  ) {
    const plannerTarget =
      this.planner.getTarget(
        subject.subject,
        target.id
      );

    target.status =
      plannerTarget.status;

    target.sourcesFound =
      plannerTarget.sourcesFound || 0;

    target.startedAt =
      plannerTarget.startedAt ||
      target.startedAt ||
      null;

    target.lastActivityAt =
      plannerTarget.lastActivityAt ||
      target.lastActivityAt ||
      null;

    return target;
  }

  async runSubject(
    subjectName
  ) {
    const name =
      String(subjectName || "")
        .trim()
        .toLowerCase();

    const subject =
      this.subjects.get(name);

    if (!subject) {
      throw new Error(
        `Unknown training subject: ${name}`
      );
    }

    if (!this.running) {
      return {
        ok: false,
        subject: name,
        stopped: true
      };
    }

    if (!this.researchPipeline) {
      throw new Error(
        "Research pipeline is not configured."
      );
    }

    if (
      this.subjectWorkers.has(name)
    ) {
      return (
        this.subjectWorkers.get(name)
      );
    }

    const worker =
      this.processSubject(
        subject
      ).finally(() => {
        this.subjectWorkers.delete(
          name
        );

        if (this.running) {
          this.activateSubjects();
          this.runActiveSubjects();
        }
      });

    this.subjectWorkers.set(
      name,
      worker
    );

    return worker;
  }

  async processSubject(
    subject
  ) {
    while (
      this.running &&
      subject.status ===
        "researching"
    ) {
      const target =
        this.getNextTarget(
          subject
        );

      if (!target) {
        this.completeSubject(
          subject.subject
        );

        return {
          ok: true,
          subject:
            subject.subject,
          completed: true
        };
      }

      subject.currentTargetId =
        target.id;

      target.status =
        "searching";

      target.startedAt =
        target.startedAt ||
        new Date().toISOString();

      target.lastActivityAt =
        new Date().toISOString();

      subject.lastActivityAt =
        target.lastActivityAt;

      this.syncPlannerTarget(
        subject,
        target
      );

      this.persist();

      let result;

      try {
        result =
          await this.researchPipeline.researchTarget(
            subject.subject,
            target.id
          );
      } catch (error) {
        subject.errors += 1;

        target.status =
          "error";

        target.lastActivityAt =
          new Date().toISOString();

        subject.lastActivityAt =
          target.lastActivityAt;

        this.persist(true);

        return {
          ok: false,
          subject:
            subject.subject,
          target:
            target.id,
          error:
            error.message
        };
      }

      if (
        !result ||
        result.ok !== true
      ) {
        subject.errors += 1;

        target.status =
          "error";

        target.lastActivityAt =
          new Date().toISOString();

        subject.lastActivityAt =
          target.lastActivityAt;

        this.persist(true);

        return {
          ok: false,
          subject:
            subject.subject,
          target:
            target.id,
          error:
            result?.error ||
            "Research target failed."
        };
      }

      target.sourcesFound =
        Number(
          result.search?.results ||
          result.storage?.stored ||
          0
        );

      target.sourcesApproved =
        Number(
          result.approval?.approved ||
          0
        );

      target.status =
        "completed";

      target.completedAt =
        new Date().toISOString();

      target.lastActivityAt =
        target.completedAt;

      subject.targetsCompleted +=
        1;

      subject.sourcesFound +=
        target.sourcesFound;

      subject.sourcesApproved +=
        target.sourcesApproved;

      subject.currentTargetId =
        null;

      subject.lastActivityAt =
        target.lastActivityAt;

      this.syncPlannerTarget(
        subject,
        target
      );

      this.planner.completeTarget(
        subject.subject,
        target.id
      );

      target.status =
        "completed";

      this.persist();

      if (
        subject.targetsCompleted >=
        subject.targetsTotal
      ) {
        this.completeSubject(
          subject.subject
        );

        return {
          ok: true,
          subject:
            subject.subject,
          completed: true
        };
      }
    }

    return {
      ok: true,
      subject:
        subject.subject,
      stopped: true
    };
  }

  runActiveSubjects() {
    if (!this.running) {
      return [];
    }

    this.activateSubjects();

    const active =
      [
        ...this.subjects.values()
      ].filter(
        subject =>
          subject.status ===
          "researching"
      );

    for (
      const subject
      of active
    ) {
      this.runSubject(
        subject.subject
      ).catch(() => {});
    }

    return active.map(
      subject =>
        subject.subject
    );
  }

  addSource(
    subjectName,
    source
  ) {
    const subject =
      this.subjects.get(
        String(subjectName || "")
          .trim()
          .toLowerCase()
      );

    if (!subject) {
      throw new Error(
        `Unknown training subject: ${subjectName}`
      );
    }

    if (
      !source ||
      typeof source !==
        "object"
    ) {
      throw new Error(
        "Source must be an object."
      );
    }

    const sourceRecord = {
      id:
        source.id ||
        crypto.randomUUID(),

      title:
        String(
          source.title ||
          "Untitled source"
        ),

      url:
        String(
          source.url || ""
        ),

      type:
        source.type ||
        "web",

      discoveredAt:
        new Date().toISOString(),

      status:
        "discovered"
    };

    subject.queue.push(
      sourceRecord
    );

    subject.sourcesFound =
      subject.queue.length;

    subject.lastActivityAt =
      new Date().toISOString();

    if (
      subject.sourcesFound >=
      subject.sourceTarget
    ) {
      subject.status =
        "source_target_reached";
    }

    this.persist();

    return sourceRecord;
  }

  approveSource(
    subjectName,
    sourceId
  ) {
    const subject =
      this.subjects.get(
        String(subjectName || "")
          .trim()
          .toLowerCase()
      );

    if (!subject) {
      throw new Error(
        `Unknown training subject: ${subjectName}`
      );
    }

    const source =
      subject.queue.find(
        item =>
          item.id === sourceId
      );

    if (!source) {
      throw new Error(
        `Unknown source: ${sourceId}`
      );
    }

    if (
      source.status !==
      "approved"
    ) {
      source.status =
        "approved";

      subject.sourcesApproved +=
        1;
    }

    subject.lastActivityAt =
      new Date().toISOString();

    this.persist();

    return source;
  }

  recordError(
    subjectName
  ) {
    const subject =
      this.subjects.get(
        String(subjectName || "")
          .trim()
          .toLowerCase()
      );

    if (!subject) {
      throw new Error(
        `Unknown training subject: ${subjectName}`
      );
    }

    subject.errors += 1;

    subject.lastActivityAt =
      new Date().toISOString();

    this.persist(true);

    return subject;
  }

  completeSubject(
    subjectName
  ) {
    const subject =
      this.subjects.get(
        String(subjectName || "")
          .trim()
          .toLowerCase()
      );

    if (!subject) {
      throw new Error(
        `Unknown training subject: ${subjectName}`
      );
    }

    subject.status =
      "completed";

    subject.completedAt =
      new Date().toISOString();

    subject.currentTargetId =
      null;

    subject.lastActivityAt =
      subject.completedAt;

    this.activateSubjects();

    this.persist(true);

    return subject;
  }

  getSubjects() {
    return [
      ...this.subjects.values()
    ];
  }

  getStatus() {
    const subjects =
      this.getSubjects();

    const totalTargets =
      subjects.reduce(
        (total, subject) =>
          total +
          Number(
            subject.targetsTotal || 0
          ),
        0
      );

    const completedTargets =
      subjects.reduce(
        (total, subject) =>
          total +
          Number(
            subject.targetsCompleted || 0
          ),
        0
      );

    return {
      running:
        this.running,

      startedAt:
        this.startedAt,

      maxActiveSubjects:
        this.maxActiveSubjects,

      sourceTarget:
        this.sourceTarget,

      totalSubjects:
        subjects.length,

      researching:
        subjects.filter(
          subject =>
            subject.status ===
            "researching"
        ).length,

      queued:
        subjects.filter(
          subject =>
            subject.status ===
            "queued"
        ).length,

      paused:
        subjects.filter(
          subject =>
            subject.status ===
            "paused"
        ).length,

      completed:
        subjects.filter(
          subject =>
            subject.status ===
            "completed"
        ).length,

      targets: {
        total:
          totalTargets,

        completed:
          completedTargets,

        remaining:
          Math.max(
            0,
            totalTargets -
              completedTargets
          )
      },

      runtime: {
        seconds:
          this.getRuntimeSeconds(),

        running:
          this.running,

        lastSaveAt:
          this.lastSaveAt,

        lastCheckpointAt:
          this.lastCheckpointAt
      },

      subjects
    };
  }
}

module.exports = {
  TrainingEngine,
  DEFAULT_SUBJECTS
};
