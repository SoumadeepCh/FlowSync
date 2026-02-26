// ─── Phase 4+6: Worker Abstraction Types ────────────────────────────────────

import type { WorkflowNode } from "../types";

/**
 * Retry policy for a step. Can be set per-node in config.retry.
 */
export interface RetryPolicy {
    /** Max number of retry attempts (default: 0 = no retries) */
    maxRetries: number;
    /** Initial backoff delay in ms (default: 1000) */
    backoffMs: number;
    /** Backoff multiplier for exponential growth (default: 2) */
    backoffMultiplier: number;
}

/** Default retry policy */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxRetries: 0,
    backoffMs: 1000,
    backoffMultiplier: 2,
};

/**
 * A job dispatched to a worker for execution.
 */
export interface WorkerJob {
    id: string;                              // unique job ID (= stepExecution.id)
    executionId: string;
    stepId: string;                          // stepExecution ID
    node: WorkflowNode;
    input?: Record<string, unknown>;         // workflow-level input
    previousResults: Record<string, unknown>; // results from prior steps
    attempt: number;
    maxRetries: number;
    createdAt: Date;
}

/**
 * The outcome of a worker executing a job.
 */
export interface WorkerResult {
    jobId: string;
    stepId: string;
    executionId: string;
    status: "completed" | "failed";
    result?: Record<string, unknown>;
    error?: string;
    durationMs: number;
    /** Whether this failure is eligible for retry (default: true) */
    retryable?: boolean;
}

/**
 * Interface every action handler must implement.
 */
export interface ActionHandler {
    /** The node type this handler processes (e.g. "start", "action", "delay") */
    readonly type: string;

    /** Execute the job and return a result */
    execute(job: WorkerJob): Promise<WorkerResult>;
}

/**
 * Worker pool configuration.
 */
export interface WorkerConfig {
    /** Max concurrent jobs the consumer will run (default: 3) */
    concurrency: number;
    /** Default timeout per job in ms (default: 30_000) */
    defaultTimeoutMs: number;
}
