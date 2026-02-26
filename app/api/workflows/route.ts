import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateWorkflowSchema } from "@/lib/validations";
import { validateDAG } from "@/lib/dag-validator";
import type { ApiResponse, WorkflowDefinition } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

// ─── GET /api/workflows ── List user's workflows ─────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const userId = await requireAuth();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        const where: Record<string, string> = { userId };
        if (status) where.status = status;

        const workflows = await prisma.workflow.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: workflows,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error listing workflows:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to list workflows" },
            { status: 500 }
        );
    }
}

// ─── POST /api/workflows ── Create a new workflow ────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const userId = await requireAuth();

        const body = await request.json();

        // Validate request body
        const parseResult = CreateWorkflowSchema.safeParse(body);
        if (!parseResult.success) {
            const fieldErrors = parseResult.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`
            );
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Validation failed", errors: fieldErrors },
                { status: 400 }
            );
        }

        const { name, description, definitionJson } = parseResult.data;

        // Validate DAG structure
        const dagValidation = validateDAG(definitionJson as WorkflowDefinition);
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

        // Create workflow scoped to user
        const workflow = await prisma.workflow.create({
            data: {
                name,
                description: description || null,
                definitionJson: definitionJson as object,
                version: 1,
                status: "draft",
                userId,
            },
        });

        return NextResponse.json<ApiResponse>(
            { success: true, data: workflow },
            { status: 201 }
        );
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error creating workflow:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to create workflow" },
            { status: 500 }
        );
    }
}
