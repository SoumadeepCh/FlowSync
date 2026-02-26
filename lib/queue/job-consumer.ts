// ─── Phase 5+6+9+9.5: Job Consumer ──────────────────────────────────────────
//
// Worker loop that dequeues jobs, dispatches to action handlers,
// and feeds results back through the result handler.
// Phase 6: Adds retry with exponential backoff and dead-letter queue.
// Phase 9: Instrumented with structured logging, metrics, and audit trail.

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

let isRunning = false;
let isShuttingDown = false;
let activeJobs = 0;
let totalRetries = 0;
const MAX_CONCURRENCY = 5; // Phase 9.5: Increased concurrency for production

/**
 * Start the consumer loop. Listens for new jobs and processes them.
 */
export function startConsumer(): void {
    if (isRunning) return;
    isRunning = true;

    // Process any jobs already in the queue
    drainQueue();

    // Listen for new jobs
    jobQueue.onJob(() => {
        drainQueue();
    });
}

/**
 * Process jobs from the queue up to the concurrency limit.
 */
function drainQueue(): void {
    if (isShuttingDown) return;
    while (activeJobs < MAX_CONCURRENCY && jobQueue.depth > 0) {
        const job = jobQueue.dequeue();
        if (!job) break;

        activeJobs++;
        processJob(job).finally(() => {
            activeJobs--;
            // Try to drain more after completing
            if (jobQueue.depth > 0) drainQueue();
        });
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
        jobQueue.markFailed();
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
            retryable: false, // No handler = not retryable
        };
        jobQueue.markFailed();
    } else {
        try {
            result = await handler.execute(job);
            // Phase 9.5: Heartbeat during execution
            workerHeartbeat.heartbeat(job.id);
            if (result.status === "completed") {
                jobQueue.markProcessed();
            } else {
                jobQueue.markFailed();
            }
        } catch (err) {
            result = {
                jobId: job.id,
                stepId: job.stepId,
                executionId: job.executionId,
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
                durationMs: 0,
                retryable: true, // Unhandled errors are retryable by default
            };
            jobQueue.markFailed();
        }
    }

    // ─── Retry Logic (Phase 6) ──────────────────────────────────────────
    if (
        result.status === "failed" &&
        result.retryable !== false &&
        job.attempt < job.maxRetries
    ) {
        // Schedule retry with exponential backoff
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
export function getConsumerStatus() {
    return {
        isRunning,
        activeJobs,
        maxConcurrency: MAX_CONCURRENCY,
        totalRetries,
        queueStats: jobQueue.getStats(),
        dlqStats: dlq.getStats(),
    };
}

/**
 * Graceful shutdown: stop accepting new jobs and wait for active ones.
 */
export async function stopConsumer(): Promise<void> {
    if (!isRunning) return;

    isShuttingDown = true;
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
