"use client";

import { useEffect, useState, useCallback } from "react";
import {
    RefreshCw, Filter, Eye, EyeOff,
    CheckCircle2, XCircle, AlertTriangle, Zap,
    Play, RotateCcw, Inbox, Clock,
} from "lucide-react";

interface AuditEntry {
    id: string;
    event: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
    createdAt: string;
}

const EVENT_FILTERS = [
    "all",
    "execution.started",
    "execution.completed",
    "execution.failed",
    "step.retried",
    "dlq.entry",
    "trigger.fired",
] as const;

const ENTITY_FILTERS = ["all", "execution", "step", "trigger", "scheduler"] as const;

const EVENT_ICONS: Record<string, React.ReactNode> = {
    "execution.started": <Play size={11} />,
    "execution.completed": <CheckCircle2 size={11} />,
    "execution.failed": <XCircle size={11} />,
    "step.retried": <RotateCcw size={11} />,
    "dlq.entry": <Inbox size={11} />,
    "trigger.fired": <Zap size={11} />,
};

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function EventBadge({ event }: { event: string }) {
    const color = event.includes("completed")
        ? "var(--success)"
        : event.includes("failed") || event.includes("dlq")
            ? "var(--danger)"
            : event.includes("retried")
                ? "var(--warning)"
                : "var(--primary-hover)";

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.2rem 0.5rem",
                borderRadius: 6,
                fontSize: "0.75rem",
                fontWeight: 600,
                fontFamily: "var(--font-mono), monospace",
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
            }}
        >
            {EVENT_ICONS[event]}
            {event}
        </span>
    );
}

export default function AuditPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [eventFilter, setEventFilter] = useState("all");
    const [entityFilter, setEntityFilter] = useState("all");
    const [page, setPage] = useState(0);
    const [expanded, setExpanded] = useState<string | null>(null);
    const limit = 25;

    const fetchAudit = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (eventFilter !== "all") params.set("event", eventFilter);
            if (entityFilter !== "all") params.set("entityType", entityFilter);
            params.set("limit", String(limit));
            params.set("offset", String(page * limit));

            const res = await fetch(`/api/observability/audit?${params}`);
            const json = await res.json();
            if (json.success) {
                setEntries(json.data.entries);
                setTotal(json.data.total);
            }
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, [eventFilter, entityFilter, page]);

    useEffect(() => {
        fetchAudit();
    }, [fetchAudit]);

    useEffect(() => {
        const interval = setInterval(fetchAudit, 20_000);
        return () => clearInterval(interval);
    }, [fetchAudit]);

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Audit Log</h1>
                    <p className="page-subtitle">
                        System event history • {total} total entries
                    </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={fetchAudit}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                <div>
                    <label className="form-label" style={{ marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Filter size={12} /> Event Type
                    </label>
                    <div className="filter-bar">
                        {EVENT_FILTERS.map((f) => (
                            <button
                                key={f}
                                className={`filter-btn ${eventFilter === f ? "active" : ""}`}
                                onClick={() => { setEventFilter(f); setPage(0); }}
                            >
                                {f !== "all" && EVENT_ICONS[f]}
                                {f === "all" ? "All" : f.split(".").pop()}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="form-label" style={{ marginBottom: "0.25rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Filter size={12} /> Entity Type
                    </label>
                    <div className="filter-bar">
                        {ENTITY_FILTERS.map((f) => (
                            <button
                                key={f}
                                className={`filter-btn ${entityFilter === f ? "active" : ""}`}
                                onClick={() => { setEntityFilter(f); setPage(0); }}
                            >
                                {f === "all" ? "All" : f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : entries.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Clock size={48} strokeWidth={1} /></div>
                    <h3 className="empty-state-title">No Audit Entries</h3>
                    <p className="empty-state-text">
                        Audit events will appear here as system events occur.
                    </p>
                </div>
            ) : (
                <>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Event</th>
                                <th>Entity</th>
                                <th>Entity ID</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => (
                                <tr key={entry.id}>
                                    <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                                        {formatTime(entry.createdAt)}
                                    </td>
                                    <td><EventBadge event={entry.event} /></td>
                                    <td>
                                        <span className="badge badge-draft">{entry.entityType}</span>
                                    </td>
                                    <td>
                                        <code style={{ fontSize: "0.75rem", color: "var(--muted-light)" }}>
                                            {entry.entityId.slice(0, 8)}…
                                        </code>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                                        >
                                            {expanded === entry.id ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> View</>}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Expanded metadata */}
                    {expanded && (() => {
                        const entry = entries.find((e) => e.id === expanded);
                        if (!entry) return null;
                        return (
                            <div style={{
                                margin: "1rem 0",
                                padding: "1rem",
                                background: "var(--card-bg)",
                                border: "1px solid var(--card-border)",
                                borderRadius: 12,
                                fontFamily: "var(--font-mono), monospace",
                                fontSize: "0.8125rem",
                                color: "var(--muted-light)",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                            }}>
                                <div style={{ fontWeight: 700, color: "var(--foreground)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <AlertTriangle size={14} /> Metadata — {entry.event}
                                </div>
                                {JSON.stringify(entry.metadata, null, 2)}
                            </div>
                        );
                    })()}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
                            <button
                                className="btn btn-ghost btn-sm"
                                disabled={page === 0}
                                onClick={() => setPage(page - 1)}
                            >
                                ← Previous
                            </button>
                            <span style={{ padding: "0.5rem 1rem", color: "var(--muted)", fontSize: "0.875rem" }}>
                                Page {page + 1} of {totalPages}
                            </span>
                            <button
                                className="btn btn-ghost btn-sm"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(page + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
