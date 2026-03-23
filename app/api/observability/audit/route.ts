import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { queryAuditLog } from "@/lib/observability/audit-trail";
import type { ApiResponse } from "@/lib/types";
import { requireAuth, isAuthError } from "@/lib/auth";

// ─── GET /api/observability/audit ── Audit log entries ──────────────────────

async function GET_handler(request: NextRequest) {
    try {
        const userId = await requireAuth();

        const { searchParams } = new URL(request.url);

        const event = searchParams.get("event") || undefined;
        const entityType = searchParams.get("entityType") || undefined;
        const entityId = searchParams.get("entityId") || undefined;
        const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
        const offset = parseInt(searchParams.get("offset") || "0", 10);

        const result = await queryAuditLog({
            event,
            entityType,
            entityId,
            userId,
            limit,
            offset,
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: result,
        });
    } catch (error) {
        if (isAuthError(error)) return error.response;
        console.error("Error fetching audit log:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch audit log" },
            { status: 500 }
        );
    }
}


export const GET = withRateLimit(GET_handler);
