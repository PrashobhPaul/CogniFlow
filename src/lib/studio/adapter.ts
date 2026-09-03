import { AIR_VERSION, type AirEdge, type AirGraph, type AirNode } from "./air";
import type { ArchNode, FlowEdge } from "./store-types";
import { GRAMMAR_PRESETS, type FlowEdgeData, type NodeCategory } from "./types";

/** Canvas state → canonical AIR graph. */
export function toAir(nodes: ArchNode[], edges: FlowEdge[]): AirGraph {
  const airNodes: AirNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.data.label,
    subtitle: n.data.subtitle,
    component_type: (n.data.componentType as string) ?? "generic",
    category: n.data.category,
    icon: n.data.icon,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    group_id: null,
    // "auto" is the default, so only a declared state is written to the graph.
    ...(n.data.status && n.data.status !== "auto" ? { status: n.data.status } : {}),
  }));

  const airEdges: AirEdge[] = edges.map((e) => {
    const d = e.data as FlowEdgeData;
    return {
      id: e.id,
      source_node_id: e.source,
      target_node_id: e.target,
      direction: d.direction,
      semantic_type: d.semanticType,
      protocol: d.protocol,
      execution_mode: d.executionMode ?? "synchronous",
      payload_type: d.payloadType,
      label: d.label,
      ...(d.pathType && d.pathType !== "smoothstep" ? { path_type: d.pathType } : {}),
    };
  });

  return {
    air_version: AIR_VERSION,
    nodes: airNodes,
    edges: airEdges,
    motion: edges.map((e) => {
      const d = e.data as FlowEdgeData;
      return {
        edge_id: e.id,
        grammar: d.grammar,
        speed: d.speed,
        density: d.density,
        size: d.size,
        enabled: d.enabled,
      };
    }),
  };
}

/** Canonical AIR graph → canvas state. */
export function fromAir(graph: AirGraph): { nodes: ArchNode[]; edges: FlowEdge[] } {
  const nodes: ArchNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: "arch",
    position: { ...n.position },
    data: {
      label: n.label,
      subtitle: n.subtitle,
      category: n.category as NodeCategory,
      icon: n.icon,
      componentType: n.component_type,
      status: n.status ?? "auto",
    },
  }));

  const edges: FlowEdge[] = graph.edges.map((e) => {
    const motion = graph.motion.find((m) => m.edge_id === e.id);
    const grammar = motion?.grammar ?? "packet";
    const preset = GRAMMAR_PRESETS[grammar];
    return {
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      type: "flow",
      data: {
        semanticType: e.semantic_type,
        protocol: e.protocol,
        direction: e.direction,
        executionMode: e.execution_mode,
        payloadType: e.payload_type,
        grammar,
        speed: motion?.speed ?? preset.speed,
        density: motion?.density ?? preset.density,
        size: motion?.size ?? preset.size,
        label: e.label,
        enabled: motion?.enabled ?? true,
        pathType: e.path_type ?? "smoothstep",
      } satisfies FlowEdgeData,
    };
  });

  return { nodes, edges };
}
