// ─── Phase 6: Idempotency Store ─────────────────────────────────────────────
//
// In-memory idempotency layer with TTL. Prevents duplicate step creation
// during retries. Upgrade to Redis for production.

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface IdempotencyEntry {
    stepId: string;
    expiresAt: number;
}

class IdempotencyStore {
    private store = new Map<string, IdempotencyEntry>();
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor(cleanupIntervalMs = 60_000) {
        // Periodic cleanup of expired entries
        this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
        // Ensure cleanup timer doesn't prevent process exit
        if (this.cleanupInterval.unref) {
            this.cleanupInterval.unref();
        }
    }

    /**
     * Generate a dedupe key for a step.
     */
    generateKey(executionId: string, nodeId: string): string {
        return `${executionId}:${nodeId}`;
    }

    /**
     * Check if a key exists and is not expired.
     * If not seen → stores it and returns { duplicate: false }
     * If already seen → returns { duplicate: true, existingStepId }
     */
    checkAndSet(
        key: string,
        stepId: string,
        ttlMs = DEFAULT_TTL_MS
    ): { duplicate: boolean; existingStepId?: string } {
        const existing = this.store.get(key);
        if (existing && existing.expiresAt > Date.now()) {
            return { duplicate: true, existingStepId: existing.stepId };
        }

        // Store new entry
        this.store.set(key, {
            stepId,
            expiresAt: Date.now() + ttlMs,
        });
        return { duplicate: false };
    }

    /**
     * Remove a key (e.g. on retry to allow re-publishing).
     */
    remove(key: string): void {
        this.store.delete(key);
    }

    /**
     * Get current store size.
     */
    get size(): number {
        return this.store.size;
    }

    /**
     * Remove expired entries.
     */
    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (entry.expiresAt <= now) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Dispose of the cleanup timer.
     */
    dispose(): void {
        clearInterval(this.cleanupInterval);
    }
}

// Singleton
const idempotencyStore = new IdempotencyStore();
export { idempotencyStore };
export default idempotencyStore;
