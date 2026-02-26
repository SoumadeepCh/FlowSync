// ─── Phase 9: Structured Logger ─────────────────────────────────────────────
//
// JSON-structured logging with log levels and contextual fields.
// Maintains a ring buffer of recent entries for API querying.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const MAX_BUFFER_SIZE = 500;

class StructuredLogger {
    private buffer: LogEntry[] = [];
    private minLevel: LogLevel = "info";

    /**
     * Set the minimum log level. Messages below this level are suppressed.
     */
    setLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    /**
     * Write a log entry if it meets the minimum level.
     */
    private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
            return;
        }

        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context,
        };

        // Add to ring buffer
        this.buffer.push(entry);
        if (this.buffer.length > MAX_BUFFER_SIZE) {
            this.buffer.shift();
        }

        // Also output to console
        const prefix = `[${level.toUpperCase()}]`;
        const contextStr = context ? ` ${JSON.stringify(context)}` : "";
        switch (level) {
            case "debug":
                console.debug(`${prefix} ${message}${contextStr}`);
                break;
            case "info":
                console.info(`${prefix} ${message}${contextStr}`);
                break;
            case "warn":
                console.warn(`${prefix} ${message}${contextStr}`);
                break;
            case "error":
                console.error(`${prefix} ${message}${contextStr}`);
                break;
        }
    }

    debug(message: string, context?: Record<string, unknown>): void {
        this.log("debug", message, context);
    }

    info(message: string, context?: Record<string, unknown>): void {
        this.log("info", message, context);
    }

    warn(message: string, context?: Record<string, unknown>): void {
        this.log("warn", message, context);
    }

    error(message: string, context?: Record<string, unknown>): void {
        this.log("error", message, context);
    }

    /**
     * Get recent log entries, optionally filtered by level.
     */
    getRecentLogs(options?: { level?: LogLevel; limit?: number }): LogEntry[] {
        let entries = [...this.buffer];

        if (options?.level) {
            const minPriority = LOG_LEVEL_PRIORITY[options.level];
            entries = entries.filter(
                (e) => LOG_LEVEL_PRIORITY[e.level] >= minPriority
            );
        }

        const limit = options?.limit ?? 100;
        return entries.slice(-limit);
    }

    /**
     * Get buffer stats.
     */
    getStats() {
        const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
        for (const entry of this.buffer) {
            counts[entry.level]++;
        }
        return {
            totalEntries: this.buffer.length,
            maxBufferSize: MAX_BUFFER_SIZE,
            counts,
        };
    }

    /**
     * Clear all buffered entries.
     */
    clear(): void {
        this.buffer = [];
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const logger = new StructuredLogger();
export { logger };
export default logger;
