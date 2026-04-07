// ─── Fetch Data Handler ───────────────────────────────────────────────────────
//
// Handles "fetch_data" nodes.
// Delegates to the DataSourceRegistry based on config.source.
// Result flows to the next node via previousResults.

import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";
import { dataSourceRegistry } from "../../data-sources";

export class FetchDataHandler implements ActionHandler {
    readonly type = "fetch_data";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        const { node } = job;
        const sourceId = (node.config?.source as string) || "";

        if (!sourceId) {
            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: "fetch_data node requires config.source to be set",
                durationMs: Date.now() - start,
            };
        }

        const source = dataSourceRegistry.get(sourceId);
        if (!source) {
            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: `Unknown data source: "${sourceId}". Available: ${dataSourceRegistry.all().map((s) => s.id).join(", ")}`,
                durationMs: Date.now() - start,
            };
        }

        try {
            const result = await source.fetch(node.config || {});

            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "completed",
                result: {
                    source: result.source,
                    fetchedAt: result.fetchedAt,
                    itemCount: result.items.length,
                    items: result.items,
                    meta: result.meta || {},
                },
                durationMs: Date.now() - start,
            };
        } catch (err) {
            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - start,
                retryable: true,
            };
        }
    }
}
