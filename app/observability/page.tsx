"use client";

import { useEffect, useState, useCallback } from "react";
import {
    RefreshCw, TrendingUp, Gauge, Zap,
    CheckCircle2, XCircle, Clock, BarChart3,
} from "lucide-react";

interface MetricsData {
    executions: {
        totalExecutions: number;
        completedExecutions: number;
        failedExecutions: number;
        avgDurationMs: number;
        totalDurationMs: number;
    };
    steps: Record<string, {
        nodeType: string;
        count: number;
        successCount: number;
        failureCount: number;
        totalDurationMs: number;
        avgDurationMs: number;
        minDurationMs: number;
        maxDurationMs: number;
    }>;
    queue: {
        totalJobsProcessed: number;
        totalRetries: number;
        totalDLQEntries: number;
    };
    uptime: number;
    collectedAt: string;
    logs: {
        totalEntries: number;
        maxBufferSize: number;
        counts: { debug: number; info: number; warn: number; error: number };
    };
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

export default function ObservabilityPage() {
    const [data, setData] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch("/api/observability/metrics");
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMetrics();
        const interval = setInterval(fetchMetrics, 15_000);
        return () => clearInterval(interval);
    }, [fetchMetrics]);

    if (loading) {
        return <div className="container"><div className="loading-center"><div className="spinner" /></div></div>;
    }

    if (!data) {
        return (
            <div className="container">
                <div className="empty-state">
                    <div className="empty-state-icon"><BarChart3 size={48} strokeWidth={1} /></div>
                    <h3 className="empty-state-title">No Metrics Available</h3>
                    <p className="empty-state-text">Metrics will appear once workflows are executed.</p>
                </div>
            </div>
        );
    }

    const stepEntries = Object.values(data.steps);
    const successRate = data.executions.totalExecutions > 0
        ? Math.round((data.executions.completedExecutions / data.executions.totalExecutions) * 100)
        : 0;

    return (
        <div className="container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Metrics & Observability</h1>
                    <p className="page-subtitle">
                        Live performance metrics • Auto-refreshes every 15s • Uptime: {formatUptime(data.uptime)}
                    </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={fetchMetrics}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Execution Overview */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-value">{data.executions.totalExecutions}</div>
                    <div className="stat-label"><Zap size={12} style={{ display: "inline", marginRight: 4 }} />Total Executions</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--success)" }}>{successRate}%</div>
                    <div className="stat-label"><TrendingUp size={12} style={{ display: "inline", marginRight: 4 }} />Success Rate</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{formatDuration(data.executions.avgDurationMs)}</div>
                    <div className="stat-label"><Clock size={12} style={{ display: "inline", marginRight: 4 }} />Avg Duration</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--danger)" }}>{data.executions.failedExecutions}</div>
                    <div className="stat-label"><XCircle size={12} style={{ display: "inline", marginRight: 4 }} />Failed</div>
                </div>
            </div>

            {/* Queue Throughput */}
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Gauge size={18} /> Queue Throughput
            </h2>
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-value">{data.queue.totalJobsProcessed}</div>
                    <div className="stat-label"><CheckCircle2 size={12} style={{ display: "inline", marginRight: 4 }} />Jobs Processed</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--warning)" }}>{data.queue.totalRetries}</div>
                    <div className="stat-label"><RefreshCw size={12} style={{ display: "inline", marginRight: 4 }} />Retries</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--danger)" }}>{data.queue.totalDLQEntries}</div>
                    <div className="stat-label">DLQ Entries</div>
                </div>
            </div>

            {/* Log Buffer */}
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                📋 Log Buffer
            </h2>
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-value">{data.logs.totalEntries}</div>
                    <div className="stat-label">Total Entries</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{data.logs.counts.info}</div>
                    <div className="stat-label">Info</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--warning)" }}>{data.logs.counts.warn}</div>
                    <div className="stat-label">Warnings</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value" style={{ color: "var(--danger)" }}>{data.logs.counts.error}</div>
                    <div className="stat-label">Errors</div>
                </div>
            </div>

            {/* Step Metrics Table */}
            {stepEntries.length > 0 && (
                <>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "2rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <BarChart3 size={18} /> Step Metrics by Node Type
                    </h2>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Node Type</th>
                                <th>Total</th>
                                <th>Success</th>
                                <th>Failed</th>
                                <th>Avg Duration</th>
                                <th>Min</th>
                                <th>Max</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stepEntries.map((step) => (
                                <tr key={step.nodeType}>
                                    <td><span className={`badge badge-${step.nodeType}`}>{step.nodeType}</span></td>
                                    <td>{step.count}</td>
                                    <td style={{ color: "var(--success)" }}>{step.successCount}</td>
                                    <td style={{ color: step.failureCount > 0 ? "var(--danger)" : "inherit" }}>{step.failureCount}</td>
                                    <td className="duration">{formatDuration(step.avgDurationMs)}</td>
                                    <td className="duration">{formatDuration(step.minDurationMs)}</td>
                                    <td className="duration">{formatDuration(step.maxDurationMs)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}
