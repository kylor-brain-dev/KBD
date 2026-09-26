const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class TrainingStateManager {
  constructor(options = {}) {
    this.root = path.resolve(
      options.root ||
        process.env.KYLOR_TRAINING_STATE_ROOT ||
        "data/training/runtime"
    );

    this.statePath = path.join(
      this.root,
      "state.json"
    );

    this.checkpointPath = path.join(
      this.root,
      "checkpoint.json"
    );

    fs.mkdirSync(this.root, {
      recursive: true
    });
  }

  checksum(data) {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
  }

  createDefaultState() {
    const now = new Date().toISOString();

    return {
      version: 1,
      status: "stopped",
      startedAt: null,
      stoppedAt: null,
      updatedAt: now,

      subjects: {},
      activeSubjects: [],

      completedTargets: 0,
      collectedSources: 0,
      approvedSources: 0,

      errors: [],
      recoveries: [],

      lastCheckpoint: null,

      runtime: {
        totalSeconds: 0,
        sessionSeconds: 0
      }
    };
  }

  atomicWrite(filePath, data) {
    const tempPath =
      `${filePath}.${process.pid}.tmp`;

    fs.writeFileSync(
      tempPath,
      JSON.stringify(data, null, 2),
      "utf8"
    );

    fs.renameSync(
      tempPath,
      filePath
    );
  }

  save(state) {
    const nextState = {
      ...state,
      updatedAt: new Date().toISOString()
    };

    this.atomicWrite(
      this.statePath,
      nextState
    );

    return nextState;
  }

  load() {
    if (!fs.existsSync(this.statePath)) {
      return this.createDefaultState();
    }

    try {
      return JSON.parse(
        fs.readFileSync(
          this.statePath,
          "utf8"
        )
      );
    } catch {
      return this.createDefaultState();
    }
  }

  checkpoint(state = this.load()) {
    const checkpointData = {
      version: 1,
      createdAt: new Date().toISOString(),
      state,
      checksum: this.checksum(state)
    };

    this.atomicWrite(
      this.checkpointPath,
      checkpointData
    );

    const updatedState = {
      ...state,
      lastCheckpoint:
        checkpointData.createdAt,
      updatedAt:
        checkpointData.createdAt
    };

    this.atomicWrite(
      this.statePath,
      updatedState
    );

    return checkpointData;
  }

  restore() {
    if (!fs.existsSync(this.checkpointPath)) {
      return {
        ok: false,
        error: "No checkpoint exists."
      };
    }

    try {
      const checkpoint =
        JSON.parse(
          fs.readFileSync(
            this.checkpointPath,
            "utf8"
          )
        );

      if (!checkpoint.state) {
        return {
          ok: false,
          error: "Checkpoint has no state."
        };
      }

      const expected =
        this.checksum(
          checkpoint.state
        );

      if (
        checkpoint.checksum !== expected
      ) {
        return {
          ok: false,
          error:
            "Checkpoint checksum verification failed."
        };
      }

      this.atomicWrite(
        this.statePath,
        checkpoint.state
      );

      return {
        ok: true,
        state: checkpoint.state,
        checkpointCreatedAt:
          checkpoint.createdAt
      };
    } catch (error) {
      return {
        ok: false,
        error:
          "Checkpoint could not be restored.",
        details: error.message
      };
    }
  }

  exists() {
    return fs.existsSync(
      this.statePath
    );
  }

  getStatus() {
    return {
      state: this.load(),
      checkpointExists:
        fs.existsSync(
          this.checkpointPath
        )
    };
  }
}

module.exports = {
  TrainingStateManager
};
