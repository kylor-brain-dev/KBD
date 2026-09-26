const fs = require("fs");
const path = require("path");

const {
  TrainingStateManager
} = require("../training/runtime/state-manager");

const testRoot =
  path.resolve(
    "data/training/runtime-test"
  );

fs.rmSync(testRoot, {
  recursive: true,
  force: true
});

const manager =
  new TrainingStateManager({
    root: testRoot
  });

let state =
  manager.createDefaultState();

state.status = "running";
state.activeSubjects = [
  "mathematics",
  "science"
];
state.completedTargets = 7;
state.collectedSources = 21;
state.approvedSources = 12;

manager.save(state);

manager.checkpoint(state);

const loaded =
  manager.load();

if (
  loaded.completedTargets !== 7 ||
  loaded.approvedSources !== 12
) {
  throw new Error(
    "Saved state did not load correctly."
  );
}

const restored =
  manager.restore();

if (!restored.ok) {
  throw new Error(
    restored.error ||
      "Restore failed."
  );
}

if (
  restored.state.status !==
  "running"
) {
  throw new Error(
    "Restored state is incorrect."
  );
}

console.log(
  "State saved: PASS"
);

console.log(
  "Checkpoint created: PASS"
);

console.log(
  "State loaded: PASS"
);

console.log(
  "Checkpoint restored: PASS"
);

console.log(
  "TRAINING STATE TEST: PASS"
);

fs.rmSync(testRoot, {
  recursive: true,
  force: true
});
