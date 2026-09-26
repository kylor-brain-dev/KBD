const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  TrainingEngine
} = require("../training/engine");

const {
  TrainingStateManager
} = require("../training/runtime/state-manager");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "kylor-training-research-"
    )
  );

  try {
    const stateManager =
      new TrainingStateManager({
        root
      });

    const calls = [];

    const researchPipeline = {
      async researchTarget(
        subject,
        targetId
      ) {
        calls.push({
          subject,
          targetId
        });

        return {
          ok: true,

          search: {
            results: 2
          },

          storage: {
            stored: 2
          },

          approval: {
            approved: 1
          }
        };
      }
    };

    const engine =
      new TrainingEngine({
        stateManager,
        researchPipeline,
        maxActiveSubjects: 1,
        saveIntervalMs: 60000,
        checkpointIntervalMs: 60000
      });

    engine.addSubject(
      "programming"
    );

    engine.start();

    await new Promise(
      resolve =>
        setTimeout(resolve, 50)
    );

    engine.stop();

    const subject =
      engine.subjects.get(
        "programming"
      );

    assert(
      subject,
      "Programming subject was not created."
    );

    assert(
      calls.length >= 1,
      "Research pipeline was never called."
    );

    assert(
      subject.targetsCompleted >= 1,
      "No research target was completed."
    );

    assert(
      subject.sourcesFound >= 2,
      "Sources found were not recorded."
    );

    assert(
      subject.sourcesApproved >= 1,
      "Approved sources were not recorded."
    );

    const firstTarget =
      subject.targets.find(
        target =>
          target.status ===
          "completed"
      );

    assert(
      firstTarget,
      "Completed target was not persisted in subject state."
    );

    const firstTargetId =
      firstTarget.id;

    const callsBeforeRestart =
      calls.length;

    const resumedEngine =
      new TrainingEngine({
        stateManager,
        researchPipeline,
        maxActiveSubjects: 1,
        saveIntervalMs: 60000,
        checkpointIntervalMs: 60000
      });

    const resumedSubject =
      resumedEngine.subjects.get(
        "programming"
      );

    assert(
      resumedSubject,
      "Subject was not restored after restart."
    );

    assert(
      resumedSubject.targetsCompleted >= 1,
      "Completed target progress was lost after restart."
    );

    const restoredCompleted =
      resumedSubject.targets.find(
        target =>
          target.id ===
          firstTargetId
      );

    assert(
      restoredCompleted &&
        restoredCompleted.status ===
          "completed",
      "Completed target did not remain completed after restart."
    );

    resumedEngine.running = true;

    resumedEngine.activateSubjects();

    const nextTarget =
      resumedEngine.getNextTarget(
        resumedSubject
      );

    assert(
      nextTarget,
      "No next target was found after restart."
    );

    assert(
      nextTarget.id !==
        firstTargetId,
      "Engine selected an already completed target."
    );

    resumedEngine.running = false;

    console.log(
      "Engine -> ResearchPipeline: PASS"
    );

    console.log(
      "Target execution: PASS"
    );

    console.log(
      "Target progress persisted: PASS"
    );

    console.log(
      "Sources and approvals recorded: PASS"
    );

    console.log(
      "Engine restart restoration: PASS"
    );

    console.log(
      "Completed target skipped after restart: PASS"
    );

    console.log(
      `Research calls before restart: ${callsBeforeRestart}`
    );

    console.log(
      `Completed targets: ${resumedSubject.targetsCompleted}/${resumedSubject.targetsTotal}`
    );

    console.log(
      `Next target: ${nextTarget.id}`
    );

    console.log(
      "TRAINING -> RESEARCH INTEGRATION TEST: PASS"
    );
  } finally {
    fs.rmSync(
      root,
      {
        recursive: true,
        force: true
      }
    );
  }
}

main().catch(error => {
  console.error(
    "TRAINING -> RESEARCH INTEGRATION TEST: FAIL"
  );

  console.error(
    error.stack || error.message
  );

  process.exit(1);
});
