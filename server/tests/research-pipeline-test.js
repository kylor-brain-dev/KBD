const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  ResearchPipeline
} = require("../training/research-pipeline");

const {
  StorageManager
} = require("../training/storage-manager");

const {
  KnowledgeStore
} = require("../training/knowledge/knowledge-store");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const root = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "kylor-research-pipeline-"
    )
  );

  try {
    const storage =
      new StorageManager({
        root
      });

    const knowledge =
      new KnowledgeStore();

    const search = {
      timeout: 1000,

      async search(query) {
        return {
          ok: true,
          provider: "test",
          query,
          results: [
            {
              id: "test-source-1",
              title:
                "JavaScript Test Source",
              url:
                "https://example.com/javascript",
              domain:
                "example.com"
            }
          ]
        };
      }
    };

    const fetchSources =
      async sources =>
        sources.map(source => ({
          ...source,
          fetched: true,
          page: {
            ok: true,
            text:
              "JavaScript is a programming language used to make web pages interactive. " +
              "It can run in browsers and on servers. Developers use JavaScript to build " +
              "applications, interactive interfaces, and other software. This controlled " +
              "research source contains enough information to pass the deterministic " +
              "inspection and quality gates."
          }
        }));

    const pipeline =
      new ResearchPipeline({
        planner: {
          createTargets(subject) {
            return [
              {
                id: "target-1",
                type: "fundamentals",
                query:
                  "JavaScript fundamentals"
              }
            ];
          },

          getTarget() {
            return {
              id: "target-1",
              type: "fundamentals",
              query:
                "JavaScript fundamentals"
            };
          },

          markSearching() {},

          recordSources() {}
        },

        collector: {
          collect(
            subject,
            targetId,
            results
          ) {
            return results;
          }
        },

        search,

        fetchSources,

        inspector: {
          inspectMany(sources) {
            return sources.map(
              source => ({
                approved: true,
                status: "approved",
                reasons: [],
                inspectedAt:
                  new Date().toISOString(),
                checksum:
                  source.page.text
              })
            );
          }
        },

        storage,

        knowledge
      });

    const result =
      await pipeline.researchTarget(
        "programming",
        "target-1"
      );

    assert(
      result.ok === true,
      "Research target failed."
    );

    assert(
      result.storage.stored === 1,
      "Expected one stored incoming source."
    );

    assert(
      result.storage.inspectedCount === 1,
      "Expected one inspected source."
    );

    assert(
      result.refinement.successful === 1,
      "Expected one successful refinement."
    );

    assert(
      result.approval.approved === 1,
      "Expected one approved record."
    );

    assert(
      result.knowledge.created === 1,
      "Expected one knowledge record."
    );

    assert(
      storage.list(
        "incoming",
        "programming"
      ).length === 0,
      "Incoming stage was not emptied."
    );

    assert(
      storage.list(
        "inspected",
        "programming"
      ).length === 1,
      "Original inspected source was not preserved."
    );

    assert(
      storage.list(
        "refined",
        "programming"
      ).length === 1,
      "Refined record was not stored."
    );

    assert(
      storage.list(
        "approved",
        "programming"
      ).length === 1,
      "Approved record was not stored."
    );

    const refined =
      storage.list(
        "refined",
        "programming"
      )[0];

    const inspected =
      storage.list(
        "inspected",
        "programming"
      )[0];

    const approved =
      storage.list(
        "approved",
        "programming"
      )[0];

    assert(
      refined.sourceId ===
        inspected.id,
      "Refined sourceId does not match original source."
    );

    assert(
      refined.sourceChecksum ===
        inspected.checksum,
      "Refined sourceChecksum does not match original."
    );

    assert(
      approved.stage ===
        "approved",
      "Approved record has wrong stage."
    );

    assert(
      knowledge.count() === 1,
      "KnowledgeStore contains the wrong number of records."
    );

    const knowledgeRecord =
      knowledge.list()[0];

    assert(
      knowledgeRecord.sourceId ===
        approved.sourceId,
      "KnowledgeStore provenance is incorrect."
    );

    console.log(
      "Research target execution: PASS"
    );

    console.log(
      "Incoming -> inspected: PASS"
    );

    console.log(
      "Inspection -> refinement: PASS"
    );

    console.log(
      "Refinement -> quality gate: PASS"
    );

    console.log(
      "Quality gate -> approved: PASS"
    );

    console.log(
      "Approved -> KnowledgeStore: PASS"
    );

    console.log(
      "Original source preserved: PASS"
    );

    console.log(
      "Provenance preserved: PASS"
    );

    console.log(
      "RESEARCH PIPELINE INTEGRATION TEST: PASS"
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
    "RESEARCH PIPELINE INTEGRATION TEST: FAIL"
  );

  console.error(
    error.stack || error.message
  );

  process.exit(1);
});
