"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
    Plus, Trash2, ToggleLeft, ToggleRight,
    Copy, Check, Zap, Link as LinkIcon, Clock,
} from "lucide-react";

// ─── CRON Builder Helpers ────────────────────────────────────────────────────

const TIMEZONES = [
    { value: "Asia/Kolkata",      label: "IST — India (UTC+5:30)" },
    { value: "UTC",               label: "UTC" },
    { value: "America/New_York",  label: "EST/EDT — New York (UTC-5/-4)" },
    { value: "America/Los_Angeles", label: "PST/PDT — LA (UTC-8/-7)" },
    { value: "Europe/London",     label: "GMT/BST — London (UTC+0/+1)" },
    { value: "Europe/Berlin",     label: "CET/CEST — Berlin (UTC+1/+2)" },
    { value: "Asia/Tokyo",        label: "JST — Tokyo (UTC+9)" },
    { value: "Asia/Singapore",    label: "SGT — Singapore (UTC+8)" },
    { value: "Australia/Sydney",  label: "AEST — Sydney (UTC+10/+11)" },
];

// Timezone offset from UTC in minutes (approximate, ignoring DST)
const TZ_OFFSET_MINUTES: Record<string, number> = {
    "Asia/Kolkata":       330,
    "UTC":                0,
    "America/New_York":   -300,
    "America/Los_Angeles":-480,
    "Europe/London":      0,
    "Europe/Berlin":      60,
    "Asia/Tokyo":         540,
    "Asia/Singapore":     480,
    "Australia/Sydney":   600,
};

const HOURS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${i.toString().padStart(2, "0")}:00 — ${i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`}`,
}));

const FREQUENCIES = [
    { value: "daily",   label: "Every day" },
    { value: "weekday", label: "Every weekday (Mon–Fri)" },
    { value: "weekly",  label: "Every week (Monday)" },
    { value: "hourly",  label: "Every hour" },
    { value: "custom",  label: "Custom CRON expression" },
];

function buildCronExpression(frequency: string, hour: number, tz: string): string {
    // Convert local hour → UTC hour
    const offsetMin = TZ_OFFSET_MINUTES[tz] ?? 0;
    const utcHour = ((hour * 60 - offsetMin) / 60 + 24) % 24;
    const h = Math.round(utcHour) % 24;

    switch (frequency) {
        case "daily":   return `0 ${h} * * *`;
        case "weekday": return `0 ${h} * * 1-5`;
        case "weekly":  return `0 ${h} * * 1`;
        case "hourly":  return `0 * * * *`;
        default:        return `0 ${h} * * *`;
    }
}

function describeCron(expression: string, tz: string): string {
    const parts = expression.trim().split(/\s+/);
    if (parts.length !== 5) return expression;
    const [, hour, , , dow] = parts;
    const tzLabel = TIMEZONES.find(t => t.value === tz)?.label.split("—")[0].trim() || tz;

    if (hour === "*") return `Every hour`;
    const utcH = parseInt(hour, 10);
    const offsetMin = TZ_OFFSET_MINUTES[tz] ?? 0;
    const localH = (utcH + offsetMin / 60 + 24) % 24;
    const localHLabel = `${Math.round(localH).toString().padStart(2, "0")}:00`;

    if (dow === "1-5") return `Every weekday at ${localHLabel} ${tzLabel}`;
    if (dow === "1")   return `Every Monday at ${localHLabel} ${tzLabel}`;
    return `Every day at ${localHLabel} ${tzLabel}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Workflow { id: string; name: string; status: string; }
interface Trigger {
    id: string; workflowId: string; type: string;
    config: Record<string, unknown>; enabled: boolean;
    lastFiredAt: string | null; createdAt: string;
    workflow: { id: string; name: string; status: string };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TriggersPage() {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // CRON builder state
    const [form, setForm] = useState({
        workflowId: "",
        type: "webhook" as string,
        frequency: "daily",
        hour: 8,
        timezone: "Asia/Kolkata",
        customExpr: "0 2 * * *",
    });

    const cronExpression = form.frequency === "custom"
        ? form.customExpr
        : form.frequency === "hourly"
            ? "0 * * * *"
            : buildCronExpression(form.frequency, form.hour, form.timezone);

    const fetchTriggers = useCallback(async () => {
        try {
            const res = await fetch("/api/triggers");
            const data = await res.json();
            if (data.success) setTriggers(data.data);
        } catch { toast.error("Failed to fetch triggers"); }
        finally { setLoading(false); }
    }, []);

    const fetchWorkflows = useCallback(async () => {
        try {
            const res = await fetch("/api/workflows?status=active");
            const data = await res.json();
            if (data.success) setWorkflows(data.data);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchTriggers(); fetchWorkflows(); }, [fetchTriggers, fetchWorkflows]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.workflowId) return;
        setCreating(true);
        try {
            const config = form.type === "cron"
                ? { expression: cronExpression, timezone: form.timezone, humanLabel: describeCron(cronExpression, form.timezone) }
                : {};
            const res = await fetch("/api/triggers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflowId: form.workflowId, type: form.type, config }),
            });
            const data = await res.json();
            if (data.success) {
                setShowCreate(false);
                setForm({ workflowId: "", type: "webhook", frequency: "daily", hour: 8, timezone: "Asia/Kolkata", customExpr: "0 2 * * *" });
                fetchTriggers();
                toast.success("Trigger created!", { description: describeCron(cronExpression, form.timezone) });
            } else {
                toast.error(data.error || "Failed to create trigger");
            }
        } catch { toast.error("Connection error"); }
        finally { setCreating(false); }
    };

    const handleToggle = async (id: string, currentEnabled: boolean) => {
        try {
            const res = await fetch(`/api/triggers/${id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: !currentEnabled }),
            });
            const data = await res.json();
            if (data.success) {
                fetchTriggers();
                toast.success(currentEnabled ? "Trigger disabled" : "Trigger enabled");
            }
        } catch { toast.error("Failed to toggle trigger"); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this trigger?")) return;
        try {
            const res = await fetch(`/api/triggers/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) { fetchTriggers(); toast.success("Trigger deleted"); }
            else toast.error(data.error || "Failed to delete");
        } catch { toast.error("Connection error"); }
    };

    const copyWebhookUrl = (trigger: Trigger) => {
        const url = `${window.location.origin}/api/webhooks/${trigger.id}`;
        navigator.clipboard.writeText(url);
        setCopiedId(trigger.id);
        toast.success("Webhook URL copied");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const inputSt: React.CSSProperties = {
        width: "100%", padding: "0.45rem 0.7rem", background: "rgba(255,255,255,0.04)",
        border: "1px solid #2a2a3f", borderRadius: 7, color: "#e8e8ed",
        fontSize: "0.85rem", boxSizing: "border-box", fontFamily: "inherit",
    };

    const selectSt: React.CSSProperties = {
        ...inputSt,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.5rem center",
        backgroundSize: "1rem",
        paddingRight: "2rem",
        cursor: "pointer",
    };

    return (
        <div className="container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Triggers</h1>
                    <p className="page-subtitle">Automate workflows with schedules, webhooks, and events</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus size={16} /> New Trigger
                </button>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : triggers.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Zap size={48} strokeWidth={1} /></div>
                    <h3 className="empty-state-title">No triggers yet</h3>
                    <p className="empty-state-text">Create a trigger to automatically start workflows on a schedule or via HTTP.</p>
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={16} /> Create First Trigger
                    </button>
                </div>
            ) : (
                <div className="workflow-grid">
                    {triggers.map((trigger) => {
                        const tz = (trigger.config?.timezone as string) || "UTC";
                        const humanLabel = (trigger.config?.humanLabel as string)
                            || (trigger.config?.expression
                                ? describeCron(trigger.config.expression as string, tz)
                                : trigger.type);
                        return (
                            <div key={trigger.id} className="card">
                                <div className="card-header">
                                    <div>
                                        <div className="card-title">{trigger.workflow.name}</div>
                                        <div className="card-description" style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                                            <span className={`badge badge-${trigger.type}`}>
                                                {trigger.type === "webhook" ? <><LinkIcon size={10} /> webhook</> : trigger.type === "cron" ? <><Clock size={10} /> cron</> : trigger.type}
                                            </span>
                                            <span className={`badge ${trigger.enabled ? "badge-active" : "badge-draft"}`}>
                                                {trigger.enabled ? "enabled" : "disabled"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="card-actions">
                                        <button className={`btn btn-sm ${trigger.enabled ? "btn-ghost" : "btn-success"}`}
                                            onClick={() => handleToggle(trigger.id, trigger.enabled)}
                                            title={trigger.enabled ? "Disable" : "Enable"}>
                                            {trigger.enabled ? <><ToggleRight size={14} /> Disable</> : <><ToggleLeft size={14} /> Enable</>}
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(trigger.id)}>
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {trigger.type === "webhook" && (
                                    <div className="webhook-url">
                                        <span style={{ flex: 1 }}>
                                            {typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/${trigger.id}` : `/api/webhooks/${trigger.id}`}
                                        </span>
                                        <button className="copy-btn" onClick={() => copyWebhookUrl(trigger)}>
                                            {copiedId === trigger.id ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                                        </button>
                                    </div>
                                )}

                                {trigger.type === "cron" && (
                                    <div className="webhook-url" style={{ flexDirection: "column", gap: "0.25rem" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <Clock size={12} style={{ color: "#a78bfa", flexShrink: 0 }} />
                                            <span style={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.8rem" }}>{humanLabel}</span>
                                        </div>
                                        <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#4b5563" }}>
                                            {trigger.config?.expression as string}
                                            {trigger.config?.timezone ? ` (${trigger.config.timezone})` : ""}
                                        </div>
                                        {trigger.lastFiredAt && (
                                            <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>Last fired: {fmt(trigger.lastFiredAt)}</span>
                                        )}
                                    </div>
                                )}

                                <div className="card-meta">
                                    <span>Created {fmt(trigger.createdAt)}</span>
                                    {trigger.lastFiredAt && <span>Last fired {fmt(trigger.lastFiredAt)}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Create Modal ─────────────────────────────────────────────── */}
            {showCreate && (
                <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <h2 className="modal-title">
                            <Zap size={18} style={{ display: "inline", marginRight: 8 }} />
                            Create Trigger
                        </h2>
                        <form onSubmit={handleCreate}>

                            {/* Workflow selector */}
                            <div className="form-group">
                                <label className="form-label">Workflow</label>
                                <select style={selectSt} value={form.workflowId}
                                    onChange={(e) => setForm({ ...form, workflowId: e.target.value })} required>
                                    <option value="">Select a workflow…</option>
                                    {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                {workflows.length === 0 && (
                                    <p className="error-text">No active workflows found. Activate one first.</p>
                                )}
                            </div>

                            {/* Trigger type */}
                            <div className="form-group">
                                <label className="form-label">Trigger Type</label>
                                <select style={selectSt} value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value })}>
                                    <option value="webhook">🌐 Webhook (HTTP push)</option>
                                    <option value="manual">🖱️ Manual (API call)</option>
                                    <option value="cron">⏰ Schedule (CRON)</option>
                                </select>
                            </div>

                            {/* ── CRON builder ── */}
                            {form.type === "cron" && (
                                <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                    <div style={{ fontSize: "0.7rem", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>
                                        ⏰ Schedule Builder
                                    </div>

                                    {/* Frequency */}
                                    <div>
                                        <label style={{ fontSize: "0.75rem", color: "#9ca3af", display: "block", marginBottom: "0.3rem" }}>Frequency</label>
                                        <select style={selectSt} value={form.frequency}
                                            onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                                            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                    </div>

                                    {/* Hour picker — hidden for hourly/custom */}
                                    {form.frequency !== "hourly" && form.frequency !== "custom" && (
                                        <div>
                                            <label style={{ fontSize: "0.75rem", color: "#9ca3af", display: "block", marginBottom: "0.3rem" }}>Time of Day</label>
                                            <select style={selectSt} value={form.hour}
                                                onChange={(e) => setForm({ ...form, hour: Number(e.target.value) })}>
                                                {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {/* Timezone — hidden for hourly/custom */}
                                    {form.frequency !== "hourly" && form.frequency !== "custom" && (
                                        <div>
                                            <label style={{ fontSize: "0.75rem", color: "#9ca3af", display: "block", marginBottom: "0.3rem" }}>Your Timezone</label>
                                            <select style={selectSt} value={form.timezone}
                                                onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                                                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {/* Custom expr */}
                                    {form.frequency === "custom" && (
                                        <div>
                                            <label style={{ fontSize: "0.75rem", color: "#9ca3af", display: "block", marginBottom: "0.3rem" }}>
                                                CRON Expression <span style={{ color: "#6b7280" }}>(UTC, 5 fields)</span>
                                            </label>
                                            <input type="text" style={{ ...inputSt, fontFamily: "monospace" }}
                                                value={form.customExpr}
                                                onChange={(e) => setForm({ ...form, customExpr: e.target.value })}
                                                placeholder="min hour day month weekday" />
                                        </div>
                                    )}

                                    {/* Preview */}
                                    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "0.5rem 0.75rem", fontSize: "0.78rem" }}>
                                        <span style={{ color: "#6b7280" }}>Preview: </span>
                                        <span style={{ color: "#a78bfa", fontWeight: 600 }}>{describeCron(cronExpression, form.timezone)}</span>
                                        <br />
                                        <span style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#4b5563" }}>
                                            CRON (UTC): {cronExpression}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="modal-actions" style={{ marginTop: "1rem" }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={creating || !form.workflowId}>
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
