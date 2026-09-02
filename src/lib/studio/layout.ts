import type { AirGraph } from "./air";

const COL = 300;
const ROW = 150;

/**
 * Deterministic layered auto-layout (cycle breaking → longest-path layering →
 * barycentre ordering). Beautification never changes topology — only positions.
 *
 * Cycles are common in architecture graphs (a response flowing back to the
 * caller), so back-edges are detected with a DFS in declared edge order and
 * ignored for layering; they still render, just as return paths.
 */
export function autoLayout(graph: AirGraph): AirGraph {
  const outgoing = new Map<string, { id: string; target: string }[]>();
  const incoming = new Map<string, string[]>();
  for (const n of graph.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of graph.edges) {
    if (e.source_node_id === e.target_node_id) continue;
    if (!outgoing.has(e.source_node_id) || !incoming.has(e.target_node_id)) continue;
    outgoing.get(e.source_node_id)!.push({ id: e.id, target: e.target_node_id });
    incoming.get(e.target_node_id)!.push(e.source_node_id);
  }

  // 1. Break cycles: DFS from roots (then any unvisited node) in declared order.
  const roots = graph.nodes.filter((n) => (incoming.get(n.id)?.length ?? 0) === 0).map((n) => n.id);
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
  for (const n of graph.nodes) if (!state.get(n.id)) visit(n.id, 0);

  // 2. Longest-path layering on the DAG (Kahn order over forward edges).
  const forwardIn = new Map<string, number>();
  const forwardParents = new Map<string, string[]>();
  for (const n of graph.nodes) {
    forwardIn.set(n.id, 0);
    forwardParents.set(n.id, []);
  }
  for (const [source, list] of outgoing) {
    for (const e of list) {
      if (backEdges.has(e.id)) continue;
      forwardIn.set(e.target, (forwardIn.get(e.target) ?? 0) + 1);
      forwardParents.get(e.target)!.push(source);
    }
  }
  const layer = new Map<string, number>();
  const queue = graph.nodes.filter((n) => forwardIn.get(n.id) === 0).map((n) => n.id);
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
  for (const n of graph.nodes) if (!layer.has(n.id)) layer.set(n.id, 0);

  // 3. Barycentre ordering within each column, using all parents (including back-edges' sources once placed).
  const columns = new Map<number, string[]>();
  for (const n of graph.nodes) {
    const l = layer.get(n.id) ?? 0;
    columns.set(l, [...(columns.get(l) ?? []), n.id]);
  }
  const y = new Map<string, number>();
  const sortedLayers = [...columns.keys()].sort((a, b) => a - b);
  for (const l of sortedLayers) {
    const ids = columns.get(l)!;
    const bary = (id: string) => {
      const parents = forwardParents.get(id) ?? [];
      const values = parents.map((p) => y.get(p)).filter((v): v is number => v !== undefined);
      return values.length
        ? values.reduce((s, v) => s + v, 0) / values.length
        : Number.MAX_SAFE_INTEGER;
    };
    ids.sort((a, b) => {
      const d = bary(a) - bary(b);
      return d !== 0 ? d : a.localeCompare(b);
    });
    const offset = -((ids.length - 1) * ROW) / 2;
    ids.forEach((id, i) => y.set(id, offset + i * ROW));
  }

  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      position: { x: (layer.get(n.id) ?? 0) * COL, y: y.get(n.id) ?? 0 },
    })),
  };
}
