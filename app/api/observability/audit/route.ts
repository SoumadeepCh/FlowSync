import { NextRequest, NextResponse } from "next/server";
import { queryAuditLog } from "@/lib/observability/audit-trail";
import type { ApiResponse } from "@/lib/types";

// ─── GET /api/observability/audit ── Audit log entries ──────────────────────

export async function GET(request: NextRequest) {
    try {
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
            limit,
            offset,
        });

        return NextResponse.json<ApiResponse>({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Error fetching audit log:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Failed to fetch audit log" },
            { status: 500 }
        );
    }
}
