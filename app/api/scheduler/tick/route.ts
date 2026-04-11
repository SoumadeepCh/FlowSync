import { NextResponse } from "next/server";
import { scheduler } from "@/lib/scheduler/scheduler";
import type { ApiResponse } from "@/lib/types";

// ─── GET /api/scheduler/tick ── Vercel Cron Entrypoint ───────────────────

export async function GET(request: Request) {
    try {
        // Vercel sends the CRON_SECRET as a Bearer token in the Authorization header
        const authHeader = request.headers.get("authorization");
        
        // If CRON_SECRET is configured, enforce it
        if (process.env.CRON_SECRET) {
            if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
                return NextResponse.json<ApiResponse>(
                    { success: false, error: "Unauthorized" },
                    { status: 401 }
                );
            }
        } else {
            console.warn("[Cron] CRON_SECRET is not set in environment variables.");
        }

        console.log("[Scheduler] Manual tick triggered via Vercel Cron.");
        await scheduler.tick();

        return NextResponse.json<ApiResponse>({
            success: true,
            data: { message: "Tick executed successfully." },
        });
    } catch (error) {
        console.error("Error executing scheduler tick:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to execute tick" },
            { status: 500 }
        );
    }
}
