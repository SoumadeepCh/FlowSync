import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

/**
 * Transform handler — applies field mappings to reshape data.
 *
 * Config:
 *   mappings: { outputField: "$nodeId.field" | "literal value" }
 *   pick:     ["field1", "field2"] — only include these fields from input
 *   rename:   { oldKey: "newKey" }
 *   template: { field: "Hello {{$nodeId.name}}" }
 */
export class TransformHandler implements ActionHandler {
    readonly type = "transform";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        const config = job.node.config || {};
        const previousResults = job.previousResults || {};

        try {
            let result: Record<string, unknown> = {};

            // 1. Mappings — resolve $references
            const mappings = config.mappings as Record<string, string> | undefined;
            if (mappings) {
                for (const [outKey, expr] of Object.entries(mappings)) {
                    result[outKey] = this.resolveValue(String(expr), previousResults, job.input);
                }
            }

            // 2. Pick — select fields from input
            const pick = config.pick as string[] | undefined;
            if (pick && job.input) {
                for (const field of pick) {
                    if (field in (job.input as Record<string, unknown>)) {
                        result[field] = (job.input as Record<string, unknown>)[field];
                    }
                }
            }

            // 3. Rename — rename keys in result so far
            const rename = config.rename as Record<string, string> | undefined;
            if (rename) {
                for (const [oldKey, newKey] of Object.entries(rename)) {
                    if (oldKey in result) {
                        result[newKey] = result[oldKey];
                        delete result[oldKey];
                    }
                }
            }

            // 4. Template — string interpolation
            const template = config.template as Record<string, string> | undefined;
            if (template) {
                for (const [key, tmpl] of Object.entries(template)) {
                    result[key] = tmpl.replace(/\{\{(\$[^}]+)\}\}/g, (_, ref) => {
                        const val = this.resolveValue(ref, previousResults, job.input);
                        return String(val ?? "");
                    });
                }
            }

            // If no config provided, pass through input
            if (!mappings && !pick && !rename && !template) {
                result = { ...(job.input as Record<string, unknown> || {}), passthrough: true };
            }

            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "completed",
                result: { message: `Transform "${job.node.label}" applied`, ...result },
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
        previousResults: Record<string, unknown>,
        input?: Record<string, unknown>
    ): unknown {
        if (!token.startsWith("$")) return token;

        // $input.field
        if (token.startsWith("$input.")) {
            const path = token.slice(7).split(".");
            let value: unknown = input;
            for (const key of path) {
                if (value == null) break;
                value = (value as Record<string, unknown>)[key];
            }
            return value;
        }

        // $nodeId.field.subfield
        const path = token.slice(1).split(".");
        const nodeId = path[0];
        let value: unknown = previousResults[nodeId];
        for (let i = 1; i < path.length && value != null; i++) {
            value = (value as Record<string, unknown>)[path[i]];
        }
        return value;
    }
}
