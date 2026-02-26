// ─── Workflow Node Types ─────────────────────────────────────────────────────

export type NodeType = "start" | "end" | "action" | "condition" | "delay" | "fork" | "join" | "transform" | "webhook_response";

export interface WorkflowNode {
    id: string;
    type: NodeType;
    label: string;
    config: Record<string, unknown>;
    position?: { x: number; y: number }; // for visual rendering
}

// ─── Workflow Edge Types ─────────────────────────────────────────────────────

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    condition?: string; // for condition nodes
    /** For conditional branching: which branch this edge belongs to */
    conditionBranch?: "true" | "false";
}

// ─── Workflow Definition (DAG) ───────────────────────────────────────────────

export interface WorkflowDefinition {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

// ─── Workflow Status ─────────────────────────────────────────────────────────

export type WorkflowStatus = "draft" | "active" | "archived";

// ─── Execution Status (Phase 2) ─────────────────────────────────────────────

export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

// ─── Trigger Types (Phase 3) ────────────────────────────────────────────────

export type TriggerType = "manual" | "webhook" | "cron";

// ─── API Types ───────────────────────────────────────────────────────────────

export interface CreateWorkflowInput {
    name: string;
    description?: string;
    definitionJson: WorkflowDefinition;
}

export interface UpdateWorkflowInput {
    name?: string;
    description?: string;
    definitionJson?: WorkflowDefinition;
    status?: WorkflowStatus;
}

export interface StartExecutionInput {
    workflowId: string;
    input?: Record<string, unknown>;
}

export interface CreateTriggerInput {
    workflowId: string;
    type: TriggerType;
    config?: Record<string, unknown>;
}

export interface UpdateTriggerInput {
    enabled?: boolean;
    config?: Record<string, unknown>;
}

// ─── DAG Validation Result ───────────────────────────────────────────────────

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    errors?: string[];
}
