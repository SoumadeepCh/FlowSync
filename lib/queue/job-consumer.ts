// ─── Phase 5+6+9+9.5+11: Job Consumer ───────────────────────────────────────
//
// Worker loop that dequeues jobs, dispatches to action handlers,
// and feeds results back through the result handler.
// Phase 6: Adds retry with exponential backoff and dead-letter queue.
// Phase 9: Instrumented with structured logging, metrics, and audit trail.
// Phase 11: Switched to polling-based PostgreSQL dequeue.

import { jobQueue } from "./job-queue";
import { handleResult } from "./result-handler";
import { registry } from "../workers/handler-registry";
import { prisma } from "../prisma";
import { dlq } from "./dead-letter-queue";
import { idempotencyStore } from "./idempotency";
import type { WorkerJob, WorkerResult } from "../workers/worker-types";
import { DEFAULT_RETRY_POLICY } from "../workers/worker-types";
import { logger } from "../observability/logger";
import { metrics } from "../observability/metrics";
import { recordAudit } from "../observability/audit-trail";
import { workerHeartbeat } from "../workers/worker-heartbeat";
import { v4 as uuid } from "uuid";

let isRunning = false;
let isShuttingDown = false;
let activeJobs = 0;
let totalRetries = 0;
const MAX_CONCURRENCY = 5;
const POLL_INTERVAL_MS = 500; // Phase 11: Poll every 500ms
let pollTimer: ReturnType<typeof setInterval> | null = null;

// Unique worker ID for this consumer instance
const WORKER_ID = `worker-${uuid().slice(0, 8)}`;

/**
 * Start the consumer loop.
 * Phase 11: Uses polling-based dequeue from PostgreSQL.
 */
export function startConsumer(): void {
    if (isRunning) return;
    isRunning = true;

    logger.info("Consumer started", { workerId: WORKER_ID, pollIntervalMs: POLL_INTERVAL_MS });

    // Also listen for event-driven notifications (immediate pickup for freshly enqueued jobs)
    jobQueue.onJob(() => {
        drainQueue();
    });

    // Phase 11: Poll the DB on an interval for any pending jobs
    pollTimer = setInterval(() => {
        if (!isShuttingDown) drainQueue();
    }, POLL_INTERVAL_MS);

    // Initial drain
    drainQueue();
}

/**
 * Process jobs from the queue up to the concurrency limit.
 * Phase 11: Uses async dequeue with workerId for row-level locking.
 */
function drainQueue(): void {
    if (isShuttingDown) return;

    while (activeJobs < MAX_CONCURRENCY) {
        activeJobs++;

        // Async dequeue — fire and forget, it will schedule more drains
        (async () => {
            try {
                const job = await jobQueue.dequeue(WORKER_ID);
                if (!job) {
                    activeJobs--;
                    return;
                }
                try {
                    await processJob(job);
                } finally {
                    activeJobs--;
                    // Try to drain more after completing
                    drainQueue();
                }
            } catch {
                activeJobs--;
            }
        })();

        // Only launch one async dequeue at a time per drain call
        // The processJob completion will trigger another drainQueue
        break;
    }
}

/**
 * Process a single job through its action handler.
 */
async function processJob(job: WorkerJob): Promise<void> {
    // Phase 9.5: Register with heartbeat monitor
    workerHeartbeat.registerJob(job.id, job.executionId, job.node.label);

    // Mark step as running
    try {
        await prisma.stepExecution.update({
            where: { id: job.stepId },
            data: {
                status: "running",
                startedAt: new Date(),
                attempts: job.attempt,
            },
        });
    } catch {
        // Step might have been cancelled/skipped already
        await jobQueue.markFailed(job.id, "Step no longer exists or was cancelled");
        workerHeartbeat.deregisterJob(job.id);
        return;
    }

    // Find the handler
    const handler = registry.get(job.node.type);

    let result: WorkerResult;

    if (!handler) {
        result = {
            jobId: job.id,
            stepId: job.stepId,
            executionId: job.executionId,
            status: "failed",
            error: `No handler registered for node type: "${job.node.type}"`,
            durationMs: 0,
            retryable: false,
        };
        await jobQueue.markFailed(job.id, result.error);
    } else {
        try {
            result = await handler.execute(job);
            // Phase 9.5: Heartbeat during execution
            workerHeartbeat.heartbeat(job.id);
            if (result.status === "completed") {
                await jobQueue.markDone(job.id, result.result);
            } else {
                await jobQueue.markFailed(job.id, result.error);
            }
        } catch (err) {
            result = {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
                durationMs: 0,
                retryable: true,
            };
            await jobQueue.markFailed(job.id, result.error);
        }
    }

    // ─── Retry Logic (Phase 6) ──────────────────────────────────────────
    if (
        result.status === "failed" &&
        result.retryable !== false &&
        job.attempt < job.maxRetries
    ) {
        const retryConfig = getRetryConfig(job.node.config);
        const delay =
            retryConfig.backoffMs *
            Math.pow(retryConfig.backoffMultiplier, job.attempt - 1);

        logger.warn(`Retrying job`, {
            jobId: job.id,
            nodeLabel: job.node.label,
            attempt: job.attempt,
            maxRetries: job.maxRetries,
            delayMs: delay,
            error: result.error,
        });

        totalRetries++;
        metrics.recordRetry();
        recordAudit({
            event: "step.retried",
            entityType: "step",
            entityId: job.stepId,
            metadata: {
                executionId: job.executionId,
                attempt: job.attempt,
                maxRetries: job.maxRetries,
                error: result.error,
            },
        });

        // Update step to show retry pending
        await prisma.stepExecution.update({
            where: { id: job.stepId },
            data: {
                status: "pending",
                error: `Retry ${job.attempt}/${job.maxRetries}: ${result.error}`,
                attempts: job.attempt,
            },
        });

        // Clear idempotency so the same node can be re-queued
        const ideKey = idempotencyStore.generateKey(job.executionId, job.node.id);
        idempotencyStore.remove(ideKey);

        // Re-enqueue after backoff delay
        setTimeout(() => {
            const retryJob: WorkerJob = {
                ...job,
                attempt: job.attempt + 1,
                createdAt: new Date(),
            };
            jobQueue.enqueue(retryJob);
        }, delay);

        return; // Don't pass to result handler yet
    }

    // If permanently failed and had retry config → send to DLQ
    if (result.status === "failed" && job.maxRetries > 0) {
        dlq.add(job, result.error || "Unknown error", job.attempt);
        metrics.recordDLQEntry();
        logger.error(`Job moved to DLQ`, {
            jobId: job.id,
            nodeLabel: job.node.label,
            attempts: job.attempt,
            error: result.error,
        });
        recordAudit({
            event: "dlq.entry",
            entityType: "step",
            entityId: job.stepId,
            metadata: {
                executionId: job.executionId,
                nodeType: job.node.type,
                attempts: job.attempt,
                error: result.error,
            },
        });
    }

    // Feed result to the result handler
    try {
        await handleResult(result);
    } catch (err) {
        logger.error("Result handler error", {
            jobId: job.id,
            error: err instanceof Error ? err.message : String(err),
        });
    } finally {
        // Phase 9.5: Deregister from heartbeat
        workerHeartbeat.deregisterJob(job.id);
    }
}

/**
 * Extract retry config from node config.
 */
function getRetryConfig(config: Record<string, unknown>) {
    const retry = config?.retry as Record<string, unknown> | undefined;
    return {
        backoffMs:
            (retry?.backoffMs as number) || DEFAULT_RETRY_POLICY.backoffMs,
        backoffMultiplier:
            (retry?.backoffMultiplier as number) ||
            DEFAULT_RETRY_POLICY.backoffMultiplier,
    };
}

/**
 * Get consumer status info.
 */
export async function getConsumerStatus() {
    return {
        isRunning,
        workerId: WORKER_ID,
        activeJobs,
        maxConcurrency: MAX_CONCURRENCY,
        totalRetries,
        queueStats: await jobQueue.getStats(),
        dlqStats: dlq.getStats(),
    };
}

/**
 * Graceful shutdown: stop accepting new jobs and wait for active ones.
 */
export async function stopConsumer(): Promise<void> {
    if (!isRunning) return;

    isShuttingDown = true;

    // Stop the polling timer
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    logger.info("Consumer shutting down, waiting for active jobs...", {
        activeJobs,
    });

    // Wait for active jobs to finish (max 30s)
    const maxWait = 30_000;
    const start = Date.now();
    while (activeJobs > 0 && Date.now() - start < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    isRunning = false;
    isShuttingDown = false;
    logger.info("Consumer stopped", { activeJobsRemaining: activeJobs });
}

// Auto-start the consumer when this module is imported
startConsumer();
