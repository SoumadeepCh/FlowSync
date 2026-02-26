import { z } from "zod";

// ─── Node Schema ─────────────────────────────────────────────────────────────

const WorkflowNodeSchema = z.object({
    id: z.string().min(1, "Node ID is required"),
    type: z.enum(["start", "end", "action", "condition", "delay", "fork", "join"]),
    label: z.string().min(1, "Node label is required"),
    config: z.record(z.string(), z.unknown()).default({}),
    position: z
        .object({
            x: z.number(),
            y: z.number(),
        })
        .optional(),
});

// ─── Edge Schema ─────────────────────────────────────────────────────────────

const WorkflowEdgeSchema = z.object({
    id: z.string().min(1, "Edge ID is required"),
    source: z.string().min(1, "Edge source is required"),
    target: z.string().min(1, "Edge target is required"),
    condition: z.string().optional(),
});

// ─── Definition Schema ───────────────────────────────────────────────────────

const WorkflowDefinitionSchema = z.object({
    nodes: z.array(WorkflowNodeSchema).min(1, "At least one node is required"),
    edges: z.array(WorkflowEdgeSchema),
});

// ─── Create Workflow Schema ──────────────────────────────────────────────────

export const CreateWorkflowSchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .max(255, "Name must be 255 characters or less"),
    description: z
        .string()
        .max(1000, "Description must be 1000 characters or less")
        .optional(),
    definitionJson: WorkflowDefinitionSchema,
});

// ─── Update Workflow Schema ──────────────────────────────────────────────────

export const UpdateWorkflowSchema = z.object({
    name: z
        .string()
        .min(1, "Name is required")
        .max(255, "Name must be 255 characters or less")
        .optional(),
    description: z
        .string()
        .max(1000, "Description must be 1000 characters or less")
        .nullable()
        .optional(),
    definitionJson: WorkflowDefinitionSchema.optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
});

// ─── Type exports ────────────────────────────────────────────────────────────

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;

// ─── Phase 2: Execution Schemas ──────────────────────────────────────────────

export const StartExecutionSchema = z.object({
    workflowId: z.string().min(1, "Workflow ID is required"),
    input: z.record(z.string(), z.unknown()).optional(),
});

export type StartExecutionInput = z.infer<typeof StartExecutionSchema>;

// ─── Phase 3: Trigger Schemas ────────────────────────────────────────────────

export const CreateTriggerSchema = z.object({
    workflowId: z.string().min(1, "Workflow ID is required"),
    type: z.enum(["manual", "webhook", "cron"]),
    config: z.record(z.string(), z.unknown()).default({}),
});

export const UpdateTriggerSchema = z.object({
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
});

export type CreateTriggerInput = z.infer<typeof CreateTriggerSchema>;
export type UpdateTriggerInput = z.infer<typeof UpdateTriggerSchema>;
