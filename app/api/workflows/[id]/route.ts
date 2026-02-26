import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateWorkflowSchema } from "@/lib/validations";
import { validateDAG } from "@/lib/dag-validator";
import type { ApiResponse, WorkflowDefinition } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/workflows/[id] ── Get single workflow ──────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const userId = await requireAuth();
        const { id } = await context.params;

        const workflow = await prisma.workflow.findUnique({
            where: { id },
        });

        if (!workflow || workflow.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Workflow not found" },
                { status: 404 }
            );
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            data: workflow,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error fetching workflow:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch workflow" },
            { status: 500 }
        );
    }
}

// ─── PUT /api/workflows/[id] ── Update workflow ──────────────────────────────

export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const userId = await requireAuth();
        const { id } = await context.params;

        // Check workflow exists and belongs to user
        const existing = await prisma.workflow.findUnique({
            where: { id },
        });

        if (!existing || existing.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Workflow not found" },
                { status: 404 }
            );
        }

        const body = await request.json();

        // Validate request body
        const parseResult = UpdateWorkflowSchema.safeParse(body);
        if (!parseResult.success) {
            const fieldErrors = parseResult.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`
            );
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Validation failed", errors: fieldErrors },
                { status: 400 }
            );
        }

        const { name, description, definitionJson, status } = parseResult.data;

        // If definitionJson is provided, validate DAG
        if (definitionJson) {
            const dagValidation = validateDAG(
                definitionJson as WorkflowDefinition
            );
            if (!dagValidation.valid) {
                return NextResponse.json<ApiResponse>(
                    {
                        success: false,
                        error: "Invalid workflow graph",
                        errors: dagValidation.errors,
                    },
                    { status: 400 }
                );
            }
        }

        // Build update data — bump version if definition or name changes
        const shouldBumpVersion = !!(definitionJson || name);
        const updateData: Record<string, unknown> = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (definitionJson !== undefined)
            updateData.definitionJson = definitionJson as object;
        if (status !== undefined) updateData.status = status;
        if (shouldBumpVersion) updateData.version = existing.version + 1;

        const workflow = await prisma.workflow.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: workflow,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error updating workflow:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to update workflow" },
            { status: 500 }
        );
    }
}

// ─── DELETE /api/workflows/[id] ── Delete workflow ───────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const userId = await requireAuth();
        const { id } = await context.params;

        const existing = await prisma.workflow.findUnique({
            where: { id },
        });

        if (!existing || existing.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Workflow not found" },
                { status: 404 }
            );
        }

        await prisma.workflow.delete({
            where: { id },
        });

        return NextResponse.json<ApiResponse>(
            { success: true, data: { message: "Workflow deleted" } },
            { status: 200 }
        );
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error deleting workflow:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to delete workflow" },
            { status: 500 }
        );
    }
}
