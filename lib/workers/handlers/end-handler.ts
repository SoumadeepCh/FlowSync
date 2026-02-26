import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

export class EndHandler implements ActionHandler {
    readonly type = "end";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        return {
            jobId: job.id,
            stepId: job.stepId,
            executionId: job.executionId,
            status: "completed",
            result: {
                message: "Workflow completed",
            },
            durationMs: Date.now() - start,
        };
    }
}
