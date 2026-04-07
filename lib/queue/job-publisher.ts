// ─── Phase 5+6+9.5: Job Publisher ───────────────────────────────────────────
//
// Creates StepExecution records and enqueues jobs for the worker consumer.
// Phase 6: Adds idempotency check and retry config from node config.
// Phase 9.5: Adds backpressure check.

import { prisma } from "../prisma";
import { jobQueue } from "./job-queue";
import { idempotencyStore } from "./idempotency";
import type { WorkerJob } from "../workers/worker-types";
import { DEFAULT_RETRY_POLICY } from "../workers/worker-types";
import type { WorkflowNode } from "../types";
import { backpressure } from "./backpressure";
import { logger } from "../observability/logger";

/**
 * Extract retry policy from node config.
 */
function getMaxRetries(node: WorkflowNode): number {
    const retry = node.config?.retry as Record<string, unknown> | undefined;
    return (retry?.maxRetries as number) ?? DEFAULT_RETRY_POLICY.maxRetries;
}

/**
 * Publish a step job: create a StepExecution row and enqueue a WorkerJob.
 * Uses idempotency store to prevent duplicate step creation.
 */
export async function publishJob(params: {
    executionId: string;
    node: WorkflowNode;
    input?: Record<string, unknown>;
    previousResults: Record<string, unknown>;
    attempt?: number;
}): Promise<string> {
    const { executionId, node, input, previousResults, attempt = 1 } = params;

    // ─── Idempotency check (Phase 6) ────────────────────────────────────
    const ideKey = idempotencyStore.generateKey(executionId, node.id);

    // ── DB-level duplicate guard ──────────────────────────────────────────────
    // Check if this (executionId, nodeId) already has a non-skipped step.
    // This prevents the result-handler race condition where two concurrent step
    // completions both calculate the next ready nodes and both try to publish
    // the same downstream node (e.g. send_email), causing duplicate execution.
    const existingStep = await prisma.stepExecution.findFirst({
        where: {
            executionId,
            nodeId: node.id,
            status: { in: ["pending", "running", "completed"] },
        },
        select: { id: true },
    });
    if (existingStep) {
        return existingStep.id;
    }

    // Create StepExecution in DB
    const step = await prisma.stepExecution.create({
        data: {
            executionId,
            nodeId: node.id,
            nodeLabel: node.label,
            nodeType: node.type,
            status: "pending",
            attempts: attempt,
            startedAt: new Date(),
        },
    });

    // Register in idempotency store (in-memory layer on top of DB check)
    const ideCheck = idempotencyStore.checkAndSet(ideKey, step.id);
    if (ideCheck.duplicate && ideCheck.existingStepId) {
        // Duplicate in memory — clean up and return existing
        await prisma.stepExecution.delete({ where: { id: step.id } });
        return ideCheck.existingStepId;
    }

    // Build the job with retry config
    const maxRetries = getMaxRetries(node);
    const job: WorkerJob = {
        id: step.id,
        executionId,
        stepId: step.id,
        node,
        input,
        previousResults,
        attempt,
        maxRetries,
        createdAt: new Date(),
    };

    // Phase 9.5: Backpressure check
    if (!backpressure.canAccept()) {
        backpressure.recordRejection();
        logger.warn("Backpressure: rejecting job", {
            executionId,
            nodeId: node.id,
            queueDepth: backpressure.getStatus().currentDepth,
        });
        // Still allow the step to exist in DB as pending
        // but don't enqueue — it will be picked up on retry or manual intervention
        return step.id;
    }

    // Enqueue for the consumer
    await jobQueue.enqueue(job);

    return step.id;
}

/**
 * Publish multiple step jobs in batch (for parallel execution support).
 */
export async function publishJobs(
    jobs: Array<{
        executionId: string;
        node: WorkflowNode;
        input?: Record<string, unknown>;
        previousResults: Record<string, unknown>;
    }>
): Promise<string[]> {
    const ids: string[] = [];
    for (const job of jobs) {
        const id = await publishJob(job);
        ids.push(id);
    }
    return ids;
}
