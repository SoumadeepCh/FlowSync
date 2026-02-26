import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

/**
 * Join handler — barrier synchronization node.
 * Collects and merges results from all incoming branches.
 */
export class JoinHandler implements ActionHandler {
    readonly type = "join";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();

        // Merge all previous results into a single object
        const mergedResults: Record<string, unknown> = {};
        for (const [nodeId, result] of Object.entries(job.previousResults)) {
            mergedResults[nodeId] = result;
        }

        return {
            jobId: job.id,
            stepId: job.stepId,
            executionId: job.executionId,
            status: "completed",
            result: {
                message: `Join "${job.node.label}" — merged ${Object.keys(mergedResults).length} branch results`,
                mergedResults,
                joinedAt: new Date().toISOString(),
            },
            durationMs: Date.now() - start,
        };
    }
}
