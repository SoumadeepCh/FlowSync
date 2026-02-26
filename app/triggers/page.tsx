"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
    Plus, Trash2, ToggleLeft, ToggleRight,
    Copy, Check, Zap, Link as LinkIcon,
} from "lucide-react";

interface Workflow {
    id: string;
    name: string;
    status: string;
}

interface Trigger {
    id: string;
    workflowId: string;
    type: string;
    config: Record<string, unknown>;
    enabled: boolean;
    lastFiredAt: string | null;
    createdAt: string;
    workflow: { id: string; name: string; status: string };
}

export default function TriggersPage() {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ workflowId: "", type: "webhook" });
    const [creating, setCreating] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchTriggers = useCallback(async () => {
        try {
            const res = await fetch("/api/triggers");
            const data = await res.json();
            if (data.success) setTriggers(data.data);
        } catch {
            toast.error("Failed to fetch triggers");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchWorkflows = useCallback(async () => {
        try {
            const res = await fetch("/api/workflows?status=active");
            const data = await res.json();
            if (data.success) setWorkflows(data.data);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        fetchTriggers();
        fetchWorkflows();
    }, [fetchTriggers, fetchWorkflows]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createForm.workflowId) return;
        setCreating(true);
        try {
            const res = await fetch("/api/triggers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(createForm),
            });
            const data = await res.json();
            if (data.success) {
                setShowCreate(false);
                setCreateForm({ workflowId: "", type: "webhook" });
                fetchTriggers();
                toast.success("Trigger created", {
                    description: `${createForm.type} trigger added successfully`,
                });
            } else {
                toast.error(data.error || "Failed to create trigger");
            }
        } catch {
            toast.error("Connection error");
        } finally {
            setCreating(false);
        }
    };

    const handleToggle = async (id: string, currentEnabled: boolean) => {
        try {
            const res = await fetch(`/api/triggers/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: !currentEnabled }),
            });
            const data = await res.json();
            if (data.success) {
                fetchTriggers();
                toast.success(
                    currentEnabled ? "Trigger disabled" : "Trigger enabled",
                    { description: `Trigger is now ${currentEnabled ? "paused" : "active"}` }
                );
            }
        } catch {
            toast.error("Failed to toggle trigger");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this trigger?")) return;
        try {
            const res = await fetch(`/api/triggers/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                fetchTriggers();
                toast.success("Trigger deleted");
            } else {
                toast.error(data.error || "Failed to delete");
            }
        } catch {
            toast.error("Connection error");
        }
    };

    const copyWebhookUrl = (trigger: Trigger) => {
        const url = `${window.location.origin}/api/webhooks/${trigger.id}`;
        navigator.clipboard.writeText(url);
        setCopiedId(trigger.id);
        toast.success("Webhook URL copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatTime = (iso: string) =>
        new Date(iso).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    return (
        <div className="container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Triggers</h1>
                    <p className="page-subtitle">Manage event-driven workflow triggers</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus size={16} /> New Trigger
                </button>
            </div>

            {loading ? (
                <div className="loading-center">
                    <div className="spinner" />
                </div>
            ) : triggers.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Zap size={48} strokeWidth={1} /></div>
                    <h3 className="empty-state-title">No triggers yet</h3>
                    <p className="empty-state-text">
                        Create a trigger to automatically start workflows from external events.
                    </p>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> Create First Trigger
                    </button>
                </div>
            ) : (
                <div className="workflow-grid">
                    {triggers.map((trigger) => (
                        <div key={trigger.id} className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">{trigger.workflow.name}</div>
                                    <div className="card-description" style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                        <span className={`badge badge-${trigger.type}`}>
                                            {trigger.type === "webhook" ? <><LinkIcon size={10} /> webhook</> : trigger.type}
                                        </span>
                                        <span className={`badge ${trigger.enabled ? "badge-active" : "badge-draft"}`}>
                                            {trigger.enabled ? "enabled" : "disabled"}
                                        </span>
                                    </div>
                                </div>
                                <div className="card-actions">
                                    <button
                                        className={`btn btn-sm ${trigger.enabled ? "btn-ghost" : "btn-success"}`}
                                        onClick={() => handleToggle(trigger.id, trigger.enabled)}
                                        title={trigger.enabled ? "Disable" : "Enable"}
                                    >
                                        {trigger.enabled ? <><ToggleRight size={14} /> Disable</> : <><ToggleLeft size={14} /> Enable</>}
                                    </button>
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => handleDelete(trigger.id)}
                                        title="Delete"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            {trigger.type === "webhook" && (
                                <div className="webhook-url">
                                    <span style={{ flex: 1 }}>
                                        {typeof window !== "undefined"
                                            ? `${window.location.origin}/api/webhooks/${trigger.id}`
                                            : `/api/webhooks/${trigger.id}`}
                                    </span>
                                    <button
                                        className="copy-btn"
                                        onClick={() => copyWebhookUrl(trigger)}
                                    >
                                        {copiedId === trigger.id ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                                    </button>
                                </div>
                            )}

                            <div className="card-meta">
                                <span>Created {formatTime(trigger.createdAt)}</span>
                                {trigger.lastFiredAt && (
                                    <span>Last fired {formatTime(trigger.lastFiredAt)}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="modal-title">
                            <Zap size={18} style={{ display: "inline", marginRight: 8 }} />
                            Create Trigger
                        </h2>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="form-label">Workflow</label>
                                <select
                                    className="form-select"
                                    value={createForm.workflowId}
                                    onChange={(e) =>
                                        setCreateForm({ ...createForm, workflowId: e.target.value })
                                    }
                                    required
                                >
                                    <option value="">Select a workflow…</option>
                                    {workflows.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.name}
                                        </option>
                                    ))}
                                </select>
                                {workflows.length === 0 && (
                                    <p className="error-text">
                                        No active workflows. Activate a workflow first.
                                    </p>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Trigger Type</label>
                                <select
                                    className="form-select"
                                    value={createForm.type}
                                    onChange={(e) =>
                                        setCreateForm({ ...createForm, type: e.target.value })
                                    }
                                >
                                    <option value="webhook">Webhook</option>
                                    <option value="manual">Manual</option>
                                </select>
                            </div>
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
                                    disabled={creating || !createForm.workflowId}
                                >
                                    {creating ? "Creating…" : <><Plus size={16} /> Create Trigger</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
