"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
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
            </div>

            <WorkflowEditor
                initialDefinition={workflow.definitionJson}
                onSave={handleSave}
                saving={saving}
            />
        </div>
    );
}
