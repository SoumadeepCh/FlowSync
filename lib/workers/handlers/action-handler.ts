import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

/**
 * Handles "action" nodes.
 *
 * Supports action types:
 *   - "http"    → Real HTTP request via fetch
 *   - default   → Simulated delay-based action
 */
export class ActionNodeHandler implements ActionHandler {
    readonly type = "action";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        const { node } = job;
        const actionType = (node.config?.actionType as string) || "default";

        try {
            let result: Record<string, unknown>;

            switch (actionType) {
                case "http":
                    result = await this.executeHttp(node.config);
                    break;
                case "email":
                    result = await this.executeEmail(node.config, node.label);
                    break;
                default:
                    result = await this.executeDefault(node);
                    break;
            }

            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "completed",
                result,
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

    // ─── HTTP action ────────────────────────────────────────────────────

    private async executeHttp(
        config: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
        const url = config.url as string;
        if (!url) throw new Error("HTTP action requires a 'url' in config");

        const method = ((config.method as string) || "GET").toUpperCase();
        const headers = (config.headers as Record<string, string>) || {};
        const body = config.body as string | undefined;

        const fetchOpts: RequestInit = {
            method,
            headers: { "Content-Type": "application/json", ...headers },
            ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
        };

        const response = await fetch(url, fetchOpts);
        const statusCode = response.status;

        let responseBody: unknown;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            responseBody = await response.json();
        } else {
            responseBody = await response.text();
        }

        return {
            message: `HTTP ${method} ${url}`,
            statusCode,
            responseBody,
            executedAt: new Date().toISOString(),
        };
    }

    // ─── Email action (simulated) ───────────────────────────────────────

    private async executeEmail(
        config: Record<string, unknown>,
        label: string
    ): Promise<Record<string, unknown>> {
        const to = (config.to as string) || "test@example.com";
        const subject = (config.subject as string) || "FlowSync Notification";
        // Simulate email send delay
        await new Promise((r) => setTimeout(r, 200));
        return {
            message: `Email "${subject}" sent to ${to}`,
            action: label,
            simulated: true,
            executedAt: new Date().toISOString(),
        };
    }

    // ─── Default simulation ─────────────────────────────────────────────

    private async executeDefault(
        node: { label: string; config: Record<string, unknown> }
    ): Promise<Record<string, unknown>> {
        const delayMs = (node.config?.simulateMs as number) || 100;
        await new Promise((r) => setTimeout(r, delayMs));
        return {
            message: `Action "${node.label}" executed`,
            actionType: "default",
            executedAt: new Date().toISOString(),
        };
    }
}
