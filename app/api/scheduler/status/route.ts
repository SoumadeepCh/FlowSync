import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { NextResponse } from "next/server";
import { scheduler } from "@/lib/scheduler/scheduler";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

// ─── GET /api/scheduler/status ── Scheduler status ──────────────────────────

async function GET_handler() {
    try {
        const userId = await requireAuth();
        if (userId !== process.env.ADMIN_USER_ID) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Forbidden: Admin access required for global operational stats" },
                { status: 403 }
            );
        }
        const status = scheduler.getStatus();

        return NextResponse.json<ApiResponse>({
            success: true,
            data: status,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error fetching scheduler status:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch scheduler status" },
            { status: 500 }
        );
    }
}


export const GET = withRateLimit(GET_handler);
