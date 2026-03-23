import { withRateLimit } from "@/lib/middleware/with-rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeWorkflow } from "@/lib/orchestrator";
import type { ApiResponse } from "@/lib/types";

type RouteContext = { params: Promise<{ triggerId: string }> };

// ─── POST /api/webhooks/[triggerId] ── Webhook ingestion ─────────────────────
//
// External systems call this URL to fire a trigger and start a workflow execution.

async function POST_handler(request: NextRequest, context: RouteContext) {
    try {
        const { triggerId } = await context.params;

        // 1. Find trigger
        const trigger = await prisma.trigger.findUnique({
            where: { id: triggerId },
            include: {
                workflow: true,
            },
        });

        if (!trigger) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Trigger not found" },
                { status: 404 }
            );
        }

        // 2. Check trigger is enabled
        if (!trigger.enabled) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Trigger is disabled" },
                { status: 403 }
            );
        }

        // 3. Check trigger type is webhook
        if (trigger.type !== "webhook") {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "This trigger is not a webhook trigger" },
                { status: 400 }
            );
        }

        // 3.5 Verify webhook secret (mandatory)
        const expectedSecret = (trigger.config as Record<string, unknown>)?.webhookSecret as string | undefined;
        const providedSecret = request.headers.get("x-webhook-secret");

        if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
            return NextResponse.json<ApiResponse>(
                { success: false, error: "Unauthorized: Invalid or missing webhook secret" },
                { status: 401 }
            );
        }

        // 4. Check workflow is active
        if (trigger.workflow.status !== "active") {
            return NextResponse.json<ApiResponse>(
                {
                    success: false,
                    error: `Workflow is "${trigger.workflow.status}" — must be active`,
                },
                { status: 400 }
            );
        }

        // 5. Parse webhook payload as input
        let input: Record<string, unknown> = {};
        try {
            input = await request.json();
        } catch {
            // Body might be empty or non-JSON — that's OK
        }

        // 6. Execute the workflow
        const result = await executeWorkflow(trigger.workflowId, {
            ...input,
            _trigger: {
                id: trigger.id,
                type: trigger.type,
                firedAt: new Date().toISOString(),
            },
        });

        // 7. Update trigger's lastFiredAt
        await prisma.trigger.update({
            where: { id: triggerId },
            data: { lastFiredAt: new Date() },
        });

        // 8. Return minimal execution receipt (no internal details)
        return NextResponse.json<ApiResponse>(
            {
                success: true,
                data: {
                    executionId: result.executionId,
                    status: result.status,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json<ApiResponse>(
            { success: false, error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}


export const POST = withRateLimit(POST_handler);
