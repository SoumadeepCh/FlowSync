// ─── Phase 6: Dead-Letter Queue ─────────────────────────────────────────────
//
// Captures permanently failed jobs (retries exhausted).
// In-memory MVP — upgrade to persistent store later.

import type { WorkerJob } from "../workers/worker-types";

export interface DLQItem {
    job: WorkerJob;
    error: string;
    attempts: number;
    failedAt: Date;
}

export interface DLQStats {
    count: number;
    lastFailedAt: Date | null;
}

class DeadLetterQueue {
    private items: DLQItem[] = [];

    /**
     * Add a permanently failed job to the DLQ.
     */
    add(job: WorkerJob, error: string, attempts: number): void {
        this.items.push({
            job,
            error,
            attempts,
            failedAt: new Date(),
        });
        console.warn(
            `[DLQ] Job ${job.id} (node: ${job.node.label}) moved to dead-letter queue after ${attempts} attempts. Error: ${error}`
        );
    }

    /**
     * Get all dead-lettered items.
     */
    getItems(): DLQItem[] {
        return [...this.items];
    }

    /**
     * Get DLQ statistics.
     */
    getStats(): DLQStats {
        return {
            count: this.items.length,
            lastFailedAt:
                this.items.length > 0
                    ? this.items[this.items.length - 1].failedAt
                    : null,
        };
    }

    /**
     * Clear all items (for testing/admin).
     */
    clear(): void {
        this.items = [];
    }
}

// Singleton
const dlq = new DeadLetterQueue();
export { dlq };
export default dlq;
