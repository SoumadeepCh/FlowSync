"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Plus, Trash2, Play, Pause, RefreshCw,
    LayoutGrid, CheckCircle, FileText, Zap,
} from "lucide-react";

interface Workflow {
    id: string;
    name: string;
    description: string | null;
    version: number;
    status: string;
    definitionJson: {
        nodes: { id: string; type: string; label: string }[];
        edges: { id: string; source: string; target: string }[];
    };
    createdAt: string;
    updatedAt: string;
}

// ─── Minimal valid workflow template ─────────────────────────────────────────

const DEFAULT_DEFINITION = {
    nodes: [
        { id: "start", type: "start" as const, label: "Start", config: {} },
        { id: "end", type: "end" as const, label: "End", config: {} },
    ],
    edges: [{ id: "e1", source: "start", target: "end" }],
};

export default function DashboardPage() {
    const router = useRouter();
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const [runningId, setRunningId] = useState<string | null>(null);
    const [execCount, setExecCount] = useState(0);

    // ─── Fetch workflows ────────────────────────────────────────────────

    const fetchWorkflows = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/workflows");
            const data = await res.json();
            if (data.success) {
                setWorkflows(data.data);
            } else {
                setError(data.error || "Failed to load workflows");
            }
        } catch {
            setError("Failed to connect to server");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchExecCount = useCallback(async () => {
        try {
            const res = await fetch("/api/executions");
            const data = await res.json();
            if (data.success) setExecCount(data.data.length);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        fetchWorkflows();
        fetchExecCount();
    }, [fetchWorkflows, fetchExecCount]);

    // ─── Create workflow ────────────────────────────────────────────────

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        try {
            setCreating(true);
            setCreateError(null);

            const res = await fetch("/api/workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDesc.trim() || undefined,
                    definitionJson: DEFAULT_DEFINITION,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setShowCreate(false);
                setNewName("");
                setNewDesc("");
                fetchWorkflows();
                toast.success("Workflow created", {
                    description: `"${newName.trim()}" is ready to configure`,
                });
            } else {
                setCreateError(
                    data.errors?.join(", ") || data.error || "Failed to create workflow"
                );
                toast.error("Failed to create workflow");
            }
        } catch {
            setCreateError("Failed to connect to server");
            toast.error("Connection error");
        } finally {
            setCreating(false);
        }
    };

    // ─── Delete workflow ────────────────────────────────────────────────

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete workflow "${name}"?`)) return;

        try {
            const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                fetchWorkflows();
                toast.success("Workflow deleted", {
                    description: `"${name}" has been removed`,
                });
            } else {
                toast.error(data.error || "Failed to delete");
            }
        } catch {
            toast.error("Failed to connect to server");
        }
    };

    // ─── Toggle status ─────────────────────────────────────────────────

    const handleToggleStatus = async (
        id: string,
        currentStatus: string
    ) => {
        const newStatus = currentStatus === "active" ? "draft" : "active";
        try {
            const res = await fetch(`/api/workflows/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                fetchWorkflows();
                toast.success(
                    newStatus === "active" ? "Workflow activated" : "Workflow paused",
                    { description: `Status changed to ${newStatus}` }
                );
            }
        } catch {
            toast.error("Failed to update status");
        }
    };

    // ─── Run workflow ──────────────────────────────────────────────────

    const handleRun = async (id: string, name: string) => {
        setRunningId(id);
        toast.loading("Starting execution…", { id: "run-" + id });
        try {
            const res = await fetch("/api/executions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflowId: id }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Execution started", {
                    id: "run-" + id,
                    description: `"${name}" is now running`,
                });
                router.push(`/executions/${data.data.id}`);
            } else {
                toast.error(data.error || "Failed to run workflow", { id: "run-" + id });
            }
        } catch {
            toast.error("Connection error", { id: "run-" + id });
        } finally {
            setRunningId(null);
        }
    };

    // ─── Stats ──────────────────────────────────────────────────────────

    const totalWorkflows = workflows.length;
    const activeCount = workflows.filter((w) => w.status === "active").length;
    const draftCount = workflows.filter((w) => w.status === "draft").length;

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    return (
        <div className="container">
            {/* ─── Header ──────────────────────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Workflows</h1>
                    <p className="page-subtitle">
                        Manage your DAG-based workflow definitions
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus size={16} /> New Workflow
                </button>
            </div>

            {/* ─── Stats ───────────────────────────────────────────────── */}
            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-value">{totalWorkflows}</div>
                    <div className="stat-label"><LayoutGrid size={12} style={{ display: "inline", marginRight: 4 }} />Total Workflows</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{activeCount}</div>
                    <div className="stat-label"><CheckCircle size={12} style={{ display: "inline", marginRight: 4 }} />Active</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{draftCount}</div>
                    <div className="stat-label"><FileText size={12} style={{ display: "inline", marginRight: 4 }} />Draft</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{execCount}</div>
                    <div className="stat-label"><Zap size={12} style={{ display: "inline", marginRight: 4 }} />Executions</div>
                </div>
            </div>

            {/* ─── Content ─────────────────────────────────────────────── */}
            {loading ? (
                <div className="loading-center">
                    <div className="spinner" />
                </div>
            ) : error ? (
                <div className="empty-state">
                    <div className="empty-state-icon">⚠️</div>
                    <div className="empty-state-title">Error</div>
                    <p className="empty-state-text">{error}</p>
                    <button className="btn btn-ghost" onClick={fetchWorkflows}>
                        <RefreshCw size={14} /> Retry
                    </button>
                </div>
            ) : workflows.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">⚡</div>
                    <div className="empty-state-title">No workflows yet</div>
                    <p className="empty-state-text">
                        Create your first workflow to get started with FlowSync.
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreate(true)}
                    >
                        <Plus size={16} /> Create Workflow
                    </button>
                </div>
            ) : (
                <div className="workflow-grid">
                    {workflows.map((w) => (
                        <div key={w.id} className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">{w.name}</div>
                                    {w.description && (
                                        <p className="card-description">{w.description}</p>
                                    )}
                                </div>
                                <span className={`badge badge-${w.status}`}>{w.status}</span>
                            </div>
                            <div className="card-meta">
                                <span>v{w.version}</span>
                                <span>•</span>
                                <span>
                                    {w.definitionJson.nodes?.length || 0} nodes,{" "}
                                    {w.definitionJson.edges?.length || 0} edges
                                </span>
                                <span>•</span>
                                <span>{formatDate(w.createdAt)}</span>
                            </div>
                            <div
                                className="card-actions"
                                style={{ marginTop: "1rem" }}
                            >
                                {w.status === "active" && (
                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => handleRun(w.id, w.name)}
                                        disabled={runningId === w.id}
                                    >
                                        <Play size={13} />
                                        {runningId === w.id ? "Running…" : "Run"}
                                    </button>
                                )}
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => handleToggleStatus(w.id, w.status)}
                                >
                                    {w.status === "active" ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Activate</>}
                                </button>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDelete(w.id, w.name)}
                                >
                                    <Trash2 size={13} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── Create Modal ────────────────────────────────────────── */}
            {showCreate && (
                <div
                    className="modal-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowCreate(false);
                    }}
                >
                    <div className="modal">
                        <h2 className="modal-title">Create Workflow</h2>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="wf-name">
                                    Name *
                                </label>
                                <input
                                    id="wf-name"
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. User Onboarding Flow"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="wf-desc">
                                    Description
                                </label>
                                <textarea
                                    id="wf-desc"
                                    className="form-textarea"
                                    placeholder="Describe what this workflow does..."
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                />
                            </div>
                            <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                A minimal Start → End workflow will be created. You can edit
                                the DAG definition later.
                            </p>
                            {createError && <p className="error-text">{createError}</p>}
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setShowCreate(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={creating || !newName.trim()}
                                >
                                    {creating ? "Creating..." : <><Plus size={16} /> Create Workflow</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
