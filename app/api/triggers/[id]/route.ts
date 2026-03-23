import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateTriggerSchema } from "@/lib/validations";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";
import { sanitizeTrigger } from "@/lib/triggers";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/triggers/[id] ── Get trigger detail ────────────────────────────

async function GET_handler(request: NextRequest, context: RouteContext) {
    try {
        const userId = await requireAuth();
        const { id } = await context.params;

        const trigger = await prisma.trigger.findUnique({
            where: { id },
            include: {
                workflow: { select: { id: true, name: true, status: true } },
            },
        });

        if (!trigger || trigger.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Trigger not found" },
                { status: 404 }
            );
        }

        return NextResponse.json<ApiResponse>({
            success: true,
            data: sanitizeTrigger(
                trigger as typeof trigger & { config: Record<string, unknown> | null }
            ),
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error fetching trigger:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch trigger" },
            { status: 500 }
        );
    }
}

// ─── PUT /api/triggers/[id] ── Update trigger ────────────────────────────────

async function PUT_handler(request: NextRequest, context: RouteContext) {
    try {
        const userId = await requireAuth();
        const { id } = await context.params;

        const existing = await prisma.trigger.findUnique({ where: { id } });
        if (!existing || existing.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Trigger not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        const parseResult = UpdateTriggerSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Validation failed" },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = {};
        if (parseResult.data.enabled !== undefined)
            updateData.enabled = parseResult.data.enabled;
        if (parseResult.data.config !== undefined)
            updateData.config = parseResult.data.config as object;

        const trigger = await prisma.trigger.update({
            where: { id },
            data: updateData,
            include: {
                workflow: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: sanitizeTrigger(
                trigger as typeof trigger & { config: Record<string, unknown> | null }
            ),
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error updating trigger:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to update trigger" },
            { status: 500 }
        );
    }
}

// ─── DELETE /api/triggers/[id] ── Delete trigger ─────────────────────────────

async function DELETE_handler(request: NextRequest, context: RouteContext) {
    try {
        const userId = await requireAuth();
        const { id } = await context.params;

        const existing = await prisma.trigger.findUnique({ where: { id } });
        if (!existing || existing.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Trigger not found" },
                { status: 404 }
            );
        }

        await prisma.trigger.delete({ where: { id } });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: { message: "Trigger deleted" },
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error deleting trigger:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to delete trigger" },
            { status: 500 }
        );
    }
}


export const GET = withRateLimit(GET_handler);
export const PUT = withRateLimit(PUT_handler);
export const DELETE = withRateLimit(DELETE_handler);
