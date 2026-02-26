import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { StartExecutionSchema } from "@/lib/validations";
import { executeWorkflow } from "@/lib/orchestrator";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

// ─── GET /api/executions ── List user's executions ───────────────────────────

export async function GET(request: NextRequest) {
    try {
        const userId = await requireAuth();

        const { searchParams } = new URL(request.url);
        const workflowId = searchParams.get("workflowId");
        const status = searchParams.get("status");

        const where: Record<string, unknown> = { userId };
        if (workflowId) where.workflowId = workflowId;
        if (status) where.status = status;

        const executions = await prisma.execution.findMany({
            where,
            include: {
                workflow: { select: { id: true, name: true } },
                _count: { select: { steps: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: executions,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error listing executions:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to list executions" },
            { status: 500 }
        );
    }
}

// ─── POST /api/executions ── Start a new execution ──────────────────────────

export async function POST(request: NextRequest) {
    try {
        const userId = await requireAuth();

        const body = await request.json();

        const parseResult = StartExecutionSchema.safeParse(body);
        if (!parseResult.success) {
            const fieldErrors = parseResult.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`
            );
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Validation failed", errors: fieldErrors },
                { status: 400 }
            );
        }

        const { workflowId, input } = parseResult.data;

        // Check workflow exists and belongs to user
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId },
        });

        if (!workflow || workflow.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Workflow not found" },
                { status: 404 }
            );
        }

        if (workflow.status !== "active") {
            return NextResponse.json<ApiResponse>(
                {
                    success: false,
                    error: `Workflow is "${workflow.status}" — only active workflows can be executed`,
                },
                { status: 400 }
            );
        }

        // Execute workflow with userId
        const result = await executeWorkflow(workflowId, input, userId);

        // Fetch the full execution with steps
        const execution = await prisma.execution.findUnique({
            where: { id: result.executionId },
            include: {
                workflow: { select: { id: true, name: true } },
                steps: { orderBy: { createdAt: "asc" } },
            },
        });

        return NextResponse.json<ApiResponse>(
            { success: true, data: execution },
            { status: 201 }
        );
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error starting execution:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to start execution" },
            { status: 500 }
        );
    }
}
