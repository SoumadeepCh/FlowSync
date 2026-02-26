import type { ActionHandler, WorkerJob, WorkerResult } from "../worker-types";

/**
 * Condition handler (Phase 7 upgrade).
 *
 * Supports expressions:
 *   - "true" / "false" / "1" / "0"  → literal boolean
 *   - "$nodeId.field == value"       → compare previous step result field
 *   - "$nodeId.field != value"       → not equal
 *   - "$nodeId.field > value"        → greater than (numeric)
 *   - "$nodeId.field < value"        → less than (numeric)
 *   - "$nodeId.field >= value"       → greater or equal
 *   - "$nodeId.field <= value"       → less or equal
 *
 * The boolean result is used by the result handler to select
 * which conditionBranch edges to follow.
 */
export class ConditionHandler implements ActionHandler {
    readonly type = "condition";

    async execute(job: WorkerJob): Promise<WorkerResult> {
        const start = Date.now();
        const expression =
            (job.node.config?.expression as string) || "true";

        let result: boolean;
        try {
            result = this.evaluate(expression, job.previousResults);
        } catch (err) {
            return {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: `Condition evaluation error: ${err instanceof Error ? err.message : String(err)}`,
                durationMs: Date.now() - start,
                retryable: false,
            };
        }

        return {
            jobId: job.id,
            stepId: job.stepId,
            executionId: job.executionId,
            status: "completed",
            result: {
                message: `Condition "${job.node.label}" evaluated`,
                expression,
                result, // true or false — used by result handler for routing
            },
            durationMs: Date.now() - start,
        };
    }

    /**
     * Evaluate an expression against previous step results.
     */
    private evaluate(
        expression: string,
        previousResults: Record<string, unknown>
    ): boolean {
        const trimmed = expression.trim();

        // Literal booleans
        if (trimmed === "true" || trimmed === "1") return true;
        if (trimmed === "false" || trimmed === "0") return false;

        // Comparison operators (ordered by length to match >= before >)
        const operators = [">=", "<=", "!=", "==", ">", "<"] as const;
        for (const op of operators) {
            const idx = trimmed.indexOf(op);
            if (idx !== -1) {
                const left = trimmed.slice(0, idx).trim();
                const right = trimmed.slice(idx + op.length).trim();
                const leftVal = this.resolveValue(left, previousResults);
                const rightVal = this.resolveValue(right, previousResults);
                return this.compare(leftVal, op, rightVal);
            }
        }

        // Fallback: truthy check on resolved value
        const resolved = this.resolveValue(trimmed, previousResults);
        return Boolean(resolved);
    }

    /**
     * Resolve a value — if it starts with $ it's a reference to a previous step result.
     * Format: $nodeId.field.subfield
     */
    private resolveValue(
        token: string,
        previousResults: Record<string, unknown>
    ): unknown {
        if (!token.startsWith("$")) {
            // Try parsing as number
            const num = Number(token);
            if (!isNaN(num)) return num;
            // Strip quotes for string comparison
            if (
                (token.startsWith('"') && token.endsWith('"')) ||
                (token.startsWith("'") && token.endsWith("'"))
            ) {
                return token.slice(1, -1);
            }
            return token;
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

    /**
     * Compare two values with an operator.
     */
    private compare(
        left: unknown,
        op: ">=" | "<=" | "!=" | "==" | ">" | "<",
        right: unknown
    ): boolean {
        switch (op) {
            case "==":
                return String(left) === String(right);
            case "!=":
                return String(left) !== String(right);
            case ">":
                return Number(left) > Number(right);
            case "<":
                return Number(left) < Number(right);
            case ">=":
                return Number(left) >= Number(right);
            case "<=":
                return Number(left) <= Number(right);
        }
    }
}
