// ─── Phase 9.5: Backpressure Controller ─────────────────────────────────────
//
// Prevents the job queue from growing unbounded under high load.
// Blocks new job acceptance when the queue depth exceeds a threshold.

import { jobQueue } from "./job-queue";

export interface BackpressureConfig {
    /** Max queue depth before applying backpressure */
    maxQueueDepth: number;
    /** High-water mark: start rejecting at this depth */
    highWaterMark: number;
    /** Low-water mark: resume accepting below this depth */
    lowWaterMark: number;
}

const DEFAULT_CONFIG: BackpressureConfig = {
    maxQueueDepth: 1000,
    highWaterMark: 800,
    lowWaterMark: 200,
};

export type BackpressureState = "accepting" | "pressured" | "rejecting";

class BackpressureController {
    private config: BackpressureConfig;
    private _state: BackpressureState = "accepting";
    private _totalRejected = 0;

    constructor(config: Partial<BackpressureConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Check if the system can accept a new job.
     */
    canAccept(): boolean {
        const depth = jobQueue.depth;

        if (depth >= this.config.maxQueueDepth) {
            this._state = "rejecting";
            return false;
        }

        if (depth >= this.config.highWaterMark) {
            this._state = "pressured";
            // Allow but warn
            return true;
        }

        if (depth <= this.config.lowWaterMark) {
            this._state = "accepting";
        }

        return true;
    }

    /**
     * Record a rejected job.
     */
    recordRejection(): void {
        this._totalRejected++;
    }

    /**
     * Get current backpressure status.
     */
    getStatus() {
        return {
            state: this._state,
            currentDepth: jobQueue.depth,
            maxQueueDepth: this.config.maxQueueDepth,
            highWaterMark: this.config.highWaterMark,
            lowWaterMark: this.config.lowWaterMark,
            totalRejected: this._totalRejected,
        };
    }

    get state(): BackpressureState {
        return this._state;
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const backpressure = new BackpressureController();
export { backpressure };
export default backpressure;
