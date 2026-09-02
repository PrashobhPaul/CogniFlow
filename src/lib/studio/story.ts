import type { AirGraph } from "./air";

/**
 * Rule-based story model. Orders connectors the way a reader follows a request:
 * depth-first from root components (no incoming edges) in declared edge order,
 * then any remaining connectors (back-edges, cycles, disconnected clusters).
 * Deterministic: the same graph always yields the same numbering and narration.
 */

export interface StoryStep {
  index: number; // 1-based
  edge_id: string;
  source_id: string;
  target_id: string;
  title: string;
  detail: string;
  narration: string;
}

const VERB: Record<string, string> = {
  request: "sends a request to",
  response: "returns a response to",
  data: "passes data to",
  event: "emits an event to",
  stream: "streams to",
  retrieval: "retrieves from",
  embedding: "sends embeddings to",
  message: "exchanges messages with",
  file: "transfers files to",
  control: "hands control to",
  error: "reports an error to",
  retry: "retries against",
};

export function buildStory(graph: AirGraph): StoryStep[] {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const motionById = new Map(graph.motion.map((m) => [m.edge_id, m]));
  const outgoing = new Map<string, typeof graph.edges>();
  for (const e of graph.edges) {
    outgoing.set(e.source_node_id, [...(outgoing.get(e.source_node_id) ?? []), e]);
  }
  const hasIncoming = new Set(graph.edges.map((e) => e.target_node_id));
  const roots = graph.nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
  const start = roots.length ? roots : graph.nodes.slice(0, 1).map((n) => n.id);

  const order: string[] = [];
  const numbered = new Set<string>();
  const visited = new Set<string>();

  const walk = (id: string, depth: number) => {
    if (depth > 500) return;
    visited.add(id);
    for (const e of outgoing.get(id) ?? []) {
      if (numbered.has(e.id)) continue;
      numbered.add(e.id);
      order.push(e.id);
      if (!visited.has(e.target_node_id)) walk(e.target_node_id, depth + 1);
    }
  };
  for (const r of start) if (!visited.has(r)) walk(r, 0);
  for (const n of graph.nodes) if (!visited.has(n.id)) walk(n.id, 0);
  for (const e of graph.edges) if (!numbered.has(e.id)) order.push(e.id);

  const edgeById = new Map(graph.edges.map((e) => [e.id, e]));
  return order.map((edgeId, i) => {
    const e = edgeById.get(edgeId)!;
    const s = nodeById.get(e.source_node_id);
    const t = nodeById.get(e.target_node_id);
    const sLabel = s?.label ?? e.source_node_id;
    const tLabel = t?.label ?? e.target_node_id;
    const motion = motionById.get(e.id);
    const dir = e.direction === "bidirectional" ? "⇄" : e.direction === "reverse" ? "←" : "→";
    const parts = [e.semantic_type, e.protocol, e.execution_mode];
    if (e.payload_type) parts.push(e.payload_type);
    if (motion) parts.push(`${motion.grammar} motion`);
    const label = e.label ? ` (${e.label})` : "";
    const verb = VERB[e.semantic_type] ?? "connects to";
    const narration =
      e.direction === "bidirectional"
        ? `${sLabel} and ${tLabel} exchange ${e.semantic_type} traffic over ${e.protocol}${label}.`
        : e.direction === "reverse"
          ? `${tLabel} ${verb} ${sLabel} over ${e.protocol}${label}.`
          : `${sLabel} ${verb} ${tLabel} over ${e.protocol}${label}.`;
    return {
      index: i + 1,
      edge_id: e.id,
      source_id: e.source_node_id,
      target_id: e.target_node_id,
      title: `${sLabel} ${dir} ${tLabel}`,
      detail: parts.join(" · "),
      narration,
    };
  });
}
