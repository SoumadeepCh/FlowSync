import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

/**
 * Webhook Response handler — formats data from previous step results
 * into a structured response payload. Useful as a final step before
 * returning data to a webhook caller.
 *
 * Config:
 *   statusCode: 200 (default)
 *   responseFields: { key: "$nodeId.field" } — pick fields for response
 *   includeMetadata: true — include execution timing info
 */
export class WebhookResponseHandler implements ActionHandler {
    readonly type = "webhook_response";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        const config = job.node.config || {};
        const previousResults = job.previousResults || {};

        try {
            const statusCode = (config.statusCode as number) || 200;
            const includeMetadata = config.includeMetadata !== false;

            let responseBody: Record<string, unknown> = {};

            // Build response from configured field mappings
            const responseFields = config.responseFields as Record<string, string> | undefined;
            if (responseFields) {
                for (const [key, ref] of Object.entries(responseFields)) {
                    responseBody[key] = this.resolveValue(String(ref), previousResults);
                }
            } else {
                // Default: collect all previous results
                responseBody = { ...previousResults };
            }

            if (includeMetadata) {
                responseBody._metadata = {
                    executionId: job.executionId,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - start,
                    statusCode,
                };
            }

            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "completed",
                result: {
                    message: `Webhook response prepared (${statusCode})`,
                    statusCode,
                    body: responseBody,
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
            };
        }
    }

    private resolveValue(
        token: string,
        previousResults: Record<string, unknown>
    ): unknown {
        if (!token.startsWith("$")) return token;
        const path = token.slice(1).split(".");
        const nodeId = path[0];
        let value: unknown = previousResults[nodeId];
        for (let i = 1; i < path.length && value != null; i++) {
            value = (value as Record<string, unknown>)[path[i]];
        }
        return value;
    }
}
