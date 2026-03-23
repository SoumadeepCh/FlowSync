import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateTriggerSchema } from "@/lib/validations";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";
import { sanitizeTrigger, sanitizeTriggers } from "@/lib/triggers";

// ─── GET /api/triggers ── List user's triggers ───────────────────────────────

async function GET_handler(request: NextRequest) {
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
            data: sanitizeTriggers(
                triggers as Array<typeof triggers[number] & { config: Record<string, unknown> | null }>
            ),
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

async function POST_handler(request: NextRequest) {
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
            {
                success: true,
                data: sanitizeTrigger(
                    trigger as typeof trigger & { config: Record<string, unknown> | null }
                ),
            },
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


export const GET = withRateLimit(GET_handler);
export const POST = withRateLimit(POST_handler);
