import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

/**
 * Fork handler — routing marker for parallel branches.
 * Passes input through to all outgoing branches.
 */
export class ForkHandler implements ActionHandler {
    readonly type = "fork";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        return {
            jobId: job.id,
            stepId: job.stepId,
            executionId: job.executionId,
            status: "completed",
            result: {
                message: `Fork "${job.node.label}" — dispatching parallel branches`,
                input: job.input ?? {},
                branchedAt: new Date().toISOString(),
            },
            durationMs: Date.now() - start,
        };
    }
}
