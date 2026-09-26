const { ResearchPlanner } = require("./planner");
const { SourceCollector } = require("./source-collector");
const { FreeWebSearch } = require("./search/free-search");
const { fetchSources } = require("./search/web-fetcher");
const { SourceInspector } = require("./inspector");
const { KnowledgeRefiner } = require("./refinement/refiner");
const { KnowledgeApproval } = require("./approval/knowledge-approval");
const { KnowledgeStore } = require("./knowledge/knowledge-store");
const { StorageManager } = require("./storage-manager");

class ResearchPipeline {
  constructor(options = {}) {
    this.planner =
      options.planner ||
      new ResearchPlanner({
        targetsPerSubject: options.targetsPerSubject
      });

    this.collector =
      options.collector ||
      new SourceCollector({
        maxSourcesPerTarget:
          options.maxSourcesPerTarget || 10
      });

    this.search =
      options.search ||
      new FreeWebSearch({
        maxResults: options.maxResults || 10,
        timeout: options.timeout || 15000
      });

    this.fetchSources =
      options.fetchSources || fetchSources;

    this.inspector =
      options.inspector ||
      new SourceInspector({
        minTextLength:
          options.minTextLength || 200,
        maxTextLength:
          options.maxTextLength || 30000
      });

    this.refiner =
      options.refiner ||
      new KnowledgeRefiner({
        maxContentLength:
          options.maxContentLength || 20000
      });

    this.approval =
      options.approval ||
      new KnowledgeApproval({
        minContentLength:
          options.minContentLength || 120
      });

    this.knowledge =
      options.knowledge ||
      new KnowledgeStore();

    this.storage =
      options.storage ||
      new StorageManager({
        root: options.storageRoot
      });
  }

  ensurePlan(subject) {
    return this.planner.createTargets(subject);
  }

  async researchTarget(subject, targetId) {
    const target = this.planner.getTarget(
      subject,
      targetId
    );

    this.planner.markSearching(
      subject,
      targetId
    );

    const searchResult =
      await this.search.search(
        target.query
      );

    if (!searchResult.ok) {
      return {
        ok: false,
        subject,
        target,
        search: searchResult,
        sources: [],
        fetched: []
      };
    }

    const sources =
      this.collector.collect(
        subject,
        targetId,
        searchResult.results
      );

    this.planner.recordSources(
      subject,
      targetId,
      sources.length
    );

    const fetched =
      await this.fetchSources(
        sources,
        {
          timeout: this.search.timeout
        }
      );

    const storedSources = [];

    for (const source of fetched) {
      if (
        !source.fetched ||
        !source.page?.ok
      ) {
        continue;
      }

      try {
        const stored =
          this.storage.saveSource({
            subject,
            topic: target.type,
            title: source.title,
            url: source.url,
            content: source.page.text,
            stage: "incoming",
            metadata: {
              domain:
                source.domain || "",
              sourceId:
                source.id || null,
              targetId,
              discoveredAt:
                source.discoveredAt ||
                null,
              fetchedAt:
                new Date().toISOString()
            }
          });

        storedSources.push(
          stored
        );
      } catch (error) {
        storedSources.push({
          ok: false,
          title: source.title,
          url: source.url,
          error: error.message
        });
      }
    }

    const inspected =
      this.inspector.inspectMany(
        fetched
      );

    const storedInspection = [];

    for (
      let index = 0;
      index < fetched.length;
      index += 1
    ) {
      const source =
        fetched[index];

      const inspection =
        inspected[index];

      if (
        !source.fetched ||
        !source.page?.ok
      ) {
        continue;
      }

      const stored =
        storedSources.find(
          item =>
            item.id &&
            item.url ===
              source.url
        );

      if (!stored) {
        continue;
      }

      try {
        const result =
          this.storage.inspectStoredSource(
            "incoming",
            subject,
            stored.id,
            inspection
          );

        storedInspection.push(
          result
        );
      } catch (error) {
        storedInspection.push({
          ok: false,
          id: stored.id,
          url: source.url,
          error: error.message
        });
      }
    }

    const refinementResults = [];
    const approvalResults = [];
    const approvedKnowledge = [];

    /*
     * Only sources that successfully passed inspection
     * are allowed to enter refinement.
     *
     * The original source remains in the inspected stage.
     */
    for (const inspection of storedInspection) {
      if (
        !inspection ||
        inspection.destination !==
          "inspected"
      ) {
        continue;
      }

      const source =
        this.storage.readSource(
          "inspected",
          subject,
          inspection.id
        );

      if (!source) {
        refinementResults.push({
          ok: false,
          sourceId: inspection.id,
          error:
            "Inspected source could not be reloaded."
        });

        continue;
      }

      try {
        const refined =
          this.refiner.refine({
            ...source,
            stage: "inspected"
          });

        const storedRefined =
          this.storage.saveRefined(
            refined
          );

        refinementResults.push({
          ok: true,
          sourceId:
            refined.sourceId,
          refinedId:
            storedRefined.id,
          sourceChecksum:
            refined.sourceChecksum,
          contentChecksum:
            storedRefined.checksum,
          record:
            storedRefined
        });

        const approval =
          this.approval.approve(
            {
              ...refined,
              id:
                storedRefined.id,
              contentChecksum:
                storedRefined.checksum,
              stage: "refined"
            },
            source
          );

        approvalResults.push({
          ...approval,
          sourceId:
            refined.sourceId,
          refinedId:
            storedRefined.id
        });

        if (!approval.approved) {
          continue;
        }

        const approved =
          this.storage.approveRefined(
            subject,
            storedRefined.id,
            approval
          );

        approvedKnowledge.push(
          approved
        );
      } catch (error) {
        refinementResults.push({
          ok: false,
          sourceId:
            inspection.id,
          error: error.message
        });
      }
    }

    /*
     * KnowledgeStore is now populated ONLY from the
     * approved storage stage.
     *
     * No inspected or merely refined source can
     * bypass the quality gate.
     */
    const knowledgeRecords = [];

    for (const approved of approvedKnowledge) {
      try {
        const record =
          this.knowledge.createRecord(
            {
              id:
                approved.sourceId,
              title:
                approved.title,
              url:
                approved.sourceUrl,
              domain:
                approved.metadata?.domain ||
                "",
              text:
                approved.content,
              checksum:
                approved.checksum,
              status:
                "approved"
            },
            {
              subject,
              topic:
                approved.topic
            }
          );

        knowledgeRecords.push(
          record
        );
      } catch (error) {
        knowledgeRecords.push({
          ok: false,
          sourceId:
            approved.sourceId,
          error:
            error.message
        });
      }
    }

    const approvedCount =
      approvalResults.filter(
        result => result.approved
      ).length;

    const rejectedCount =
      approvalResults.filter(
        result => !result.approved
      ).length;

    return {
      ok: true,

      subject,

      target,

      search: {
        provider:
          searchResult.provider,
        query:
          searchResult.query,
        resultCount:
          searchResult.results.length
      },

      sources,

      fetched,

      storage: {
        stored:
          storedSources.filter(
            source => source.id
          ).length,

        failed:
          storedSources.filter(
            source => !source.id
          ).length,

        sources:
          storedSources,

        inspected:
          storedInspection,

        inspectedCount:
          storedInspection.filter(
            result =>
              result.destination ===
              "inspected"
          ).length,

        rejectedCount:
          storedInspection.filter(
            result =>
              result.destination ===
              "rejected"
          ).length
      },

      inspection: {
        total:
          inspected.length,

        approved:
          inspected.filter(
            result =>
              result.approved
          ).length,

        rejected:
          inspected.filter(
            result =>
              !result.approved
          ).length,

        results:
          inspected
      },

      refinement: {
        total:
          refinementResults.length,

        successful:
          refinementResults.filter(
            result => result.ok
          ).length,

        failed:
          refinementResults.filter(
            result => !result.ok
          ).length,

        results:
          refinementResults
      },

      approval: {
        total:
          approvalResults.length,

        approved:
          approvedCount,

        rejected:
          rejectedCount,

        results:
          approvalResults
      },

      knowledge: {
        created:
          knowledgeRecords.filter(
            record =>
              record &&
              record.id
          ).length,

        records:
          knowledgeRecords
      }
    };
  }

  async researchSubject(subject) {
    const targets =
      this.ensurePlan(subject);

    const results = [];

    for (const target of targets) {
      const result =
        await this.researchTarget(
          subject,
          target.id
        );

      results.push(result);

      if (!result.ok) {
        break;
      }
    }

    return {
      ok:
        results.every(
          result => result.ok
        ),

      subject:
        String(subject)
          .trim()
          .toLowerCase(),

      targetCount:
        targets.length,

      results
    };
  }
}

module.exports = {
  ResearchPipeline
};
