"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
    ArrowLeft, CheckCircle2, XCircle, Clock, Play,
    Ban, SkipForward, RotateCcw, Hash, GitBranch,
    Timer, Layers, RefreshCw,
} from "lucide-react";

interface StepExecution {
    id: string;
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    status: string;
    attempts: number;
    result: Record<string, unknown> | null;
    error: string | null;
    startedAt: string | null;
    completedAt: string | null;
}

interface ExecutionDetail {
    id: string;
    workflowId: string;
    status: string;
    input: Record<string, unknown> | null;
    output: Record<string, unknown> | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    workflow: { id: string; name: string; version: number };
    steps: StepExecution[];
}

const STATUS_ICON: Record<string, React.ReactNode> = {
    completed: <CheckCircle2 size={14} color="var(--success)" />,
    failed: <XCircle size={14} color="var(--danger)" />,
    running: <Play size={14} color="var(--primary-hover)" />,
    pending: <Clock size={14} color="var(--muted)" />,
    skipped: <SkipForward size={14} color="var(--muted)" />,
    cancelled: <Ban size={14} color="var(--warning)" />,
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

export default function ExecutionDetailPage() {
    const params = useParams();
    const id = params.id as string;

    const [execution, setExecution] = useState<ExecutionDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const fetchExecution = useCallback(async () => {
        try {
            const res = await fetch(`/api/executions/${id}`);
            const data = await res.json();
            if (data.success) {
                setExecution(data.data);
            } else {
                setError(data.error || "Not found");
            }
        } catch {
            setError("Failed to load execution");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchExecution();
    }, [fetchExecution]);

    // Auto-refresh while running
    useEffect(() => {
        if (!execution || execution.status !== "running") return;
        const interval = setInterval(fetchExecution, 3_000);
        return () => clearInterval(interval);
    }, [execution?.status, fetchExecution]);

    const handleCancel = async () => {
        setCancelling(true);
        try {
            const res = await fetch(`/api/executions/${id}/cancel`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                toast.success("Execution cancelled");
                fetchExecution();
            } else {
                toast.error(data.error || "Failed to cancel");
            }
        } catch {
            toast.error("Connection error");
        } finally {
            setCancelling(false);
        }
    };

    if (loading) {
        return (
            <div className="container">
                {/* Skeleton loader */}
                <div className="skeleton" style={{ width: 160, height: 16, marginBottom: 24 }} />
                <div className="skeleton" style={{ width: "100%", height: 180, borderRadius: 14, marginBottom: 24 }} />
                <div className="skeleton" style={{ width: 120, height: 20, marginBottom: 16 }} />
                <div className="skeleton" style={{ width: "100%", height: 80, borderRadius: 12, marginBottom: 12 }} />
                <div className="skeleton" style={{ width: "100%", height: 80, borderRadius: 12 }} />
            </div>
        );
    }

    if (error || !execution) {
        return (
            <div className="container">
                <div className="empty-state">
                    <div className="empty-state-icon"><XCircle size={48} strokeWidth={1} /></div>
                    <h3 className="empty-state-title">{error || "Execution not found"}</h3>
                    <Link href="/executions" className="btn btn-ghost" style={{ marginTop: "1rem" }}>
                        <ArrowLeft size={14} /> Back to Executions
                    </Link>
                </div>
            </div>
        );
    }

    const completedSteps = execution.steps.filter((s) => s.status === "completed").length;
    const totalSteps = execution.steps.length;
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    const isActive = execution.status === "running" || execution.status === "pending";

    return (
        <div className="container">
            <Link href="/executions" className="back-link">
                <ArrowLeft size={14} /> Back to Executions
            </Link>

            {/* Header */}
            <div className="detail-header">
                <div className="detail-header-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {STATUS_ICON[execution.status]}
                        <h1 className="detail-title">{execution.workflow.name}</h1>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span className={`badge badge-${execution.status}`}>
                            {execution.status}
                        </span>
                        {isActive && (
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={handleCancel}
                                disabled={cancelling}
                            >
                                <Ban size={13} /> {cancelling ? "Cancelling…" : "Cancel"}
                            </button>
                        )}
                        {isActive && (
                            <button className="btn btn-ghost btn-sm" onClick={fetchExecution}>
                                <RefreshCw size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.375rem" }}>
                    {completedSteps}/{totalSteps} steps completed ({progressPercent}%)
                    {isActive && <span className="pulse-text"> • Live</span>}
                </div>

                <div className="detail-meta" style={{ marginTop: "1rem" }}>
                    <div className="detail-meta-item">
                        <span className="detail-meta-label"><Hash size={10} style={{ display: "inline", marginRight: 3 }} />Execution ID</span>
                        <span className="detail-meta-value">{execution.id.slice(0, 8)}…</span>
                    </div>
                    <div className="detail-meta-item">
                        <span className="detail-meta-label"><GitBranch size={10} style={{ display: "inline", marginRight: 3 }} />Version</span>
                        <span className="detail-meta-value">v{execution.workflow.version}</span>
                    </div>
                    <div className="detail-meta-item">
                        <span className="detail-meta-label"><Timer size={10} style={{ display: "inline", marginRight: 3 }} />Duration</span>
                        <span className="detail-meta-value">
                            {formatDuration(execution.startedAt, execution.completedAt)}
                        </span>
                    </div>
                    <div className="detail-meta-item">
                        <span className="detail-meta-label"><Clock size={10} style={{ display: "inline", marginRight: 3 }} />Started</span>
                        <span className="detail-meta-value">
                            {execution.startedAt ? formatTime(execution.startedAt) : "—"}
                        </span>
                    </div>
                    <div className="detail-meta-item">
                        <span className="detail-meta-label"><Layers size={10} style={{ display: "inline", marginRight: 3 }} />Steps</span>
                        <span className="detail-meta-value">
                            {completedSteps}/{totalSteps}
                        </span>
                    </div>
                </div>
            </div>

            {/* Step Timeline */}
            <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Layers size={16} /> Step Timeline
            </h2>
            <div className="step-timeline">
                {execution.steps.map((step) => (
                    <div key={step.id} className={`step-item step-${step.status}`}>
                        <div className="step-header">
                            <span className="step-name" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {STATUS_ICON[step.status] || <Clock size={14} />}
                                {step.nodeLabel}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span className={`badge badge-${step.status}`} style={{ fontSize: "0.625rem" }}>
                                    {step.status}
                                </span>
                                <span className="duration">
                                    {formatDuration(step.startedAt, step.completedAt)}
                                </span>
                            </div>
                        </div>
                        <div className="step-info">
                            Type: <strong>{step.nodeType}</strong>
                            &nbsp;·&nbsp;Node: <code>{step.nodeId}</code>
                            {step.attempts > 1 && (
                                <span style={{ color: "var(--warning)", display: "inline-flex", alignItems: "center", gap: "0.25rem", marginLeft: "0.5rem" }}>
                                    <RotateCcw size={11} /> {step.attempts} attempts
                                </span>
                            )}
                        </div>
                        {step.error && (
                            <div className="step-error">{step.error}</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
