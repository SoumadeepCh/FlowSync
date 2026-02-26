// ─── Phase 8: Cron Expression Parser ────────────────────────────────────────
//
// Lightweight cron parser supporting standard 5-field cron expressions:
//   minute  hour  day-of-month  month  day-of-week
//
// Supports: *, specific values, ranges (1-5), steps (*/5), and lists (1,3,5)

export interface CronFields {
    minute: number[];
    hour: number[];
    dayOfMonth: number[];
    month: number[];
    dayOfWeek: number[];
}

/**
 * Parse a single cron field into an array of matching values.
 */
function parseField(field: string, min: number, max: number): number[] {
    const values = new Set<number>();

    for (const part of field.split(",")) {
        // Handle step values: */5 or 1-10/2
        if (part.includes("/")) {
            const [range, stepStr] = part.split("/");
            const step = parseInt(stepStr, 10);
            if (isNaN(step) || step <= 0) throw new Error(`Invalid step: ${stepStr}`);

            let start = min;
            let end = max;

            if (range !== "*") {
                if (range.includes("-")) {
                    [start, end] = range.split("-").map(Number);
                } else {
                    start = parseInt(range, 10);
                }
            }

            for (let i = start; i <= end; i += step) {
                values.add(i);
            }
            continue;
        }

        // Handle range: 1-5
        if (part.includes("-")) {
            const [startStr, endStr] = part.split("-");
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            for (let i = start; i <= end; i++) {
                values.add(i);
            }
            continue;
        }

        // Handle wildcard
        if (part === "*") {
            for (let i = min; i <= max; i++) {
                values.add(i);
            }
            continue;
        }

        // Specific value
        const val = parseInt(part, 10);
        if (!isNaN(val) && val >= min && val <= max) {
            values.add(val);
        } else {
            throw new Error(`Invalid cron value: ${part} (expected ${min}-${max})`);
        }
    }

    return Array.from(values).sort((a, b) => a - b);
}

/**
 * Parse a 5-field cron expression into structured fields.
 * Supports standard cron syntax: wildcards, ranges (1-5), steps, and lists (1,3,5).
 */
export function parseCron(expression: string): CronFields {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) {
        throw new Error(
            `Invalid cron expression: expected 5 fields, got ${parts.length}. Format: "minute hour day-of-month month day-of-week"`
        );
    }

    return {
        minute: parseField(parts[0], 0, 59),
        hour: parseField(parts[1], 0, 23),
        dayOfMonth: parseField(parts[2], 1, 31),
        month: parseField(parts[3], 1, 12),
        dayOfWeek: parseField(parts[4], 0, 6), // 0 = Sunday
    };
}

/**
 * Check if a given Date matches a cron expression.
 */
export function shouldRun(expression: string, now: Date = new Date()): boolean {
    try {
        const fields = parseCron(expression);

        return (
            fields.minute.includes(now.getMinutes()) &&
            fields.hour.includes(now.getHours()) &&
            fields.dayOfMonth.includes(now.getDate()) &&
            fields.month.includes(now.getMonth() + 1) &&
            fields.dayOfWeek.includes(now.getDay())
        );
    } catch {
        console.error(`[CronParser] Invalid expression: "${expression}"`);
        return false;
    }
}

/**
 * Calculate the next run time from now for a cron expression.
 * Searches up to 366 days ahead.
 */
export function getNextRunTime(expression: string, from: Date = new Date()): Date | null {
    try {
        const fields = parseCron(expression);

        // Start from the next minute
        const candidate = new Date(from);
        candidate.setSeconds(0, 0);
        candidate.setMinutes(candidate.getMinutes() + 1);

        // Search up to ~366 days
        const maxIterations = 366 * 24 * 60;
        for (let i = 0; i < maxIterations; i++) {
            if (
                fields.minute.includes(candidate.getMinutes()) &&
                fields.hour.includes(candidate.getHours()) &&
                fields.dayOfMonth.includes(candidate.getDate()) &&
                fields.month.includes(candidate.getMonth() + 1) &&
                fields.dayOfWeek.includes(candidate.getDay())
            ) {
                return candidate;
            }
            candidate.setMinutes(candidate.getMinutes() + 1);
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Validate a cron expression. Returns null if valid, or an error message.
 */
export function validateCronExpression(expression: string): string | null {
    try {
        parseCron(expression);
        return null;
    } catch (err) {
        return err instanceof Error ? err.message : "Invalid cron expression";
    }
}
