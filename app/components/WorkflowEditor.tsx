"use client";

import { useCallback, useRef, useState } from "react";
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type Connection,
    type NodeTypes,
    Handle,
    Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import {
    Play, Square, Zap, GitBranch, Clock, Copy, Merge,
    ArrowRightLeft, Webhook, Save, Plus, Trash2, Settings,
} from "lucide-react";
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge, NodeType } from "@/lib/types";

// ─── Node Type Config ──────────────────────────────────────────────────────

const NODE_PALETTE: { type: NodeType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: "start", label: "Start", icon: <Play size={14} />, color: "#34d399" },
    { type: "end", label: "End", icon: <Square size={14} />, color: "#f87171" },
    { type: "action", label: "Action", icon: <Zap size={14} />, color: "#818cf8" },
    { type: "condition", label: "Condition", icon: <GitBranch size={14} />, color: "#fbbf24" },
    { type: "delay", label: "Delay", icon: <Clock size={14} />, color: "#a78bfa" },
    { type: "fork", label: "Fork", icon: <Copy size={14} />, color: "#38bdf8" },
    { type: "join", label: "Join", icon: <Merge size={14} />, color: "#2dd4bf" },
    { type: "transform", label: "Transform", icon: <ArrowRightLeft size={14} />, color: "#fb923c" },
    { type: "webhook_response", label: "Webhook Resp", icon: <Webhook size={14} />, color: "#e879f9" },
];

const getNodeColor = (type: string) =>
    NODE_PALETTE.find((n) => n.type === type)?.color || "#818cf8";

// ─── Custom Node Component ─────────────────────────────────────────────────

function CustomNode({ data }: { data: { label: string; nodeType: string; selected?: boolean } }) {
    const color = getNodeColor(data.nodeType);
    const entry = NODE_PALETTE.find((n) => n.type === data.nodeType);

    return (
        <>
            <Handle type="target" position={Position.Top} style={{ background: color, width: 8, height: 8 }} />
            <div
                style={{
                    background: "#12121a",
                    border: `2px solid ${data.selected ? "#fff" : color}`,
                    borderRadius: 12,
                    padding: "10px 16px",
                    minWidth: 140,
                    color: "#e8e8ed",
                    fontSize: "0.8125rem",
                    fontFamily: "inherit",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    boxShadow: `0 0 12px ${color}22`,
                    cursor: "grab",
                }}
            >
                <span style={{ color, display: "flex", alignItems: "center" }}>{entry?.icon}</span>
                <span style={{ fontWeight: 600 }}>{data.label}</span>
                <span style={{
                    fontSize: "0.625rem",
                    color: "#6b7280",
                    marginLeft: "auto",
                    textTransform: "uppercase",
                }}>
                    {data.nodeType}
                </span>
            </div>
            <Handle type="source" position={Position.Bottom} style={{ background: color, width: 8, height: 8 }} />
        </>
    );
}

const nodeTypes: NodeTypes = {
    custom: CustomNode,
};

// ─── Convert between FlowSync format and ReactFlow format ──────────────────

function toReactFlowNodes(nodes: WorkflowNode[]): Node[] {
    return nodes.map((n, i) => ({
        id: n.id,
        type: "custom",
        position: n.position || { x: 250, y: i * 120 },
        data: { label: n.label, nodeType: n.type, config: n.config },
    }));
}

function toReactFlowEdges(edges: WorkflowEdge[]): Edge[] {
    return edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: "#4b5563", strokeWidth: 2 },
        label: e.conditionBranch || undefined,
        labelStyle: { fill: "#9ca3af", fontSize: 11 },
    }));
}

function toWorkflowDefinition(nodes: Node[], edges: Edge[]): WorkflowDefinition {
    return {
        nodes: nodes.map((n) => ({
            id: n.id,
            type: (n.data.nodeType || "action") as NodeType,
            label: String(n.data.label || ""),
            config: (n.data.config as Record<string, unknown>) || {},
            position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        })),
        edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
        })),
    };
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface WorkflowEditorProps {
    initialDefinition: WorkflowDefinition;
    onSave: (definition: WorkflowDefinition) => Promise<void>;
    saving?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function WorkflowEditor({
    initialDefinition,
    onSave,
    saving = false,
}: WorkflowEditorProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(
        toReactFlowNodes(initialDefinition.nodes)
    );
    const [edges, setEdges, onEdgesChange] = useEdgesState(
        toReactFlowEdges(initialDefinition.edges)
    );
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const nodeCounter = useRef(initialDefinition.nodes.length);

    const onConnect = useCallback(
        (connection: Connection) => {
            setEdges((eds) =>
                addEdge(
                    {
                        ...connection,
                        id: `e-${Date.now()}`,
                        animated: true,
                        style: { stroke: "#4b5563", strokeWidth: 2 },
                    },
                    eds
                )
            );
        },
        [setEdges]
    );

    const addNode = useCallback(
        (type: NodeType) => {
            nodeCounter.current++;
            const label = NODE_PALETTE.find((n) => n.type === type)?.label || type;
            const id = `${type}_${nodeCounter.current}`;

            const newNode: Node = {
                id,
                type: "custom",
                position: { x: 250 + Math.random() * 100, y: 100 + nodes.length * 80 },
                data: { label: `${label} ${nodeCounter.current}`, nodeType: type, config: {} },
            };

            setNodes((nds) => [...nds, newNode]);
            toast.success(`${label} node added`);
        },
        [nodes.length, setNodes]
    );

    const deleteSelected = useCallback(() => {
        if (!selectedNode) return;
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setEdges((eds) =>
            eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
        );
        toast.success("Node removed");
        setSelectedNode(null);
    }, [selectedNode, setNodes, setEdges]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        setEditLabel(String(node.data.label || ""));
    }, []);

    const updateNodeLabel = useCallback(() => {
        if (!selectedNode || !editLabel.trim()) return;
        setNodes((nds) =>
            nds.map((n) =>
                n.id === selectedNode.id
                    ? { ...n, data: { ...n.data, label: editLabel.trim() } }
                    : n
            )
        );
        toast.success("Label updated");
    }, [selectedNode, editLabel, setNodes]);

    const handleSave = useCallback(async () => {
        const definition = toWorkflowDefinition(nodes, edges);
        await onSave(definition);
    }, [nodes, edges, onSave]);

    return (
        <div style={{ display: "flex", height: "calc(100vh - 64px)" }}>
            {/* Sidebar — Node Palette */}
            <div
                style={{
                    width: 220,
                    background: "#0a0a12",
                    borderRight: "1px solid #1e1e2e",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    overflowY: "auto",
                }}
            >
                <div style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                    Add Nodes
                </div>
                {NODE_PALETTE.map((entry) => (
                    <button
                        key={entry.type}
                        onClick={() => addNode(entry.type)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${entry.color}33`,
                            borderRadius: 8,
                            color: "#e8e8ed",
                            fontSize: "0.8125rem",
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.borderColor = entry.color;
                            (e.target as HTMLElement).style.background = `${entry.color}11`;
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.borderColor = `${entry.color}33`;
                            (e.target as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                        }}
                    >
                        <span style={{ color: entry.color, display: "flex" }}>{entry.icon}</span>
                        <Plus size={10} style={{ color: "#6b7280" }} />
                        {entry.label}
                    </button>
                ))}

                {/* Divider */}
                <div style={{ borderTop: "1px solid #1e1e2e", margin: "0.5rem 0" }} />

                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        padding: "0.625rem",
                        background: "rgba(99,102,241,0.15)",
                        border: "1px solid rgba(99,102,241,0.3)",
                        borderRadius: 8,
                        color: "#818cf8",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        cursor: saving ? "wait" : "pointer",
                        opacity: saving ? 0.6 : 1,
                    }}
                >
                    <Save size={14} />
                    {saving ? "Saving…" : "Save Workflow"}
                </button>

                {/* Selected Node Config */}
                {selectedNode && (
                    <>
                        <div style={{ borderTop: "1px solid #1e1e2e", margin: "0.5rem 0" }} />
                        <div style={{ fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <Settings size={11} /> Node Config
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                            Type: {String(selectedNode.data.nodeType)}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                            ID: <code style={{ fontSize: "0.6875rem" }}>{selectedNode.id}</code>
                        </div>
                        <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && updateNodeLabel()}
                            placeholder="Node label"
                            style={{
                                padding: "0.375rem 0.625rem",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid #1e1e2e",
                                borderRadius: 6,
                                color: "#e8e8ed",
                                fontSize: "0.8125rem",
                                outline: "none",
                            }}
                        />
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                            <button
                                onClick={updateNodeLabel}
                                style={{
                                    flex: 1,
                                    padding: "0.375rem",
                                    background: "rgba(52,211,153,0.1)",
                                    border: "1px solid rgba(52,211,153,0.2)",
                                    borderRadius: 6,
                                    color: "#34d399",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                }}
                            >
                                Rename
                            </button>
                            <button
                                onClick={deleteSelected}
                                style={{
                                    padding: "0.375rem 0.625rem",
                                    background: "rgba(239,68,68,0.1)",
                                    border: "1px solid rgba(239,68,68,0.2)",
                                    borderRadius: 6,
                                    color: "#ef4444",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                }}
                            >
                                <Trash2 size={11} /> Delete
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Canvas */}
            <div style={{ flex: 1 }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    fitView
                    proOptions={{ hideAttribution: true }}
                    style={{ background: "#08080f" }}
                    defaultEdgeOptions={{
                        animated: true,
                        style: { stroke: "#4b5563", strokeWidth: 2 },
                    }}
                >
                    <Background color="#1e1e2e" gap={20} size={1} />
                    <Controls
                        style={{
                            background: "#12121a",
                            border: "1px solid #1e1e2e",
                            borderRadius: 8,
                        }}
                    />
                    <MiniMap
                        style={{
                            background: "#0a0a12",
                            border: "1px solid #1e1e2e",
                            borderRadius: 8,
                        }}
                        nodeColor={(node) => getNodeColor(String(node.data.nodeType))}
                        maskColor="rgba(0,0,0,0.7)"
                    />
                </ReactFlow>
            </div>
        </div>
    );
}
