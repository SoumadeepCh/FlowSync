import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateTriggerSchema } from "@/lib/validations";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

// ─── GET /api/triggers ── List user's triggers ───────────────────────────────

export async function GET(request: NextRequest) {
    try {
        const userId = await requireAuth();

        const { searchParams } = new URL(request.url);
        const workflowId = searchParams.get("workflowId");

        const where: Record<string, unknown> = { userId };
        if (workflowId) where.workflowId = workflowId;

        const triggers = await prisma.trigger.findMany({
            where,
            include: {
                workflow: { select: { id: true, name: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: triggers,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error listing triggers:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to list triggers" },
            { status: 500 }
        );
    }
}

// ─── POST /api/triggers ── Create a trigger ─────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const userId = await requireAuth();

        const body = await request.json();

        const parseResult = CreateTriggerSchema.safeParse(body);
        if (!parseResult.success) {
            const fieldErrors = parseResult.error.issues.map(
                (issue) => `${issue.path.join(".")}: ${issue.message}`
            );
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Validation failed", errors: fieldErrors },
                { status: 400 }
            );
        }

        const { workflowId, type, config } = parseResult.data;

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

        // For webhook triggers, generate a secret key
        const triggerConfig =
            type === "webhook"
                ? { ...config, webhookSecret: crypto.randomUUID() }
                : config;

        const trigger = await prisma.trigger.create({
            data: {
                workflowId,
                type,
                config: triggerConfig as object,
                userId,
            },
            include: {
                workflow: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json<ApiResponse>(
            { success: true, data: trigger },
            { status: 201 }
        );
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error creating trigger:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to create trigger" },
            { status: 500 }
        );
    }
}
