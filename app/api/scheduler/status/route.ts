import { NextResponse } from "next/server";
import { scheduler } from "@/lib/scheduler/scheduler";
import type { ApiResponse } from "@/lib/types";

// ─── GET /api/scheduler/status ── Scheduler status ──────────────────────────

export async function GET() {
    try {
        const status = scheduler.getStatus();

        return NextResponse.json<ApiResponse>({
            success: true,
            data: status,
        });
    } catch (error) {
        console.error("Error fetching scheduler status:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch scheduler status" },
            { status: 500 }
        );
    }
}
