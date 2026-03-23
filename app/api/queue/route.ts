import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { NextResponse } from "next/server";
import { getConsumerStatus } from "@/lib/queue/job-consumer";
import { dlq } from "@/lib/queue/dead-letter-queue";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

// ─── GET /api/queue ── Queue monitoring stats (Phase 5+6) ────────────────────

async function GET_handler() {
    try {
        const userId = await requireAuth();
        if (userId !== process.env.ADMIN_USER_ID) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Forbidden: Admin access required for global operational stats" },
                { status: 403 }
            );
        }
        const status = await getConsumerStatus();
        const dlqItems = dlq.getItems().map((item) => ({
            jobId: item.job.id,
            nodeLabel: item.job.node.label,
            nodeType: item.job.node.type,
            error: item.error,
            attempts: item.attempts,
            failedAt: item.failedAt.toISOString(),
        }));

        return NextResponse.json<ApiResponse>({
            success: true,
            data: {
                consumer: {
                    isRunning: status.isRunning,
                    activeJobs: status.activeJobs,
                    maxConcurrency: status.maxConcurrency,
                    totalRetries: status.totalRetries,
                },
                queue: status.queueStats,
                dlq: {
                    ...status.dlqStats,
                    items: dlqItems,
                },
            },
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error fetching queue stats:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch queue stats" },
            { status: 500 }
        );
    }
}


export const GET = withRateLimit(GET_handler);
