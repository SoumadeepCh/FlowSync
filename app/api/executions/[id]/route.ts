import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/executions/[id] ── Get execution detail ────────────────────────

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

        return NextResponse.json<ApiResponse>({
            success: true,
            data: execution,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error fetching execution:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch execution" },
            { status: 500 }
        );
    }
}
