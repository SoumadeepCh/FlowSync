import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

export class StartHandler implements ActionHandler {
    readonly type = "start";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        return {
            jobId: job.id,
            stepId: job.stepId,
            executionId: job.executionId,
            status: "completed",
            result: {
                message: "Workflow started",
                input: job.input ?? {},
            },
            durationMs: Date.now() - start,
        };
    }
}
