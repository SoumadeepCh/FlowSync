import type { WorkflowDefinition, ValidationResult } from "./types";

/**
 * Validates a workflow definition is a valid DAG.
 *
 * Checks:
 * 1. Exactly one "start" node exists
 * 2. At least one "end" node exists
 * 3. All edge references point to existing nodes
 * 4. No duplicate node IDs
 * 5. No duplicate edge IDs
 * 6. No cycles (using Kahn's topological sort)
 * 7. All non-start nodes are reachable from the start node
 */
export function validateDAG(definition: WorkflowDefinition): ValidationResult {
    const errors: string[] = [];
    const { nodes, edges } = definition;

    // ─── Basic structural checks ─────────────────────────────────────────

    if (!nodes || nodes.length === 0) {
        return { valid: false, errors: ["Workflow must have at least one node"] };
    }

    if (!edges) {
        return { valid: false, errors: ["Workflow must have an edges array"] };
    }

    // ─── Check for duplicate node IDs ────────────────────────────────────

    const nodeIds = new Set<string>();
    for (const node of nodes) {
        if (nodeIds.has(node.id)) {
            errors.push(`Duplicate node ID: "${node.id}"`);
        }
        nodeIds.add(node.id);
    }

    // ─── Check for duplicate edge IDs ────────────────────────────────────

    const edgeIds = new Set<string>();
    for (const edge of edges) {
        if (edgeIds.has(edge.id)) {
            errors.push(`Duplicate edge ID: "${edge.id}"`);
        }
        edgeIds.add(edge.id);
    }

    // ─── Check start/end node counts ─────────────────────────────────────

    const startNodes = nodes.filter((n) => n.type === "start");
    const endNodes = nodes.filter((n) => n.type === "end");

    if (startNodes.length === 0) {
        errors.push('Workflow must have exactly one "start" node');
    } else if (startNodes.length > 1) {
        errors.push(
            `Workflow must have exactly one "start" node, found ${startNodes.length}`
        );
    }

    if (endNodes.length === 0) {
        errors.push('Workflow must have at least one "end" node');
    }

    // ─── Validate edge references ────────────────────────────────────────

    for (const edge of edges) {
        if (!nodeIds.has(edge.source)) {
            errors.push(
                `Edge "${edge.id}" references non-existent source node: "${edge.source}"`
            );
        }
        if (!nodeIds.has(edge.target)) {
            errors.push(
                `Edge "${edge.id}" references non-existent target node: "${edge.target}"`
            );
        }
    }

    // If structural errors exist, return early before cycle detection
    if (errors.length > 0) {
        return { valid: false, errors };
    }

    // ─── Cycle detection via Kahn's algorithm (topological sort) ─────────

    // Build adjacency list and in-degree map
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
        adjacency.set(node.id, []);
        inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
        adjacency.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Start with nodes that have no incoming edges
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
            queue.push(nodeId);
        }
    }

    let processedCount = 0;
    while (queue.length > 0) {
        const current = queue.shift()!;
        processedCount++;

        for (const neighbor of adjacency.get(current)!) {
            const newDegree = inDegree.get(neighbor)! - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }

    if (processedCount !== nodes.length) {
        errors.push(
            "Workflow contains a cycle — workflows must be directed acyclic graphs (DAGs)"
        );
    }

    // ─── Reachability check ──────────────────────────────────────────────

    if (startNodes.length === 1 && errors.length === 0) {
        const reachable = new Set<string>();
        const bfsQueue = [startNodes[0].id];
        reachable.add(startNodes[0].id);

        while (bfsQueue.length > 0) {
            const current = bfsQueue.shift()!;
            for (const neighbor of adjacency.get(current) || []) {
                if (!reachable.has(neighbor)) {
                    reachable.add(neighbor);
                    bfsQueue.push(neighbor);
                }
            }
        }

        for (const node of nodes) {
            if (!reachable.has(node.id)) {
                errors.push(
                    `Node "${node.id}" (${node.label}) is not reachable from the start node`
                );
            }
        }
    }

    // ─── Phase 7: Fork / Join / Condition structural checks ─────────────

    for (const node of nodes) {
        if (node.type === "fork") {
            const outgoing = edges.filter((e) => e.source === node.id);
            if (outgoing.length < 2) {
                errors.push(
                    `Fork node "${node.id}" (${node.label}) must have at least 2 outgoing edges, found ${outgoing.length}`
                );
            }
        }

        if (node.type === "join") {
            const incoming = edges.filter((e) => e.target === node.id);
            if (incoming.length < 2) {
                errors.push(
                    `Join node "${node.id}" (${node.label}) must have at least 2 incoming edges, found ${incoming.length}`
                );
            }
        }

        if (node.type === "condition") {
            const outgoing = edges.filter((e) => e.source === node.id);
            const labeled = outgoing.filter((e) => e.conditionBranch != null);
            if (outgoing.length >= 2 && labeled.length === 0) {
                // Warning: condition has branches but no labels (still valid, backward compat)
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
