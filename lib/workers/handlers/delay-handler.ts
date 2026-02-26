import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

const MAX_DELAY_MS = 300_000; // Cap at 5 minutes for safety

export class DelayHandler implements ActionHandler {
    readonly type = "delay";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        const config = job.node.config || {};

        let actualMs: number;

        // Phase 8: Support absolute scheduled time
        const scheduledTime = config.scheduledTime as string | undefined;
        if (scheduledTime) {
            const targetTime = new Date(scheduledTime).getTime();
            if (isNaN(targetTime)) {
                return {
                    jobId: job.id,
                    stepId: job.stepId,
                    executionId: job.executionId,
                    status: "failed",
                    error: `Invalid scheduledTime: "${scheduledTime}"`,
                    durationMs: 0,
                    retryable: false,
                };
            }

            const now = Date.now();
            const diff = targetTime - now;
            actualMs = diff > 0 ? Math.min(diff, MAX_DELAY_MS) : 0;
        } else {
            // Relative delay
            const requestedMs = (config.delayMs as number) || 1000;
            actualMs = Math.min(requestedMs, MAX_DELAY_MS);
        }

        if (actualMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, actualMs));
        }

        return {
            jobId: job.id,
            stepId: job.stepId,
            executionId: job.executionId,
            status: "completed",
            result: {
                message: scheduledTime
                    ? `Waited until ${scheduledTime} (${actualMs}ms)`
                    : `Delayed ${actualMs}ms`,
                actualMs,
                ...(scheduledTime ? { scheduledTime } : { requestedMs: (config.delayMs as number) || 1000 }),
            },
            durationMs: Date.now() - start,
        };
    }
}
