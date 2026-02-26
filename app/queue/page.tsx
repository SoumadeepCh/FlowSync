"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DLQItem {
    jobId: string;
    nodeLabel: string;
    nodeType: string;
    error: string;
    attempts: number;
    failedAt: string;
}

interface QueueData {
    consumer: {
        isRunning: boolean;
        activeJobs: number;
        maxConcurrency: number;
        totalRetries: number;
    };
    queue: {
        depth: number;
        totalEnqueued: number;
        totalProcessed: number;
        totalFailed: number;
    };
    dlq: {
        count: number;
        lastFailedAt: string | null;
        items: DLQItem[];
    };
}

export default function QueuePage() {
    const [data, setData] = useState<QueueData | null>(null);
    const [loading, setLoading] = useState(true);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/queue");
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch {
            console.error("Failed to fetch queue stats");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        if (!autoRefresh) return;
        const interval = setInterval(fetchStats, 2000);
        return () => clearInterval(interval);
    }, [fetchStats, autoRefresh]);

    const successRate =
        data && data.queue.totalProcessed + data.queue.totalFailed > 0
            ? (
                (data.queue.totalProcessed /
                    (data.queue.totalProcessed + data.queue.totalFailed)) *
                100
            ).toFixed(1)
            : "—";

    return (
        <div className="container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Queue Monitor</h1>
                    <p className="page-subtitle">
                        Real-time worker queue metrics, retries, and dead-letter queue
                    </p>
                </div>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh
                    </label>
                    <button className="btn btn-ghost btn-sm" onClick={fetchStats}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-center">
                    <div className="spinner" />
                </div>
            ) : !data ? (
                <div className="empty-state">
                    <div className="empty-state-icon">⚠️</div>
                    <h3 className="empty-state-title">Unable to load queue stats</h3>
                    <button className="btn btn-ghost" onClick={fetchStats}>
                        Retry
                    </button>
                </div>
            ) : (
                <>
                    {/* Consumer Status */}
                    <div className="stats-row">
                        <div className="stat-card">
                            <div className="stat-value">
                                <span
                                    className={`badge ${data.consumer.isRunning ? "badge-active" : "badge-draft"
                                        }`}
                                    style={{ fontSize: "0.875rem" }}
                                >
                                    {data.consumer.isRunning ? "● Running" : "○ Stopped"}
                                </span>
                            </div>
                            <div className="stat-label">Consumer</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">
                                {data.consumer.activeJobs}
                                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                    {" "}/ {data.consumer.maxConcurrency}
                                </span>
                            </div>
                            <div className="stat-label">Active Workers</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{data.queue.depth}</div>
                            <div className="stat-label">Queue Depth</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{successRate}%</div>
                            <div className="stat-label">Success Rate</div>
                        </div>
                    </div>

                    {/* Throughput + Retry Metrics */}
                    <h2 className="section-title" style={{ marginTop: "2rem" }}>
                        Throughput
                    </h2>
                    <div className="stats-row">
                        <div className="stat-card">
                            <div className="stat-value">{data.queue.totalEnqueued}</div>
                            <div className="stat-label">Total Enqueued</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value" style={{ color: "var(--success)" }}>
                                {data.queue.totalProcessed}
                            </div>
                            <div className="stat-label">Processed</div>
                        </div>
                        <div className="stat-card">
                            <div
                                className="stat-value"
                                style={{
                                    color:
                                        data.queue.totalFailed > 0
                                            ? "var(--danger)"
                                            : "var(--muted)",
                                }}
                            >
                                {data.queue.totalFailed}
                            </div>
                            <div className="stat-label">Failed</div>
                        </div>
                        <div className="stat-card">
                            <div
                                className="stat-value"
                                style={{
                                    color: data.consumer.totalRetries > 0 ? "var(--warning, #f59e0b)" : "var(--muted)",
                                }}
                            >
                                {data.consumer.totalRetries}
                            </div>
                            <div className="stat-label">Retries</div>
                        </div>
                    </div>

                    {/* Pipeline */}
                    <h2 className="section-title" style={{ marginTop: "2rem" }}>
                        Pipeline
                    </h2>
                    <div className="card" style={{ padding: "1.5rem" }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "0.5rem",
                                flexWrap: "wrap",
                                fontFamily: "var(--font-geist-mono)",
                                fontSize: "0.8rem",
                            }}
                        >
                            <span className="badge badge-active">Orchestrator</span>
                            <span style={{ color: "var(--muted)" }}>→</span>
                            <span className="badge badge-webhook">Publisher</span>
                            <span style={{ color: "var(--muted)" }}>→</span>
                            <span
                                className="badge"
                                style={{
                                    background: "var(--accent)",
                                    color: "#fff",
                                }}
                            >
                                Job Queue ({data.queue.depth})
                            </span>
                            <span style={{ color: "var(--muted)" }}>→</span>
                            <span className="badge badge-running">
                                Consumer ({data.consumer.activeJobs} active)
                            </span>
                            <span style={{ color: "var(--muted)" }}>→</span>
                            <span className="badge badge-completed">Result Handler</span>
                        </div>
                    </div>

                    {/* Dead-Letter Queue */}
                    <h2 className="section-title" style={{ marginTop: "2rem" }}>
                        Dead-Letter Queue
                        {data.dlq.count > 0 && (
                            <span
                                className="badge"
                                style={{
                                    background: "var(--danger)",
                                    color: "#fff",
                                    marginLeft: "0.5rem",
                                    fontSize: "0.7rem",
                                }}
                            >
                                {data.dlq.count}
                            </span>
                        )}
                    </h2>
                    {data.dlq.count === 0 ? (
                        <div className="card" style={{ padding: "1.5rem", textAlign: "center" }}>
                            <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                                No dead-lettered jobs — all retries successful ✓
                            </span>
                        </div>
                    ) : (
                        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                        <th style={thStyle}>Node</th>
                                        <th style={thStyle}>Type</th>
                                        <th style={thStyle}>Attempts</th>
                                        <th style={thStyle}>Error</th>
                                        <th style={thStyle}>Failed At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.dlq.items.map((item) => (
                                        <tr
                                            key={item.jobId}
                                            style={{ borderBottom: "1px solid var(--border)" }}
                                        >
                                            <td style={tdStyle}>{item.nodeLabel}</td>
                                            <td style={tdStyle}>
                                                <span className="badge badge-draft">
                                                    {item.nodeType}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>{item.attempts}</td>
                                            <td
                                                style={{
                                                    ...tdStyle,
                                                    color: "var(--danger)",
                                                    maxWidth: "200px",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                                title={item.error}
                                            >
                                                {item.error}
                                            </td>
                                            <td style={tdStyle}>
                                                {new Date(item.failedAt).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Quick links */}
                    <div
                        style={{
                            marginTop: "2rem",
                            display: "flex",
                            gap: "0.75rem",
                        }}
                    >
                        <Link href="/dashboard" className="btn btn-ghost btn-sm">
                            ← Dashboard
                        </Link>
                        <Link href="/executions" className="btn btn-ghost btn-sm">
                            View Executions
                        </Link>
                        <Link href="/health" className="btn btn-ghost btn-sm">
                            System Health
                        </Link>
                        <Link href="/observability" className="btn btn-ghost btn-sm">
                            Metrics
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}

const thStyle: React.CSSProperties = {
    padding: "0.75rem 1rem",
    textAlign: "left",
    fontSize: "0.75rem",
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
    padding: "0.75rem 1rem",
    fontSize: "0.85rem",
};
