// ─── Phase 9.5: Worker Heartbeat Monitor ────────────────────────────────────
//
// Tracks currently active jobs and detects stalled ones that haven't
// sent a heartbeat within a configurable threshold.

export interface HeartbeatEntry {
    jobId: string;
    executionId: string;
    nodeLabel: string;
    startedAt: number;
    lastHeartbeat: number;
}

export interface HeartbeatStatus {
    activeJobs: number;
    stalledJobs: number;
    entries: HeartbeatEntry[];
}

const STALL_THRESHOLD_MS = 30_000; // 30 seconds without heartbeat = stalled

class WorkerHeartbeat {
    private activeJobs = new Map<string, HeartbeatEntry>();
    private stallThresholdMs: number;

    constructor(stallThresholdMs = STALL_THRESHOLD_MS) {
        this.stallThresholdMs = stallThresholdMs;
    }

    /**
     * Register a job as actively being processed.
     */
    registerJob(jobId: string, executionId: string, nodeLabel: string): void {
        const now = Date.now();
        this.activeJobs.set(jobId, {
            jobId,
            executionId,
            nodeLabel,
            startedAt: now,
            lastHeartbeat: now,
        });
    }

    /**
     * Update the heartbeat timestamp for an active job.
     */
    heartbeat(jobId: string): void {
        const entry = this.activeJobs.get(jobId);
        if (entry) {
            entry.lastHeartbeat = Date.now();
        }
    }

    /**
     * Remove a job from the active set (completed or failed).
     */
    deregisterJob(jobId: string): void {
        this.activeJobs.delete(jobId);
    }

    /**
     * Get all jobs that haven't heartbeated within the threshold.
     */
    getStalledJobs(): HeartbeatEntry[] {
        const now = Date.now();
        const stalled: HeartbeatEntry[] = [];

        for (const entry of this.activeJobs.values()) {
            if (now - entry.lastHeartbeat > this.stallThresholdMs) {
                stalled.push(entry);
            }
        }

        return stalled;
    }

    /**
     * Get current heartbeat status.
     */
    getStatus(): HeartbeatStatus {
        const entries = Array.from(this.activeJobs.values());
        const now = Date.now();
        const stalledCount = entries.filter(
            (e) => now - e.lastHeartbeat > this.stallThresholdMs
        ).length;

        return {
            activeJobs: entries.length,
            stalledJobs: stalledCount,
            entries,
        };
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const workerHeartbeat = new WorkerHeartbeat();
export { workerHeartbeat };
export default workerHeartbeat;
