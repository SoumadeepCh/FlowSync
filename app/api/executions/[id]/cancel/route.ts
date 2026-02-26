import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/executions/[id]/cancel ── Cancel execution ────────────────────

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const userId = await requireAuth();
        const { id } = await context.params;

        const execution = await prisma.execution.findUnique({
            where: { id },
        });

        if (!execution || execution.userId !== userId) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Execution not found" },
                { status: 404 }
            );
        }

        if (execution.status !== "pending" && execution.status !== "running") {
            return NextResponse.json<ApiResponse>(
                {
                    success: false,
                    error: `Cannot cancel execution with status "${execution.status}"`,
                },
                { status: 400 }
            );
        }

        const updated = await prisma.execution.update({
            where: { id },
            data: {
                status: "cancelled",
                completedAt: new Date(),
            },
        });

        // Mark any pending/running steps as skipped
        await prisma.stepExecution.updateMany({
            where: {
                executionId: id,
                status: { in: ["pending", "running"] },
            },
            data: {
                status: "skipped",
                completedAt: new Date(),
            },
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: updated,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error cancelling execution:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to cancel execution" },
            { status: 500 }
        );
    }
}
