import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/executions/[id]/timeline ── Execution timeline ────────────────

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const userId = await requireAuth();
        const { id } = await context.params;

        const execution = await prisma.execution.findUnique({
            where: { id },
            include: {
                workflow: { select: { id: true, name: true, version: true } },
                steps: { orderBy: { createdAt: "asc" } },
            },
        });

        if (!execution || execution.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Execution not found" },
                { status: 404 }
            );
        }

        // Build timeline entries from step executions
        const timeline = execution.steps.map((step) => {
            const startedAt = step.startedAt ? new Date(step.startedAt).getTime() : null;
            const completedAt = step.completedAt ? new Date(step.completedAt).getTime() : null;
            const durationMs = startedAt && completedAt ? completedAt - startedAt : null;

            return {
                stepId: step.id,
                nodeId: step.nodeId,
                nodeLabel: step.nodeLabel,
                nodeType: step.nodeType,
                status: step.status,
                attempts: step.attempts,
                startedAt: step.startedAt,
                completedAt: step.completedAt,
                durationMs,
                error: step.error,
                result: step.result,
            };
        });

        // Calculate execution-level timing
        const executionStarted = execution.startedAt
            ? new Date(execution.startedAt).getTime()
            : null;
        const executionCompleted = execution.completedAt
            ? new Date(execution.completedAt).getTime()
            : null;
        const totalDurationMs =
            executionStarted && executionCompleted
                ? executionCompleted - executionStarted
                : null;

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                executionId: execution.id,
                workflowId: execution.workflowId,
                workflowName: execution.workflow.name,
                workflowVersion: execution.workflow.version,
                status: execution.status,
                startedAt: execution.startedAt,
                completedAt: execution.completedAt,
                totalDurationMs,
                stepCount: timeline.length,
                completedSteps: timeline.filter((s) => s.status === "completed").length,
                failedSteps: timeline.filter((s) => s.status === "failed").length,
                skippedSteps: timeline.filter((s) => s.status === "skipped").length,
                timeline,
            },
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error fetching execution timeline:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch execution timeline" },
            { status: 500 }
        );
    }
}
