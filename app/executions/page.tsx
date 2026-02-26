"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Play, Clock, AlertCircle, CheckCircle2, XCircle, Filter } from "lucide-react";

interface Execution {
    id: string;
    workflowId: string;
    status: string;
    input: Record<string, unknown> | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    workflow: { id: string; name: string };
    _count: { steps: number };
}

const STATUS_FILTERS = ["all", "running", "completed", "failed", "cancelled", "pending"] as const;

const STATUS_ICONS: Record<string, React.ReactNode> = {
    running: <Play size={12} />,
    completed: <CheckCircle2 size={12} />,
    failed: <XCircle size={12} />,
    cancelled: <AlertCircle size={12} />,
    pending: <Clock size={12} />,
};

function formatDuration(start: string | null, end: string | null): string {
    if (!start) return "—";
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const ms = e - s;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export default function ExecutionsPage() {
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");

    const fetchExecutions = useCallback(async () => {
        try {
            const url = filter === "all" ? "/api/executions" : `/api/executions?status=${filter}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) setExecutions(data.data);
        } catch {
            console.error("Failed to fetch executions");
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchExecutions();
    }, [fetchExecutions]);

    return (
        <div className="container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Executions</h1>
                    <p className="page-subtitle">Monitor workflow runs and their step progress</p>
                </div>
            </div>

            {/* Status filter */}
            <div className="filter-bar">
                <Filter size={14} style={{ color: "var(--muted)", marginRight: "0.25rem" }} />
                {STATUS_FILTERS.map((s) => (
                    <button
                        key={s}
                        className={`filter-btn ${filter === s ? "active" : ""}`}
                        onClick={() => { setFilter(s); setLoading(true); }}
                    >
                        {s !== "all" && STATUS_ICONS[s]}
                        {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading-center">
                    <div className="spinner" />
                </div>
            ) : executions.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Play size={48} strokeWidth={1} /></div>
                    <h3 className="empty-state-title">No executions yet</h3>
                    <p className="empty-state-text">
                        Run a workflow from the dashboard to see executions here.
                    </p>
                    <Link href="/dashboard" className="btn btn-primary">
                        Go to Dashboard
                    </Link>
                </div>
            ) : (
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Workflow</th>
                            <th>Status</th>
                            <th>Steps</th>
                            <th>Duration</th>
                            <th>Started</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {executions.map((exec) => (
                            <tr key={exec.id}>
                                <td>
                                    <span style={{ fontWeight: 500 }}>{exec.workflow.name}</span>
                                </td>
                                <td>
                                    <span className={`badge badge-${exec.status}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                                        {STATUS_ICONS[exec.status]}
                                        {exec.status}
                                    </span>
                                </td>
                                <td>
                                    <span className="duration">{exec._count.steps}</span>
                                </td>
                                <td>
                                    <span className="duration">
                                        {formatDuration(exec.startedAt, exec.completedAt)}
                                    </span>
                                </td>
                                <td style={{ color: "var(--muted)" }}>
                                    {exec.startedAt ? formatTime(exec.startedAt) : "—"}
                                </td>
                                <td>
                                    <Link href={`/executions/${exec.id}`} className="table-link">
                                        View Details →
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
