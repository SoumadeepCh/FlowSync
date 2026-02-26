// ─── Orchestrator (Phase 4/5/9/9.5 refactored) ──────────────────────────────
//
// Now uses the worker/queue layer instead of inline execution.
// Steps are published to the job queue → consumer dispatches to handlers
// → result handler updates state and enqueues next steps.
// Phase 9: Structured logging and audit trail.
// Phase 9.5: Configurable timeout increased to 5 minutes.

import { prisma } from "./prisma";
import { Prisma } from "@/generated/prisma";
import type { WorkflowDefinition } from "./types";
import { publishJob } from "./queue/job-publisher";
import { executionEvents } from "./queue/result-handler";
import { logger } from "./observability/logger";
import { metrics } from "./observability/metrics";
import { recordAudit } from "./observability/audit-trail";
// Importing consumer auto-starts it
import "./queue/job-consumer";

interface OrchestratorResult {
    executionId: string;
    status: "completed" | "failed";
    output?: Record<string, unknown>;
    error?: string;
}

/**
 * Execute a workflow by ID. Creates an Execution record, publishes the
 * first batch of ready nodes to the job queue, and waits for completion.
 */
export async function executeWorkflow(
    workflowId: string,
    input?: Record<string, unknown>,
    userId?: string
): Promise<OrchestratorResult> {
    // 1. Load workflow
    const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
    });

    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const definition = workflow.definitionJson as unknown as WorkflowDefinition;

    // 2. Create execution record
    const execution = await prisma.execution.create({
        data: {
            workflowId,
            status: "running",
            input: (input ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            userId: userId || null,
            startedAt: new Date(),
        },
    });

    // Phase 9: Log and record audit
    logger.info("Execution started", {
        executionId: execution.id,
        workflowId,
        workflowName: workflow.name,
    });
    metrics.recordExecutionStarted();
    recordAudit({
        event: "execution.started",
        entityType: "execution",
        entityId: execution.id,
        metadata: { workflowId, workflowName: workflow.name },
    });

    // 3. Find initial ready nodes (nodes with no incoming edges)
    const nodesWithIncoming = new Set(
        definition.edges.map((e) => e.target)
    );
    const initialNodes = definition.nodes.filter(
        (n) => !nodesWithIncoming.has(n.id)
    );

    if (initialNodes.length === 0) {
        // No starting nodes → complete immediately
        await prisma.execution.update({
            where: { id: execution.id },
            data: {
                status: "completed",
                output: {} as object,
                completedAt: new Date(),
            },
        });
        return { executionId: execution.id, status: "completed", output: {} };
    }

    // 4. Publish initial jobs to the queue
    for (const node of initialNodes) {
        await publishJob({
            executionId: execution.id,
            node,
            input,
            previousResults: {},
        });
    }

    // 5. Wait for execution to complete (via event from result handler)
    const result = await waitForExecution(execution.id);

    return {
        executionId: execution.id,
        status: result.status,
        output: result.output,
        error: result.error,
    };
}

/**
 * Wait for an execution to finish using event-based signaling.
 * Times out after 60s to prevent hanging.
 */
function waitForExecution(
    executionId: string
): Promise<{ status: "completed" | "failed"; output?: Record<string, unknown>; error?: string }> {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            executionEvents.removeAllListeners(`done:${executionId}`);
            resolve({ status: "failed", error: "Execution timed out (5m)" });
        }, 300_000); // Phase 9.5: 5-minute timeout for production workloads

        executionEvents.once(
            `done:${executionId}`,
            (data: { status: "completed" | "failed"; output?: Record<string, unknown>; error?: string }) => {
                clearTimeout(timeout);
                resolve(data);
            }
        );
    });
}
