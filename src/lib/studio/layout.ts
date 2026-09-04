import type { AirEdge, AirGraph } from "./air";

const COL = 300;
const ROW = 150;
// Vertical breathing room between stacked lanes: enough for the next lane's
// group header + padding (see scene.ts GROUP) plus a nominal node height.
const LANE_NODE_H = 110;
const LANE_SEP = 34 + 22 * 2 + 40;

/**
 * Deterministic layered positions (cycle breaking → longest-path layering →
 * barycentre ordering) for a set of nodes and the edges among them. Result is
 * normalised so the top-left of the block sits at (0, 0). Topology is never
 * changed — only positions.
 *
 * Cycles are common in architecture graphs (a response flowing back to the
 * caller), so back-edges are detected with a DFS in declared order and ignored
 * for layering; they still render, just as return paths.
 */
function layeredPositions(
  nodeIds: string[],
  edges: AirEdge[],
): Map<string, { x: number; y: number }> {
  const ids = new Set(nodeIds);
  const outgoing = new Map<string, { id: string; target: string }[]>();
  const incoming = new Map<string, string[]>();
  for (const id of nodeIds) {
    outgoing.set(id, []);
    incoming.set(id, []);
  }
  for (const e of edges) {
    if (e.source_node_id === e.target_node_id) continue;
    if (!ids.has(e.source_node_id) || !ids.has(e.target_node_id)) continue;
    outgoing.get(e.source_node_id)!.push({ id: e.id, target: e.target_node_id });
    incoming.get(e.target_node_id)!.push(e.source_node_id);
  }

  // 1. Break cycles: DFS from roots (then any unvisited node) in declared order.
  const roots = nodeIds.filter((id) => (incoming.get(id)?.length ?? 0) === 0);
  const state = new Map<string, 0 | 1 | 2>();
  const backEdges = new Set<string>();
  const visit = (id: string, depth: number) => {
    if (depth > 5000) return;
    state.set(id, 1);
    for (const e of outgoing.get(id) ?? []) {
      const s = state.get(e.target) ?? 0;
      if (s === 1) backEdges.add(e.id);
      else if (s === 0) visit(e.target, depth + 1);
    }
    state.set(id, 2);
  };
  for (const r of roots) if (!state.get(r)) visit(r, 0);
  for (const id of nodeIds) if (!state.get(id)) visit(id, 0);

  // 2. Longest-path layering on the DAG (Kahn order over forward edges).
  const forwardIn = new Map<string, number>();
  const forwardParents = new Map<string, string[]>();
  for (const id of nodeIds) {
    forwardIn.set(id, 0);
    forwardParents.set(id, []);
  }
  for (const [source, list] of outgoing) {
    for (const e of list) {
      if (backEdges.has(e.id)) continue;
      forwardIn.set(e.target, (forwardIn.get(e.target) ?? 0) + 1);
      forwardParents.get(e.target)!.push(source);
    }
  }
  const layer = new Map<string, number>();
  const queue = nodeIds.filter((id) => forwardIn.get(id) === 0);
  for (const id of queue) layer.set(id, 0);
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++]!;
    const base = layer.get(id) ?? 0;
    for (const e of outgoing.get(id) ?? []) {
      if (backEdges.has(e.id)) continue;
      layer.set(e.target, Math.max(layer.get(e.target) ?? 0, base + 1));
      const remaining = (forwardIn.get(e.target) ?? 1) - 1;
      forwardIn.set(e.target, remaining);
      if (remaining === 0) queue.push(e.target);
    }
  }
  for (const id of nodeIds) if (!layer.has(id)) layer.set(id, 0);

  // 3. Barycentre ordering within each column.
  const columns = new Map<number, string[]>();
  for (const id of nodeIds) {
    const l = layer.get(id) ?? 0;
    columns.set(l, [...(columns.get(l) ?? []), id]);
  }
  const y = new Map<string, number>();
  const sortedLayers = [...columns.keys()].sort((a, b) => a - b);
  for (const l of sortedLayers) {
    const colIds = columns.get(l)!;
    const bary = (id: string) => {
      const parents = forwardParents.get(id) ?? [];
      const values = parents.map((p) => y.get(p)).filter((v): v is number => v !== undefined);
      return values.length
        ? values.reduce((s, v) => s + v, 0) / values.length
        : Number.MAX_SAFE_INTEGER;
    };
    colIds.sort((a, b) => {
      const d = bary(a) - bary(b);
      return d !== 0 ? d : a.localeCompare(b);
    });
    colIds.forEach((id, i) => y.set(id, i * ROW));
  }

  // Normalise to a (0,0) top-left so callers can place the block anywhere.
  let minY = Infinity;
  const pos = new Map<string, { x: number; y: number }>();
  for (const id of nodeIds) {
    const py = y.get(id) ?? 0;
    minY = Math.min(minY, py);
  }
  if (!Number.isFinite(minY)) minY = 0;
  for (const id of nodeIds)
    pos.set(id, { x: (layer.get(id) ?? 0) * COL, y: (y.get(id) ?? 0) - minY });
  return pos;
}

/** Lay each declared lane out on its own and stack the lanes vertically. */
function layoutGrouped(graph: AirGraph): AirGraph {
  const laneOrder = graph.groups ?? [];
  const membersByGroup = new Map<string, string[]>();
  for (const g of laneOrder) membersByGroup.set(g.id, []);
  const ungrouped: string[] = [];
  for (const n of graph.nodes) {
    if (n.group_id && membersByGroup.has(n.group_id)) membersByGroup.get(n.group_id)!.push(n.id);
    else ungrouped.push(n.id);
  }
  const lanes = [
    ...laneOrder.map((g) => membersByGroup.get(g.id)!),
    ...(ungrouped.length ? [ungrouped] : []),
  ].filter((ids) => ids.length);

  const pos = new Map<string, { x: number; y: number }>();
  let bandTop = 0;
  for (const laneIds of lanes) {
    const laneSet = new Set(laneIds);
    const laneEdges = graph.edges.filter(
      (e) => laneSet.has(e.source_node_id) && laneSet.has(e.target_node_id),
    );
    const local = layeredPositions(laneIds, laneEdges);
    let maxY = 0;
    for (const id of laneIds) {
      const p = local.get(id)!;
      pos.set(id, { x: p.x, y: p.y + bandTop });
      maxY = Math.max(maxY, p.y);
    }
    bandTop += maxY + LANE_NODE_H + LANE_SEP;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? { x: 0, y: 0 } })),
  };
}

/**
 * Beautify an AIR graph's node positions. When the graph declares lanes
 * (`groups` + node `group_id`), each lane is laid out and stacked so the
 * containers don't overlap; otherwise the whole graph is laid out as one block.
 */
export function autoLayout(graph: AirGraph): AirGraph {
  if (graph.groups && graph.groups.length && graph.nodes.some((n) => n.group_id)) {
    return layoutGrouped(graph);
  }
  const pos = layeredPositions(
    graph.nodes.map((n) => n.id),
    graph.edges,
  );
  // Preserve the historical centred-on-zero vertical placement for ungrouped graphs.
  const ys = graph.nodes.map((n) => pos.get(n.id)?.y ?? 0);
  const mid = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const p = pos.get(n.id) ?? { x: 0, y: 0 };
      return { ...n, position: { x: p.x, y: p.y - mid } };
    }),
  };
}
