// ─── Phase 9.5: Token Bucket Rate Limiter ───────────────────────────────────
//
// In-memory rate limiter using the token bucket algorithm.
// Keyed by client IP for per-client throttling.

export interface RateLimiterConfig {
    /** Max tokens (burst capacity) */
    maxTokens: number;
    /** Tokens added per second */
    refillRate: number;
    /** Window for cleanup of stale entries (ms) */
    cleanupIntervalMs: number;
}

interface Bucket {
    tokens: number;
    lastRefill: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
    maxTokens: 60,      // 60 requests burst
    refillRate: 10,       // 10 tokens/second
    cleanupIntervalMs: 60_000,
};

class RateLimiter {
    private buckets = new Map<string, Bucket>();
    private config: RateLimiterConfig;
    private cleanupHandle: ReturnType<typeof setInterval>;

    constructor(config: Partial<RateLimiterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Periodic cleanup of stale buckets
        this.cleanupHandle = setInterval(
            () => this.cleanup(),
            this.config.cleanupIntervalMs
        );
        if (this.cleanupHandle.unref) {
            this.cleanupHandle.unref();
        }
    }

    /**
     * Check if a request from the given key is allowed.
     * Returns { allowed, remaining, retryAfterMs }.
     */
    consume(key: string): {
        allowed: boolean;
        remaining: number;
        retryAfterMs?: number;
    } {
        const now = Date.now();
        let bucket = this.buckets.get(key);

        if (!bucket) {
            bucket = { tokens: this.config.maxTokens, lastRefill: now };
            this.buckets.set(key, bucket);
        }

        // Refill tokens based on elapsed time
        const elapsed = (now - bucket.lastRefill) / 1000;
        const tokensToAdd = elapsed * this.config.refillRate;
        bucket.tokens = Math.min(
            this.config.maxTokens,
            bucket.tokens + tokensToAdd
        );
        bucket.lastRefill = now;

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return { allowed: true, remaining: Math.floor(bucket.tokens) };
        }

        // Not enough tokens — calculate retry time
        const msUntilToken = ((1 - bucket.tokens) / this.config.refillRate) * 1000;
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: Math.ceil(msUntilToken),
        };
    }

    /**
     * Get current state for a key.
     */
    getStatus(key: string) {
        const bucket = this.buckets.get(key);
        if (!bucket) {
            return { tokens: this.config.maxTokens, maxTokens: this.config.maxTokens };
        }
        return {
            tokens: Math.floor(bucket.tokens),
            maxTokens: this.config.maxTokens,
        };
    }

    /**
     * Get overall rate limiter stats.
     */
    getStats() {
        return {
            activeBuckets: this.buckets.size,
            config: this.config,
        };
    }

    /**
     * Remove stale buckets (keys that are fully refilled and idle).
     */
    private cleanup(): void {
        const now = Date.now();
        const staleThresholdMs = 5 * 60 * 1000; // 5 minutes idle

        for (const [key, bucket] of this.buckets) {
            if (now - bucket.lastRefill > staleThresholdMs) {
                this.buckets.delete(key);
            }
        }
    }

    /**
     * Dispose cleanup timer.
     */
    dispose(): void {
        clearInterval(this.cleanupHandle);
    }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter();
export { rateLimiter };
export default rateLimiter;
