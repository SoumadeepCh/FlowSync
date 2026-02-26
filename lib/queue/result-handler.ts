// ─── Phase 5+6+7+9: Result Handler ──────────────────────────────────────────
//
// Processes WorkerResults: updates DB state, checks if execution is done,
// and enqueues next steps if needed.
// Phase 6: Integrates with retry logic (doesn't fail execution on retryable errors).
// Phase 7: Conditional branch routing + join barrier logic.
// Phase 9: Instrumented with metrics, logging, and audit trail.

import { prisma } from "../prisma";
import { Prisma } from "@/app/generated/prisma/client";
import type { WorkerResult } from "../workers/worker-types";
import type { WorkflowDefinition, WorkflowEdge } from "../types";
import { publishJob } from "./job-publisher";
import { EventEmitter } from "events";
import { logger } from "../observability/logger";
import { metrics } from "../observability/metrics";
import { recordAudit } from "../observability/audit-trail";

// Event bus for signaling execution completion
export const executionEvents = new EventEmitter();
executionEvents.setMaxListeners(100);

/**
 * Handle a worker result: update DB, check completion, enqueue next steps.
 */
export async function handleResult(result: WorkerResult): Promise<void> {
    // Phase 9: Record step metrics
    if (result.status === "completed") {
        metrics.recordStepCompleted(result.stepId, result.durationMs);
        metrics.recordJobProcessed();
    } else {
        metrics.recordStepFailed(result.stepId, result.durationMs);
    }

    logger.info(`Step ${result.status}`, {
        stepId: result.stepId,
        executionId: result.executionId,
        status: result.status,
        durationMs: result.durationMs,
    });

    // 1. Update the StepExecution record
    await prisma.stepExecution.update({
        where: { id: result.stepId },
        data: {
            status: result.status,
            result:
                result.result !== undefined
                    ? (result.result as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
            error: result.error || null,
            completedAt: new Date(),
        },
    });

    // 2. If step failed → mark execution as failed
    //    (Note: consumer handles retries BEFORE calling handleResult,
    //     so if we get here with "failed", retries are exhausted)
    if (result.status === "failed") {
        await prisma.execution.update({
            where: { id: result.executionId },
            data: {
                status: "failed",
                output: { error: result.error } as object,
                completedAt: new Date(),
            },
        });

        // Skip any remaining pending steps
        await prisma.stepExecution.updateMany({
            where: {
                executionId: result.executionId,
                status: "pending",
            },
            data: {
                status: "skipped",
                completedAt: new Date(),
            },
        });

        // Phase 9: Audit & metrics for failed execution
        logger.error(`Execution failed`, {
            executionId: result.executionId,
            error: result.error,
        });
        metrics.recordExecutionFailed(result.durationMs);
        recordAudit({
            event: "execution.failed",
            entityType: "execution",
            entityId: result.executionId,
            metadata: { error: result.error, stepId: result.stepId },
        });

        executionEvents.emit(`done:${result.executionId}`, {
            status: "failed",
            error: result.error,
        });
        return;
    }

    // 3. Load execution context for next-step calculation
    const execution = await prisma.execution.findUnique({
        where: { id: result.executionId },
        include: {
            workflow: true,
            steps: true,
        },
    });

    if (!execution) return;

    const definition =
        execution.workflow.definitionJson as unknown as WorkflowDefinition;
    const completedNodeIds = new Set(
        execution.steps
            .filter((s) => s.status === "completed")
            .map((s) => s.nodeId)
    );
    const pendingOrRunningNodeIds = new Set(
        execution.steps
            .filter((s) => s.status === "pending" || s.status === "running")
            .map((s) => s.nodeId)
    );

    // Build previous results map
    const previousResults: Record<string, unknown> = {};
    for (const step of execution.steps) {
        if (step.status === "completed" && step.result) {
            previousResults[step.nodeId] = step.result;
        }
    }

    // ─── Phase 7: Determine which outgoing edges to follow ──────────────
    // Find the node that just completed
    const completedStep = execution.steps.find((s) => s.id === result.stepId);
    const completedNodeId = completedStep?.nodeId;

    // Get outgoing edges from the completed node
    const outgoingEdges = definition.edges.filter(
        (e) => e.source === completedNodeId
    );

    // Filter edges based on condition branching
    const activeEdges = filterActiveEdges(
        outgoingEdges,
        completedStep?.nodeType || "",
        result.result
    );

    // Determine which target nodes are now blocked (on inactive branches)
    const activeTargetIds = new Set(activeEdges.map((e) => e.target));
    const skippedBranchTargets = outgoingEdges
        .filter((e) => !activeTargetIds.has(e.target))
        .map((e) => e.target);

    // Skip nodes on inactive branches (recursively)
    if (skippedBranchTargets.length > 0) {
        await skipBranch(
            skippedBranchTargets,
            definition,
            execution.id,
            completedNodeIds,
            pendingOrRunningNodeIds
        );
    }

    // ─── Find ready nodes ───────────────────────────────────────────────
    // Re-query steps since we may have skipped some
    const updatedSteps = await prisma.stepExecution.findMany({
        where: { executionId: execution.id },
    });
    const updatedCompleted = new Set(
        updatedSteps.filter((s) => s.status === "completed").map((s) => s.nodeId)
    );
    const updatedSkipped = new Set(
        updatedSteps.filter((s) => s.status === "skipped").map((s) => s.nodeId)
    );
    const updatedPendingOrRunning = new Set(
        updatedSteps
            .filter((s) => s.status === "pending" || s.status === "running")
            .map((s) => s.nodeId)
    );

    // A node is "ready" when all its incoming edge sources are either completed or skipped,
    // and the node itself hasn't been scheduled yet
    const readyNodes = definition.nodes.filter((node) => {
        if (updatedCompleted.has(node.id)) return false;
        if (updatedSkipped.has(node.id)) return false;
        if (updatedPendingOrRunning.has(node.id)) return false;

        const incomingEdges = definition.edges.filter(
            (e) => e.target === node.id
        );
        if (incomingEdges.length === 0) return false; // Initial nodes already handled

        // ─── Phase 7: Join logic ────────────────────────────────────────
        // For join nodes: ALL incoming edges must be from completed nodes (barrier)
        if (node.type === "join") {
            return incomingEdges.every(
                (e) => updatedCompleted.has(e.source) || updatedSkipped.has(e.source)
            );
        }

        // For regular nodes: at least all incoming edges from completed or skipped nodes
        return incomingEdges.every(
            (e) => updatedCompleted.has(e.source) || updatedSkipped.has(e.source)
        );
    });

    // Update previous results with latest
    for (const step of updatedSteps) {
        if (step.status === "completed" && step.result) {
            previousResults[step.nodeId] = step.result;
        }
    }

    if (readyNodes.length > 0) {
        // Enqueue next batch
        for (const node of readyNodes) {
            await publishJob({
                executionId: result.executionId,
                node,
                input: execution.input as Record<string, unknown> | undefined,
                previousResults,
            });
        }
    } else if (updatedPendingOrRunning.size === 0) {
        // All steps done → mark execution as completed
        await prisma.execution.update({
            where: { id: result.executionId },
            data: {
                status: "completed",
                output: previousResults as object,
                completedAt: new Date(),
            },
        });

        // Phase 9: Audit & metrics for completed execution
        logger.info(`Execution completed`, { executionId: result.executionId });
        metrics.recordExecutionCompleted(result.durationMs);
        recordAudit({
            event: "execution.completed",
            entityType: "execution",
            entityId: result.executionId,
            metadata: { stepCount: updatedSteps.length },
        });

        executionEvents.emit(`done:${result.executionId}`, {
            status: "completed",
            output: previousResults,
        });
    }
    // else: still waiting for running steps to finish
}

// ─── Phase 7: Conditional Edge Filtering ────────────────────────────────────

/**
 * Filter outgoing edges based on the completed node's result.
 * - For condition nodes: only follow edges matching the boolean result
 * - For other nodes: follow all edges
 */
function filterActiveEdges(
    outgoingEdges: WorkflowEdge[],
    nodeType: string,
    result?: Record<string, unknown>
): WorkflowEdge[] {
    if (nodeType !== "condition") {
        return outgoingEdges;
    }

    const conditionResult = result?.result as boolean | undefined;

    // If edges have conditionBranch labels, filter by them
    const labeledEdges = outgoingEdges.filter((e) => e.conditionBranch != null);
    if (labeledEdges.length > 0) {
        const branch = conditionResult ? "true" : "false";
        return outgoingEdges.filter(
            (e) => e.conditionBranch === branch || e.conditionBranch == null
        );
    }

    // No labeled edges → follow all (backward compat)
    return outgoingEdges;
}

// ─── Phase 7: Skip Inactive Branches ────────────────────────────────────────

/**
 * Recursively skip nodes on inactive condition branches.
 * Creates skipped StepExecution records so join nodes can see them.
 */
async function skipBranch(
    nodeIds: string[],
    definition: WorkflowDefinition,
    executionId: string,
    completedNodeIds: Set<string>,
    pendingOrRunningNodeIds: Set<string>
): Promise<void> {
    for (const nodeId of nodeIds) {
        // Don't skip nodes that are already completed or pending
        if (completedNodeIds.has(nodeId) || pendingOrRunningNodeIds.has(nodeId)) {
            continue;
        }

        const node = definition.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        // Don't skip join nodes — they wait for all branches
        if (node.type === "join") continue;

        // Create a skipped step in DB
        await prisma.stepExecution.create({
            data: {
                executionId,
                nodeId: node.id,
                nodeLabel: node.label,
                nodeType: node.type,
                status: "skipped",
                completedAt: new Date(),
            },
        });

        // Recursively skip downstream nodes
        const downstream = definition.edges
            .filter((e) => e.source === nodeId)
            .map((e) => e.target);

        if (downstream.length > 0) {
            await skipBranch(
                downstream,
                definition,
                executionId,
                completedNodeIds,
                pendingOrRunningNodeIds
            );
        }
    }
}
