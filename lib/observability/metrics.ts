// ─── Phase 9: Metrics Collector ─────────────────────────────────────────────
//
// In-memory metrics for executions, steps, and queue performance.
// Provides aggregated stats for the observability API.

export interface StepMetric {
    nodeType: string;
    count: number;
    successCount: number;
    failureCount: number;
    totalDurationMs: number;
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
}

export interface ExecutionMetric {
    totalExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    avgDurationMs: number;
    totalDurationMs: number;
}

export interface MetricsSnapshot {
    executions: ExecutionMetric;
    steps: Record<string, StepMetric>;
    queue: {
        totalJobsProcessed: number;
        totalRetries: number;
        totalDLQEntries: number;
    };
    uptime: number;
    collectedAt: string;
}

class MetricsCollector {
    private startTime = Date.now();

    // Execution metrics
    private executionDurations: number[] = [];
    private executionCompletedCount = 0;
    private executionFailedCount = 0;
    private executionTotalCount = 0;

    // Step metrics by node type
    private stepMetrics = new Map<string, {
        count: number;
        successCount: number;
        failureCount: number;
        durations: number[];
    }>();

    // Queue metrics
    private queueJobsProcessed = 0;
    private queueRetries = 0;
    private queueDLQEntries = 0;

    // ─── Recording Methods ──────────────────────────────────────────────

    recordExecutionStarted(): void {
        this.executionTotalCount++;
    }

    recordExecutionCompleted(durationMs: number): void {
        this.executionCompletedCount++;
        this.executionDurations.push(durationMs);
        // Keep rolling window of last 1000 entries
        if (this.executionDurations.length > 1000) {
            this.executionDurations.shift();
        }
    }

    recordExecutionFailed(durationMs: number): void {
        this.executionFailedCount++;
        this.executionDurations.push(durationMs);
        if (this.executionDurations.length > 1000) {
            this.executionDurations.shift();
        }
    }

    recordStepCompleted(nodeType: string, durationMs: number): void {
        const metric = this.getOrCreateStepMetric(nodeType);
        metric.count++;
        metric.successCount++;
        metric.durations.push(durationMs);
        if (metric.durations.length > 500) {
            metric.durations.shift();
        }
    }

    recordStepFailed(nodeType: string, durationMs: number): void {
        const metric = this.getOrCreateStepMetric(nodeType);
        metric.count++;
        metric.failureCount++;
        metric.durations.push(durationMs);
        if (metric.durations.length > 500) {
            metric.durations.shift();
        }
    }

    recordJobProcessed(): void {
        this.queueJobsProcessed++;
    }

    recordRetry(): void {
        this.queueRetries++;
    }

    recordDLQEntry(): void {
        this.queueDLQEntries++;
    }

    // ─── Query Methods ──────────────────────────────────────────────────

    getMetrics(): MetricsSnapshot {
        const stepMetrics: Record<string, StepMetric> = {};
        for (const [nodeType, data] of this.stepMetrics) {
            const totalDuration = data.durations.reduce((sum, d) => sum + d, 0);
            stepMetrics[nodeType] = {
                nodeType,
                count: data.count,
                successCount: data.successCount,
                failureCount: data.failureCount,
                totalDurationMs: totalDuration,
                avgDurationMs: data.durations.length > 0
                    ? Math.round(totalDuration / data.durations.length)
                    : 0,
                minDurationMs: data.durations.length > 0
                    ? Math.min(...data.durations)
                    : 0,
                maxDurationMs: data.durations.length > 0
                    ? Math.max(...data.durations)
                    : 0,
            };
        }

        const totalExecDuration = this.executionDurations.reduce((s, d) => s + d, 0);

        return {
            executions: {
                totalExecutions: this.executionTotalCount,
                completedExecutions: this.executionCompletedCount,
                failedExecutions: this.executionFailedCount,
                avgDurationMs: this.executionDurations.length > 0
                    ? Math.round(totalExecDuration / this.executionDurations.length)
                    : 0,
                totalDurationMs: totalExecDuration,
            },
            steps: stepMetrics,
            queue: {
                totalJobsProcessed: this.queueJobsProcessed,
                totalRetries: this.queueRetries,
                totalDLQEntries: this.queueDLQEntries,
            },
            uptime: Date.now() - this.startTime,
            collectedAt: new Date().toISOString(),
        };
    }

    reset(): void {
        this.executionDurations = [];
        this.executionCompletedCount = 0;
        this.executionFailedCount = 0;
        this.executionTotalCount = 0;
        this.stepMetrics.clear();
        this.queueJobsProcessed = 0;
        this.queueRetries = 0;
        this.queueDLQEntries = 0;
    }

    // ─── Internal ───────────────────────────────────────────────────────

    private getOrCreateStepMetric(nodeType: string) {
        if (!this.stepMetrics.has(nodeType)) {
            this.stepMetrics.set(nodeType, {
                count: 0,
                successCount: 0,
                failureCount: 0,
                durations: [],
            });
        }
        return this.stepMetrics.get(nodeType)!;
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const metrics = new MetricsCollector();
export { metrics };
export default metrics;
