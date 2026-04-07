"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import type { WorkflowDefinition } from "@/lib/types";

// Lazy-load the editor to avoid SSR issues with ReactFlow
const WorkflowEditor = dynamic(
    () => import("@/app/components/WorkflowEditor"),
    {
        ssr: false, loading: () => (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)" }}>
                <div className="spinner" />
            </div>
        )
    }
);

interface WorkflowData {
    id: string;
    name: string;
    version: number;
    definitionJson: WorkflowDefinition;
}

export default function WorkflowEditorPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);

    const fetchWorkflow = useCallback(async () => {
        try {
            const res = await fetch(`/api/workflows/${id}`);
            const data = await res.json();
            if (data.success) {
                setWorkflow(data.data);
            } else {
                toast.error("Workflow not found");
                router.push("/dashboard");
            }
        } catch {
            toast.error("Failed to load workflow");
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useEffect(() => {
        fetchWorkflow();
    }, [fetchWorkflow]);

    const handleSave = useCallback(
        async (definition: WorkflowDefinition) => {
            setSaving(true);
            try {
                const res = await fetch(`/api/workflows/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ definitionJson: definition }),
                });
                const data = await res.json();
                if (data.success) {
                    toast.success("Workflow saved — version bumped to v" + data.data.version);
                    setWorkflow(data.data);
                } else {
                    toast.error(data.error || "Save failed");
                }
            } catch {
                toast.error("Connection error while saving");
            } finally {
                setSaving(false);
            }
        },
        [id]
    );

    const handleRunNow = useCallback(async () => {
        if (!workflow) return;
        setRunning(true);
        const toastId = toast.loading("⚙️ Running workflow…");
        try {
            // First, make sure the workflow is active so the executor accepts it
            const activateRes = await fetch(`/api/workflows/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "active" }),
            });
            const activateData = await activateRes.json();
            if (!activateData.success) {
                toast.error(activateData.error || "Failed to activate workflow", { id: toastId });
                return;
            }

            // Then trigger execution
            const execRes = await fetch("/api/executions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflowId: id }),
            });
            const execData = await execRes.json();
            if (execData.success) {
                toast.success("✅ Workflow completed! Redirecting to execution…", { id: toastId });
                router.push(`/executions/${execData.data.id}`);
            } else {
                toast.error(execData.error || "Execution failed", { id: toastId });
            }
        } catch {
            toast.error("Connection error while running workflow", { id: toastId });
        } finally {
            setRunning(false);
        }
    }, [id, workflow, router]);

    if (loading || !workflow) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 64px)" }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div>
            {/* Compact header bar over the editor */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    padding: "0.5rem 1rem",
                    background: "#0a0a12",
                    borderBottom: "1px solid #1e1e2e",
                    fontSize: "0.875rem",
                }}
            >
                <Link
                    href="/dashboard"
                    style={{
                        color: "#6b7280",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                    }}
                >
                    <ArrowLeft size={14} /> Dashboard
                </Link>
                <span style={{ color: "#2a2a3a" }}>|</span>
                <span style={{ color: "#e8e8ed", fontWeight: 600 }}>{workflow.name}</span>
                <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>v{workflow.version}</span>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Dev test: Run Now button */}
                <button
                    onClick={handleRunNow}
                    disabled={running || saving}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.375rem 0.875rem",
                        background: running ? "#1a2a1a" : "linear-gradient(135deg, #22c55e, #16a34a)",
                        color: running ? "#4ade80" : "#fff",
                        border: "1px solid #16a34a",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: running ? "not-allowed" : "pointer",
                        transition: "opacity 0.2s",
                        opacity: running ? 0.7 : 1,
                    }}
                    title="Manually trigger this workflow right now (activates it if draft)"
                >
                    {running
                        ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
                        : <><Play size={13} /> Run Now</>}
                </button>
            </div>

            <WorkflowEditor
                initialDefinition={workflow.definitionJson}
                onSave={handleSave}
                saving={saving}
            />
        </div>
    );
}
