// ─── Phase 9: Audit Trail ───────────────────────────────────────────────────
//
// Records significant system events to the AuditLog database table.
// Used for compliance, debugging, and operational visibility.

import { prisma } from "../prisma";

export type AuditEvent =
    | "execution.started"
    | "execution.completed"
    | "execution.failed"
    | "execution.cancelled"
    | "trigger.fired"
    | "step.completed"
    | "step.failed"
    | "step.retried"
    | "dlq.entry"
    | "scheduler.tick"
    | "scheduler.trigger_fired";

export type AuditEntityType = "execution" | "trigger" | "step" | "scheduler" | "workflow";

export interface AuditEntry {
    event: AuditEvent;
    entityType: AuditEntityType;
    entityId: string;
    metadata?: Record<string, unknown>;
}

/**
 * Record an audit event to the database.
 * Fire-and-forget to avoid blocking the main flow.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                event: entry.event,
                entityType: entry.entityType,
                entityId: entry.entityId,
                metadata: (entry.metadata ?? {}) as object,
            },
        });
    } catch (err) {
        // Audit failures should never break the main flow
        console.error("[AuditTrail] Failed to record event:", err);
    }
}

/**
 * Batch record multiple audit events.
 */
export async function recordAuditBatch(entries: AuditEntry[]): Promise<void> {
    try {
        await prisma.auditLog.createMany({
            data: entries.map((entry) => ({
                event: entry.event,
                entityType: entry.entityType,
                entityId: entry.entityId,
                metadata: (entry.metadata ?? {}) as object,
            })),
        });
    } catch (err) {
        console.error("[AuditTrail] Failed to batch record events:", err);
    }
}

/**
 * Query audit log entries with filters and pagination.
 */
export async function queryAuditLog(options?: {
    event?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
}) {
    const { event, entityType, entityId, userId, limit = 50, offset = 0 } = options ?? {};

    // @ts-ignore Prisma typing workaround for dynamic OR clauses
    const where: any = {};
    if (event) where.event = event;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    if (userId) {
        // Enforce cross-tenant isolation
        const userWorkflows = await prisma.workflow.findMany({ where: { userId }, select: { id: true } });
        const userExecutions = await prisma.execution.findMany({ where: { userId }, select: { id: true } });
        const userTriggers = await prisma.trigger.findMany({ where: { userId }, select: { id: true } });
        const userSteps = await prisma.stepExecution.findMany({ where: { execution: { userId } }, select: { id: true } });

        where.OR = [
            { entityType: "workflow", entityId: { in: userWorkflows.map(w => w.id) } },
            { entityType: "execution", entityId: { in: userExecutions.map(e => e.id) } },
            { entityType: "trigger", entityId: { in: userTriggers.map(t => t.id) } },
            { entityType: "step", entityId: { in: userSteps.map(s => s.id) } }
        ];
    }

    const [entries, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
        }),
        prisma.auditLog.count({ where }),
    ]);

    return { entries, total, limit, offset };
}
