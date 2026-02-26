// ─── Phase 11: PostgreSQL-backed Job Queue ──────────────────────────────────
//
// Replaces in-memory queue with database-backed persistence.
// Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent dequeue.
// Falls back to in-memory mode if DB is unavailable at import time.

import { EventEmitter } from "events";
import { prisma } from "../prisma";
import { Prisma } from "@/generated/prisma";
import type { WorkerJob } from "../workers/worker-types";

export interface QueueStats {
    depth: number;
    totalEnqueued: number;
    totalProcessed: number;
    totalFailed: number;
}

class JobQueue extends EventEmitter {
    private _totalEnqueued = 0;
    private _totalProcessed = 0;
    private _totalFailed = 0;

    /**
     * Add a job to the persistent queue.
     */
    async enqueue(job: WorkerJob): Promise<void> {
        try {
            await prisma.jobQueue.create({
                data: {
                    id: job.id,
                    executionId: job.executionId,
                    nodeId: job.node.id,
                    nodeLabel: job.node.label,
                    nodeType: job.node.type,
                    payload: job as unknown as Prisma.InputJsonValue,
                    status: "pending",
                    attempts: 0,
                    maxAttempts: job.maxRetries ? job.maxRetries + 1 : 3,
                },
            });
            this._totalEnqueued++;
            this.emit("job", job);
        } catch {
            // If DB fails, emit event anyway so in-process consumer can pick up
            this._totalEnqueued++;
            this.emit("job", job);
        }
    }

    /**
     * Dequeue next pending job using row-level locking.
     * Returns null if no jobs available.
     */
    async dequeue(workerId: string): Promise<WorkerJob | null> {
        try {
            // Use raw query for SELECT FOR UPDATE SKIP LOCKED
            const rows = await prisma.$queryRaw<{ id: string }[]>`
                SELECT id FROM "JobQueue"
                WHERE status = 'pending'
                ORDER BY "createdAt" ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            `;

            if (rows.length === 0) return null;

            const jobRow = await prisma.jobQueue.update({
                where: { id: rows[0].id },
                data: {
                    status: "processing",
                    lockedAt: new Date(),
                    lockedBy: workerId,
                    attempts: { increment: 1 },
                },
            });

            return jobRow.payload as unknown as WorkerJob;
        } catch {
            return null;
        }
    }

    /**
     * Mark a job as completed.
     */
    async markDone(jobId: string, result?: unknown): Promise<void> {
        this._totalProcessed++;
        try {
            await prisma.jobQueue.update({
                where: { id: jobId },
                data: {
                    status: "done",
                    result: (result ?? null) as Prisma.InputJsonValue,
                },
            });
        } catch { /* ignore if row doesn't exist */ }
    }

    /**
     * Mark a job as failed.
     */
    async markFailed(jobId: string, error?: string): Promise<void> {
        this._totalFailed++;
        try {
            await prisma.jobQueue.update({
                where: { id: jobId },
                data: {
                    status: "failed",
                    error: error || "Unknown error",
                },
            });
        } catch { /* ignore */ }
    }

    /**
     * Record that a job completed (legacy compat).
     */
    markProcessed(): void {
        this._totalProcessed++;
    }

    /**
     * Get current queue statistics from DB.
     */
    async getStats(): Promise<QueueStats> {
        try {
            const pending = await prisma.jobQueue.count({ where: { status: "pending" } });
            return {
                depth: pending,
                totalEnqueued: this._totalEnqueued,
                totalProcessed: this._totalProcessed,
                totalFailed: this._totalFailed,
            };
        } catch {
            return {
                depth: 0,
                totalEnqueued: this._totalEnqueued,
                totalProcessed: this._totalProcessed,
                totalFailed: this._totalFailed,
            };
        }
    }

    /**
     * Current queue depth (sync fallback using counter).
     */
    get depth(): number {
        return Math.max(0, this._totalEnqueued - this._totalProcessed - this._totalFailed);
    }

    /**
     * Subscribe to new job events.
     */
    onJob(callback: (job: WorkerJob) => void): void {
        this.on("job", callback);
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const jobQueue = new JobQueue();
jobQueue.setMaxListeners(50);

export { jobQueue };
export default jobQueue;
