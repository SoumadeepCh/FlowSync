"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Database, Cpu, Layers, Users, ShieldAlert, Inbox,
    RefreshCw, Heart, MemoryStick, Timer, Activity,
    CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react";

interface HealthData {
    status: string;
    uptimeMs: number;
    uptimeFormatted: string;
    timestamp: string;
    checks: {
        database: { status: string; latencyMs: number };
        consumer: { status: string; activeJobs: number; maxConcurrency: number; totalRetries: number };
        queue: { depth: number; totalEnqueued: number; totalProcessed: number; totalFailed: number };
        workers: { activeJobs: number; stalledJobs: number };
        backpressure: { state: string; currentDepth: number; maxDepth: number; totalRejected: number };
        rateLimiter: { activeBuckets: number };
        dlq: { size: number; totalAdded: number };
    };
    metrics: {
        executions: { totalExecutions: number; completedExecutions: number; failedExecutions: number; avgDurationMs: number };
        queueThroughput: { totalJobsProcessed: number; totalRetries: number; totalDLQEntries: number };
    };
    memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
}

function StatusIcon({ status }: { status: string }) {
    if (status === "healthy" || status === "running" || status === "accepting")
        return <CheckCircle2 size={14} color="var(--success)" />;
    if (status === "degraded" || status === "pressured")
        return <AlertTriangle size={14} color="var(--warning)" />;
    return <XCircle size={14} color="var(--danger)" />;
}

export default function HealthPage() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch("/api/health");
            const json = await res.json();
            if (json.success) {
                setData(json.data);
                setError(null);
            } else {
                setError(json.error);
            }
        } catch {
            setError("Failed to connect to health endpoint");
        } finally {
            setLoading(false);
            setLastRefresh(new Date());
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 10_000);
        return () => clearInterval(interval);
    }, [fetchHealth]);

    if (loading) {
        return (
            <div className="container">
                <div className="loading-center"><div className="spinner" /></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="container">
                <div className="empty-state">
                    <div className="empty-state-icon"><Heart size={48} strokeWidth={1} /></div>
                    <h3 className="empty-state-title">Health Check Failed</h3>
                    <p className="empty-state-text">{error}</p>
                    <button className="btn btn-ghost" onClick={fetchHealth}>
                        <RefreshCw size={14} /> Retry
                    </button>
                </div>
            </div>
        );
    }

    const { checks, metrics, memory } = data;

    return (
        <div className="container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">System Health</h1>
                    <p className="page-subtitle">
                        Live system status • Auto-refreshes every 10s • Last: {lastRefresh.toLocaleTimeString()}
                    </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1rem", fontWeight: 700 }}>
                        <StatusIcon status={data.status} />
                        {data.status.toUpperCase()}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={fetchHealth}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                </div>
            </div>

            {/* Uptime + Memory */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-value">{data.uptimeFormatted}</div>
                    <div className="stat-label"><Timer size={12} style={{ display: "inline", marginRight: 4 }} />Uptime</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{memory.heapUsedMB}</div>
                    <div className="stat-label"><MemoryStick size={12} style={{ display: "inline", marginRight: 4 }} />Heap Used (MB)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{memory.rssMB}</div>
                    <div className="stat-label"><Cpu size={12} style={{ display: "inline", marginRight: 4 }} />RSS (MB)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{checks.database.latencyMs}ms</div>
                    <div className="stat-label"><Database size={12} style={{ display: "inline", marginRight: 4 }} />DB Latency</div>
                </div>
            </div>

            {/* Service Checks Grid */}
            <div className="health-grid">
                <div className="health-card">
                    <div className="health-card-header">
                        <StatusIcon status={checks.database.status} />
                        <span className="health-card-title" style={{ marginLeft: 8 }}>
                            <Database size={14} style={{ display: "inline", marginRight: 6 }} />Database
                        </span>
                    </div>
                    <div className="health-card-body">
                        <div className="health-meta">Status: <strong>{checks.database.status}</strong></div>
                        <div className="health-meta">Latency: <strong>{checks.database.latencyMs}ms</strong></div>
                    </div>
                </div>

                <div className="health-card">
                    <div className="health-card-header">
                        <StatusIcon status={checks.consumer.status} />
                        <span className="health-card-title" style={{ marginLeft: 8 }}>
                            <Cpu size={14} style={{ display: "inline", marginRight: 6 }} />Consumer
                        </span>
                    </div>
                    <div className="health-card-body">
                        <div className="health-meta">Active Jobs: <strong>{checks.consumer.activeJobs}/{checks.consumer.maxConcurrency}</strong></div>
                        <div className="health-meta">Retries: <strong>{checks.consumer.totalRetries}</strong></div>
                    </div>
                </div>

                <div className="health-card">
                    <div className="health-card-header">
                        <StatusIcon status={checks.queue.depth > 800 ? "pressured" : "healthy"} />
                        <span className="health-card-title" style={{ marginLeft: 8 }}>
                            <Layers size={14} style={{ display: "inline", marginRight: 6 }} />Queue
                        </span>
                    </div>
                    <div className="health-card-body">
                        <div className="health-meta">Depth: <strong>{checks.queue.depth}</strong></div>
                        <div className="health-meta">Processed: <strong>{checks.queue.totalProcessed}</strong></div>
                        <div className="health-meta">Failed: <strong>{checks.queue.totalFailed}</strong></div>
                    </div>
                </div>

                <div className="health-card">
                    <div className="health-card-header">
                        <StatusIcon status={checks.workers.stalledJobs > 0 ? "degraded" : "healthy"} />
                        <span className="health-card-title" style={{ marginLeft: 8 }}>
                            <Users size={14} style={{ display: "inline", marginRight: 6 }} />Workers
                        </span>
                    </div>
                    <div className="health-card-body">
                        <div className="health-meta">Active: <strong>{checks.workers.activeJobs}</strong></div>
                        <div className="health-meta">Stalled: <strong style={{ color: checks.workers.stalledJobs > 0 ? "var(--danger)" : "inherit" }}>{checks.workers.stalledJobs}</strong></div>
                    </div>
                </div>

                <div className="health-card">
                    <div className="health-card-header">
                        <StatusIcon status={checks.backpressure.state} />
                        <span className="health-card-title" style={{ marginLeft: 8 }}>
                            <ShieldAlert size={14} style={{ display: "inline", marginRight: 6 }} />Backpressure
                        </span>
                    </div>
                    <div className="health-card-body">
                        <div className="health-meta">State: <strong>{checks.backpressure.state}</strong></div>
                        <div className="health-meta">Depth: <strong>{checks.backpressure.currentDepth}/{checks.backpressure.maxDepth}</strong></div>
                        <div className="health-meta">Rejected: <strong>{checks.backpressure.totalRejected}</strong></div>
                    </div>
                </div>

                <div className="health-card">
                    <div className="health-card-header">
                        <StatusIcon status={checks.dlq.size > 0 ? "degraded" : "healthy"} />
                        <span className="health-card-title" style={{ marginLeft: 8 }}>
                            <Inbox size={14} style={{ display: "inline", marginRight: 6 }} />Dead Letter Queue
                        </span>
                    </div>
                    <div className="health-card-body">
                        <div className="health-meta">Current Size: <strong style={{ color: checks.dlq.size > 0 ? "var(--warning)" : "inherit" }}>{checks.dlq.size}</strong></div>
                        <div className="health-meta">Total Added: <strong>{checks.dlq.totalAdded}</strong></div>
                    </div>
                </div>
            </div>

            {/* Execution Metrics Summary */}
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "2rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Activity size={18} /> Execution Summary
            </h2>
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-value">{metrics.executions.totalExecutions}</div>
                    <div className="stat-label">Total Executions</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--success)" }}>{metrics.executions.completedExecutions}</div>
                    <div className="stat-label">Completed</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--danger)" }}>{metrics.executions.failedExecutions}</div>
                    <div className="stat-label">Failed</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{metrics.executions.avgDurationMs}ms</div>
                    <div className="stat-label">Avg Duration</div>
                </div>
            </div>
        </div>
    );
}
