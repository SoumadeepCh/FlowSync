import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConsumerStatus } from "@/lib/queue/job-consumer";
import { metrics } from "@/lib/observability/metrics";
import { workerHeartbeat } from "@/lib/workers/worker-heartbeat";
import { backpressure } from "@/lib/queue/backpressure";
import { rateLimiter } from "@/lib/middleware/rate-limiter";
import type { ApiResponse } from "@/lib/types";

const startTime = Date.now();

// ─── GET /api/health ── Health check / readiness probe ──────────────────────

export async function GET() {
    try {
        // 1. DB connectivity check
        let dbStatus = "healthy";
        let dbLatencyMs = 0;
        try {
            const dbStart = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            dbLatencyMs = Date.now() - dbStart;
        } catch {
            dbStatus = "unhealthy";
        }

        // 2. Consumer status
        const consumer = getConsumerStatus();

        // 3. Worker heartbeat
        const heartbeat = workerHeartbeat.getStatus();

        // 4. Backpressure
        const bp = backpressure.getStatus();

        // 5. Memory usage
        const memUsage = process.memoryUsage();

        // 6. Metrics summary
        const metricsSnapshot = metrics.getMetrics();

        const uptimeMs = Date.now() - startTime;
        const isHealthy = dbStatus === "healthy" && consumer.isRunning;

        return NextResponse.json<ApiResponse>(
            {
                success: true,
                data: {
                    status: isHealthy ? "healthy" : "degraded",
                    uptimeMs,
                    uptimeFormatted: formatUptime(uptimeMs),
                    timestamp: new Date().toISOString(),
                    checks: {
                        database: {
                            status: dbStatus,
                            latencyMs: dbLatencyMs,
                        },
                        consumer: {
                            status: consumer.isRunning ? "running" : "stopped",
                            activeJobs: consumer.activeJobs,
                            maxConcurrency: consumer.maxConcurrency,
                            totalRetries: consumer.totalRetries,
                        },
                        queue: {
                            depth: consumer.queueStats.depth,
                            totalEnqueued: consumer.queueStats.totalEnqueued,
                            totalProcessed: consumer.queueStats.totalProcessed,
                            totalFailed: consumer.queueStats.totalFailed,
                        },
                        workers: {
                            activeJobs: heartbeat.activeJobs,
                            stalledJobs: heartbeat.stalledJobs,
                        },
                        backpressure: {
                            state: bp.state,
                            currentDepth: bp.currentDepth,
                            maxDepth: bp.maxQueueDepth,
                            totalRejected: bp.totalRejected,
                        },
                        rateLimiter: rateLimiter.getStats(),
                        dlq: consumer.dlqStats,
                    },
                    metrics: {
                        executions: metricsSnapshot.executions,
                        queueThroughput: metricsSnapshot.queue,
                    },
                    memory: {
                        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
                        rssMB: Math.round(memUsage.rss / 1024 / 1024),
                    },
                },
            },
            { status: isHealthy ? 200 : 503 }
        );
    } catch (error) {
        console.error("Health check error:", error);
        return NextResponse.json<ApiResponse>(
            {
                success: false,
                error: "Health check failed",
            },
            { status: 503 }
        );
    }
}

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}
