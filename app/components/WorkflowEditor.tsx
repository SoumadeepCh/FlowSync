"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    useReactFlow,
    ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import {
    Play, Square, Zap, GitBranch, Clock, Copy, Merge,
    ArrowRightLeft, Webhook, Save, Plus, Trash2, Settings, X,
    Download, Mail,
} from "lucide-react";
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge, NodeType } from "@/lib/types";

// ─── Node Type Config ──────────────────────────────────────────────────────

const NODE_PALETTE: { type: NodeType; label: string; icon: React.ReactNode; color: string; description: string }[] = [
    { type: "start", label: "Start", icon: <Play size={14} />, color: "#34d399", description: "Entry point for your workflow. Triggers the automation sequence. Configure optional schedule hints here." },
    { type: "end", label: "End", icon: <Square size={14} />, color: "#f87171", description: "Terminates the workflow. All paths should eventually lead here to complete execution." },
    { type: "fetch_data", label: "Fetch Data", icon: <Download size={14} />, color: "#60a5fa", description: "Retrieves data from external sources like GitHub Trending, job boards, exam results, or weather APIs. Use to gather content for emails or further processing." },
    { type: "send_email", label: "Send Email", icon: <Mail size={14} />, color: "#f472b6", description: "Sends formatted emails via Gmail SMTP. Auto-renders data from Fetch nodes. Requires GMAIL_USER and GMAIL_APP_PASS in .env." },
    { type: "action", label: "Action", icon: <Zap size={14} />, color: "#818cf8", description: "Generic action node for custom operations. Use for API calls, webhooks, or custom logic in your workflow." },
    { type: "condition", label: "Condition", icon: <GitBranch size={14} />, color: "#fbbf24", description: "Branches workflow based on conditions. Creates true/false paths for decision-making logic." },
    { type: "delay", label: "Delay", icon: <Clock size={14} />, color: "#a78bfa", description: "Pauses workflow execution for a specified duration (in milliseconds). Useful for rate limiting or timed sequences." },
    { type: "fork", label: "Fork", icon: <Copy size={14} />, color: "#38bdf8", description: "Splits workflow into parallel branches. All branches execute simultaneously for concurrent processing." },
    { type: "join", label: "Join", icon: <Merge size={14} />, color: "#2dd4bf", description: "Merges parallel branches back into a single path. Waits for all incoming branches to complete before continuing." },
    { type: "transform", label: "Transform", icon: <ArrowRightLeft size={14} />, color: "#fb923c", description: "Modifies or reformats data between nodes. Use to clean, filter, or reshape data before passing to the next step." },
    { type: "webhook_response", label: "Webhook Resp", icon: <Webhook size={14} />, color: "#e879f9", description: "Returns a response to webhook triggers. Use when your workflow is triggered by external HTTP requests." },
];

const getNodeColor = (type: string) =>
    NODE_PALETTE.find((n) => n.type === type)?.color || "#818cf8";

// ─── Custom Node Component ─────────────────────────────────────────────────

// start nodes: only source (outgoing). end nodes: only target (incoming).
// all other nodes: both handles.
function CustomNode({ data }: { data: { label: string; nodeType: string; selected?: boolean } }) {
    const color = getNodeColor(data.nodeType);
    const entry = NODE_PALETTE.find((n) => n.type === data.nodeType);
    const isStart = data.nodeType === "start";
    const isEnd = data.nodeType === "end";

    return (
        <>
            {/* Incoming handle — hidden for start nodes */}
            {!isStart && (
                <Handle
                    type="target"
                    position={Position.Top}
                    style={{ background: color, width: 8, height: 8 }}
                />
            )}
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
                    position: "relative",
                }}
                data-tooltip={entry?.description}
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
            {/* Outgoing handle — hidden for end nodes */}
            {!isEnd && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    style={{ background: color, width: 8, height: 8 }}
                />
            )}
        </>
    );
}

const nodeTypes: NodeTypes = {
    custom: CustomNode,
};

// ─── Edge Context Menu ─────────────────────────────────────────────────────

interface EdgeMenuState {
    edgeId: string;
    x: number;
    y: number;
}


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

function WorkflowEditorContent({
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
    const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState | null>(null);
    const [draggingNode, setDraggingNode] = useState<NodeType | null>(null);
    const nodeCounter = useRef(initialDefinition.nodes.length);
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

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

    // ── Drag and Drop Handlers ─────────────────────────────────────────────
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            const type = event.dataTransfer.getData("application/reactflow");
            if (!type || !reactFlowWrapper.current) return;

            const bounds = reactFlowWrapper.current.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            const y = event.clientY - bounds.top;

            nodeCounter.current++;
            const label = NODE_PALETTE.find((n) => n.type === type)?.label || type;
            const id = `${type}_${nodeCounter.current}`;

            const newNode: Node = {
                id,
                type: "custom",
                position: { x, y },
                data: { label: `${label} ${nodeCounter.current}`, nodeType: type, config: {} },
            };

            setNodes((nds) => [...nds, newNode]);
            toast.success(`${label} node added via drag-and-drop`);
        },
        [setNodes]
    );

    const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
        event.dataTransfer.setData("application/reactflow", nodeType);
        event.dataTransfer.effectAllowed = "move";
        setDraggingNode(nodeType);
    };

    const onDragEnd = () => {
        setDraggingNode(null);
    };

    // ── Keyboard delete for selected node ───────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === "Delete" || e.key === "Backspace") &&
                !(e.target instanceof HTMLInputElement) &&
                !(e.target instanceof HTMLTextAreaElement)) {
                if (selectedNode) {
                    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                    setEdges((eds) =>
                        eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
                    );
                    toast.success(`"${String(selectedNode.data.label)}" deleted`);
                    setSelectedNode(null);
                }
            }
            if (e.key === "Escape") setEdgeMenu(null);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedNode, setNodes, setEdges]);

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

    // ── Right-click on edge → show context menu ──────────────────────────
    const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
        e.preventDefault();
        setEdgeMenu({ edgeId: edge.id, x: e.clientX, y: e.clientY });
    }, []);

    const deleteEdge = useCallback((edgeId: string) => {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        setEdgeMenu(null);
        toast.success("Connection removed");
    }, [setEdges]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setEdgeMenu(null);
        setSelectedNode(node);
        setEditLabel(String(node.data.label || ""));
    }, []);

    // Close edge menu on canvas click
    const onPaneClick = useCallback(() => {
        setEdgeMenu(null);
        setSelectedNode(null);
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

    /** Update a config key on the selected node and sync selectedNode state */
    const updateNodeConfig = useCallback((key: string, value: unknown) => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((n) =>
                n.id === selectedNode.id
                    ? { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, unknown> || {}), [key]: value } } }
                    : n
            )
        );
        setSelectedNode((prev) =>
            prev ? { ...prev, data: { ...prev.data, config: { ...(prev.data.config as Record<string, unknown> || {}), [key]: value } } } : prev
        );
    }, [selectedNode, setNodes]);

    // Shared style tokens for config panel
    const inputStyle: React.CSSProperties = {
        padding: "0.375rem 0.625rem",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid #2a2a3f",
        borderRadius: 6,
        color: "#e8e8ed",
        fontSize: "0.8rem",
        outline: "none",
        width: "100%",
        boxSizing: "border-box" as const,
        fontFamily: "inherit",
        cursor: "pointer",
    };

    const selectStyle: React.CSSProperties = {
        ...inputStyle,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.5rem center",
        backgroundSize: "1rem",
        paddingRight: "2rem",
    };
    const btnGreen: React.CSSProperties = { flex: 1, padding: "0.375rem", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 6, color: "#34d399", fontSize: "0.75rem", cursor: "pointer" };
    const btnRed: React.CSSProperties = { padding: "0.375rem 0.625rem", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#ef4444", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" };
    const sectionLabel: React.CSSProperties = { fontSize: "0.6875rem", color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "0.25rem" };

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
                    <div
                        key={entry.type}
                        data-tooltip={entry.description}
                        data-tooltip-side="left"
                        style={{ position: "relative" }}
                    >
                        <button
                            draggable
                            onClick={() => addNode(entry.type)}
                            onDragStart={(e) => onDragStart(e, entry.type)}
                            onDragEnd={onDragEnd}
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
                                cursor: draggingNode === entry.type ? "grabbing" : "pointer",
                                transition: "all 0.2s",
                                width: "100%",
                                opacity: draggingNode === entry.type ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => {
                                (e.currentTarget).style.borderColor = entry.color;
                                (e.currentTarget).style.background = `${entry.color}11`;
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget).style.borderColor = `${entry.color}33`;
                                (e.currentTarget).style.background = "rgba(255,255,255,0.03)";
                            }}
                        >
                            <span style={{ color: entry.color, display: "flex" }}>{entry.icon}</span>
                            <Plus size={10} style={{ color: "#6b7280" }} />
                            {entry.label}
                        </button>
                    </div>
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
                            Type: <span style={{ color: getNodeColor(String(selectedNode.data.nodeType)) }}>{String(selectedNode.data.nodeType)}</span>
                        </div>
                        {/* Node description */}
                        <div style={{
                            fontSize: "0.7rem",
                            color: "#60a5fa",
                            background: "rgba(96,165,250,0.08)",
                            border: "1px solid rgba(96,165,250,0.2)",
                            borderRadius: 6,
                            padding: "0.5rem 0.6rem",
                            lineHeight: 1.5,
                            marginTop: "0.5rem",
                        }}>
                            {NODE_PALETTE.find(n => n.type === selectedNode.data.nodeType)?.description || "Custom node for workflow operations."}
                        </div>
                        {/* Label editor */}
                        <input type="text" value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && updateNodeLabel()}
                            placeholder="Node label" style={inputStyle} />
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                            <button onClick={updateNodeLabel} style={btnGreen}>Rename</button>
                            <button onClick={deleteSelected} style={btnRed}><Trash2 size={11} /> Delete</button>
                        </div>

                        {/* ── send_email config ── */}
                        {String(selectedNode.data.nodeType) === "send_email" && (
                            <>
                                <div style={sectionLabel}>Email Settings</div>
                                <div style={{ fontSize: "0.7rem", color: "#4ade80", background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, padding: "0.35rem 0.6rem", lineHeight: 1.5 }}>
                                    📧 Email goes to <strong>your Clerk account email</strong> automatically.
                                </div>
                                <input type="text" placeholder="Subject" style={inputStyle}
                                    value={String((selectedNode.data.config as Record<string, unknown>)?.subject || "")}
                                    onChange={(e) => updateNodeConfig("subject", e.target.value)} />
                                <textarea placeholder="Body template (optional — leave blank to auto-render data from Fetch nodes)" style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                                    value={String((selectedNode.data.config as Record<string, unknown>)?.bodyTemplate || "")}
                                    onChange={(e) => updateNodeConfig("bodyTemplate", e.target.value)} />
                                <div style={{ fontSize: "0.65rem", color: "#4b5563", lineHeight: 1.5 }}>
                                    ⚠️ Needs GMAIL_USER + GMAIL_APP_PASS in .env
                                </div>
                            </>
                        )}

                        {/* ── fetch_data config ── */}
                        {String(selectedNode.data.nodeType) === "fetch_data" && (
                            <>
                                <div style={sectionLabel}>Data Source</div>
                                <select style={selectStyle}
                                    value={String((selectedNode.data.config as Record<string, unknown>)?.source || "")}
                                    onChange={(e) => updateNodeConfig("source", e.target.value)}>
                                    <option value="">Select a source…</option>
                                    <option value="github_trending">💙 GitHub Trending</option>
                                    <option value="swe_jobs">💼 SWE Jobs</option>
                                    <option value="ssc_exams">📋 Sarkari / Govt Exams</option>
                                    <option value="social_ideas">💡 Social Post Ideas</option>
                                    <option value="weather">🌤️ Weather Report</option>
                                </select>

                                {String((selectedNode.data.config as Record<string, unknown>)?.source) === "github_trending" && (<>
                                    <input type="text" placeholder="Language filter (blank = all)" style={inputStyle}
                                        value={String((selectedNode.data.config as Record<string, unknown>)?.language || "")}
                                        onChange={(e) => updateNodeConfig("language", e.target.value)} />
                                    <select style={selectStyle}
                                        value={String((selectedNode.data.config as Record<string, unknown>)?.since || "daily")}
                                        onChange={(e) => updateNodeConfig("since", e.target.value)}>
                                        <option value="daily">Today</option>
                                        <option value="weekly">This Week</option>
                                        <option value="monthly">This Month</option>
                                    </select>
                                </>)}

                                {String((selectedNode.data.config as Record<string, unknown>)?.source) === "swe_jobs" && (<>
                                    <input type="text" placeholder="Keywords (e.g. backend developer)" style={inputStyle}
                                        value={String((selectedNode.data.config as Record<string, unknown>)?.keywords || "")}
                                        onChange={(e) => updateNodeConfig("keywords", e.target.value)} />
                                    <select style={selectStyle}
                                        value={String((selectedNode.data.config as Record<string, unknown>)?.source_api || "both")}
                                        onChange={(e) => updateNodeConfig("source_api", e.target.value)}>
                                        <option value="both">All Sources</option>
                                        <option value="remotive">Remotive (Remote)</option>
                                        <option value="arbeitnow">Arbeitnow (Global)</option>
                                    </select>
                                </>)}

                                {String((selectedNode.data.config as Record<string, unknown>)?.source) === "ssc_exams" && (
                                    <select style={selectStyle}
                                        value={String((selectedNode.data.config as Record<string, unknown>)?.category || "all")}
                                        onChange={(e) => updateNodeConfig("category", e.target.value)}>
                                        <option value="all">All Notifications</option>
                                        <option value="ssc">SSC</option>
                                        <option value="upsc">UPSC</option>
                                        <option value="banking">Banking</option>
                                        <option value="railway">Railway</option>
                                        <option value="state">State PSC</option>
                                    </select>
                                )}

                                {String((selectedNode.data.config as Record<string, unknown>)?.source) === "social_ideas" && (
                                    <select style={selectStyle}
                                        value={String((selectedNode.data.config as Record<string, unknown>)?.tag || "webdev")}
                                        onChange={(e) => updateNodeConfig("tag", e.target.value)}>
                                        <option value="webdev">Web Dev</option>
                                        <option value="programming">Programming</option>
                                        <option value="javascript">JavaScript</option>
                                        <option value="python">Python</option>
                                        <option value="career">Career Tips</option>
                                        <option value="opensource">Open Source</option>
                                        <option value="ai">AI / ML</option>
                                    </select>
                                )}

                                {String((selectedNode.data.config as Record<string, unknown>)?.source) === "weather" && (<>
                                    <input type="text" placeholder="City (e.g. Kolkata, Mumbai, London)" style={inputStyle}
                                        value={String((selectedNode.data.config as Record<string, unknown>)?.city || "")}
                                        onChange={(e) => updateNodeConfig("city", e.target.value)} />
                                    <select style={selectStyle}
                                        value={String((selectedNode.data.config as Record<string, unknown>)?.units || "celsius")}
                                        onChange={(e) => updateNodeConfig("units", e.target.value)}>
                                        <option value="celsius">Celsius (°C)</option>
                                        <option value="fahrenheit">Fahrenheit (°F)</option>
                                    </select>
                                    <input type="number" placeholder="Forecast days (1–7)" style={inputStyle} min={1} max={7}
                                        value={Number((selectedNode.data.config as Record<string, unknown>)?.days) || 3}
                                        onChange={(e) => updateNodeConfig("days", Number(e.target.value))} />
                                </>)}

                                {String((selectedNode.data.config as Record<string, unknown>)?.source) !== "weather" && (
                                    <input type="number" placeholder="Max results (default 10)" style={inputStyle} min={1} max={25}
                                        value={Number((selectedNode.data.config as Record<string, unknown>)?.limit) || 10}
                                        onChange={(e) => updateNodeConfig("limit", Number(e.target.value))} />
                                )}
                            </>
                        )}

                        {/* ── start node schedule config ── */}
                        {String(selectedNode.data.nodeType) === "start" && (
                            <>
                                <div style={sectionLabel}>Schedule (optional hint)</div>
                                <div style={{ fontSize: "0.68rem", color: "#6b7280", lineHeight: 1.5, marginBottom: "0.25rem" }}>
                                    Set preferred schedule for this workflow. Use in Triggers page to create the CRON.
                                </div>
                                <select style={selectStyle}
                                    value={String((selectedNode.data.config as Record<string, unknown>)?.frequency || "daily")}
                                    onChange={(e) => updateNodeConfig("frequency", e.target.value)}>
                                    <option value="daily">Every day</option>
                                    <option value="weekday">Every weekday (Mon–Fri)</option>
                                    <option value="weekly">Every Monday</option>
                                    <option value="hourly">Every hour</option>
                                </select>
                                <select style={selectStyle}
                                    value={Number((selectedNode.data.config as Record<string, unknown>)?.hour ?? 7)}
                                    onChange={(e) => updateNodeConfig("hour", Number(e.target.value))}>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <option key={i} value={i}>
                                            {`${i.toString().padStart(2, "0")}:00`}
                                        </option>
                                    ))}
                                </select>
                                <select style={selectStyle}
                                    value={String((selectedNode.data.config as Record<string, unknown>)?.timezone || "Asia/Kolkata")}
                                    onChange={(e) => updateNodeConfig("timezone", e.target.value)}>
                                    <option value="Asia/Kolkata">IST (India)</option>
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">EST/EDT (New York)</option>
                                    <option value="America/Los_Angeles">PST/PDT (Los Angeles)</option>
                                    <option value="Europe/London">GMT/BST (London)</option>
                                    <option value="Europe/Berlin">CET/CEST (Berlin)</option>
                                    <option value="Asia/Tokyo">JST (Tokyo)</option>
                                    <option value="Asia/Singapore">SGT (Singapore)</option>
                                </select>
                            </>
                        )}

                        {/* ── delay config ── */}
                        {String(selectedNode.data.nodeType) === "delay" && (
                            <>
                                <div style={sectionLabel}>Delay Settings</div>
                                <input type="number" placeholder="Delay in ms (e.g. 5000)" style={inputStyle} min={0}
                                    value={Number((selectedNode.data.config as Record<string, unknown>)?.delayMs) || ""}
                                    onChange={(e) => updateNodeConfig("delayMs", Number(e.target.value))} />
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Canvas */}
            <div ref={reactFlowWrapper} style={{ flex: 1, position: "relative" }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    onEdgeContextMenu={onEdgeContextMenu}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
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

                {/* Edge right-click context menu */}
                {edgeMenu && (
                    <div
                        style={{
                            position: "fixed",
                            top: edgeMenu.y,
                            left: edgeMenu.x,
                            zIndex: 1000,
                            background: "#12121a",
                            border: "1px solid #2a2a3f",
                            borderRadius: 8,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                            overflow: "hidden",
                            minWidth: 160,
                        }}
                    >
                        <div style={{
                            padding: "0.4rem 0.75rem",
                            fontSize: "0.6875rem",
                            color: "#6b7280",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            borderBottom: "1px solid #1e1e2e",
                        }}>
                            Connection
                        </div>
                        <button
                            onClick={() => deleteEdge(edgeMenu.edgeId)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                width: "100%",
                                padding: "0.5rem 0.75rem",
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                fontSize: "0.8125rem",
                                cursor: "pointer",
                                textAlign: "left",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                            <X size={13} /> Remove Connection
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function WorkflowEditor(props: WorkflowEditorProps) {
    return (
        <ReactFlowProvider>
            <WorkflowEditorContent {...props} />
        </ReactFlowProvider>
    );
}
