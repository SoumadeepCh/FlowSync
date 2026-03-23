import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { NextResponse } from "next/server";
import { metrics } from "@/lib/observability/metrics";
import { logger } from "@/lib/observability/logger";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

// ─── GET /api/observability/metrics ── Metrics snapshot ─────────────────────

async function GET_handler() {
    try {
        const userId = await requireAuth();
        if (userId !== process.env.ADMIN_USER_ID) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Forbidden: Admin access required for global operational stats" },
                { status: 403 }
            );
        }
        const metricsData = metrics.getMetrics();
        const logStats = logger.getStats();

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                ...metricsData,
                logs: logStats,
            },
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error fetching metrics:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch metrics" },
            { status: 500 }
        );
    }
}


export const GET = withRateLimit(GET_handler);
