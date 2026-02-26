import { NextResponse } from "next/server";
import { metrics } from "@/lib/observability/metrics";
import { logger } from "@/lib/observability/logger";
import type { ApiResponse } from "@/lib/types";

// ─── GET /api/observability/metrics ── Metrics snapshot ─────────────────────

export async function GET() {
    try {
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
        console.error("Error fetching metrics:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch metrics" },
            { status: 500 }
        );
    }
}
