// ─── Phase 5: In-Memory Job Queue ───────────────────────────────────────────
//
// Event-driven queue. Architecture is pluggable — swap this out for RabbitMQ
// by implementing the same enqueue/dequeue/onJob interface.

import { EventEmitter } from "events";
import type { WorkerJob } from "../workers/worker-types";

export interface QueueStats {
    depth: number;
    totalEnqueued: number;
    totalProcessed: number;
    totalFailed: number;
}

class JobQueue extends EventEmitter {
    private queue: WorkerJob[] = [];
    private _totalEnqueued = 0;
    private _totalProcessed = 0;
    private _totalFailed = 0;

    /**
     * Add a job to the queue. Emits "job" event.
     */
    enqueue(job: WorkerJob): void {
        this.queue.push(job);
        this._totalEnqueued++;
        this.emit("job", job);
    }

    /**
     * Remove and return the next job, or undefined if empty.
     */
    dequeue(): WorkerJob | undefined {
        return this.queue.shift();
    }

    /**
     * Subscribe to new job events.
     */
    onJob(callback: (job: WorkerJob) => void): void {
        this.on("job", callback);
    }

    /**
     * Record that a job completed successfully.
     */
    markProcessed(): void {
        this._totalProcessed++;
    }

    /**
     * Record that a job failed.
     */
    markFailed(): void {
        this._totalFailed++;
    }

    /**
     * Get current queue statistics.
     */
    getStats(): QueueStats {
        return {
            depth: this.queue.length,
            totalEnqueued: this._totalEnqueued,
            totalProcessed: this._totalProcessed,
            totalFailed: this._totalFailed,
        };
    }

    /**
     * Current queue depth.
     */
    get depth(): number {
        return this.queue.length;
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const jobQueue = new JobQueue();
// Increase listener limit for high-throughput scenarios
jobQueue.setMaxListeners(50);

export { jobQueue };
export default jobQueue;
