import { z } from "zod";

/**
 * AIR — Architecture Intermediate Representation.
 * Canonical source of truth: Graph + VisualModel + MotionModel + StoryModel.
 * Architecture is data, never an image.
 */

export const RENDERER_VERSION = "1.0.0";
export const MOTION_ENGINE_VERSION = "1.0.0";
export const AIR_VERSION = 1;

export const semanticTypeSchema = z.enum([
  "request",
  "response",
  "data",
  "event",
  "stream",
  "retrieval",
  "embedding",
  "message",
  "file",
  "control",
  "error",
  "retry",
]);

export const directionSchema = z.enum(["forward", "reverse", "bidirectional"]);
export const executionModeSchema = z.enum(["synchronous", "asynchronous", "streaming", "batch"]);
export const grammarSchema = z.enum(["packet", "stream", "dense", "pulse", "batch"]);
export const nodeStatusSchema = z.enum(["auto", "idle", "executing", "success", "retry", "error"]);
export const edgePathTypeSchema = z.enum(["smoothstep", "bezier", "straight"]);

export const airNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  subtitle: z.string().optional(),
  component_type: z.string().min(1),
  category: z.string().min(1),
  icon: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }),
  group_id: z.string().nullable().optional(),
  /** Optional body: a few bullet lines shown under the label (container nodes). */
  details: z.array(z.string().min(1)).max(6).optional(),
  /** Declared runtime state; omitted means "auto" (derived from connectors). */
  status: nodeStatusSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const airEdgeSchema = z.object({
  id: z.string().min(1),
  source_node_id: z.string().min(1),
  target_node_id: z.string().min(1),
  source_port_id: z.string().optional(),
  target_port_id: z.string().optional(),
  direction: directionSchema,
  semantic_type: semanticTypeSchema,
  protocol: z.string().min(1),
  execution_mode: executionModeSchema,
  payload_type: z.string().optional(),
  label: z.string().optional(),
  /** Connector routing; omitted means smoothstep (the historical default). */
  path_type: edgePathTypeSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const motionEventSchema = z.object({
  edge_id: z.string().min(1),
  grammar: grammarSchema,
  speed: z.number().positive(),
  density: z.number().int().positive(),
  size: z.number().positive(),
  enabled: z.boolean(),
});

/** A titled lane/container drawn behind the nodes whose group_id matches its id. */
export const airGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Accent hex (#rrggbb); omitted falls back to a themed default. */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const airGraphSchema = z.object({
  air_version: z.literal(AIR_VERSION),
  nodes: z.array(airNodeSchema),
  edges: z.array(airEdgeSchema),
  motion: z.array(motionEventSchema),
  /** Optional lane definitions; a node joins one via its group_id. */
  groups: z.array(airGroupSchema).optional(),
});

export type AirNode = z.infer<typeof airNodeSchema>;
export type AirEdge = z.infer<typeof airEdgeSchema>;
export type AirGroup = z.infer<typeof airGroupSchema>;
export type MotionEvent = z.infer<typeof motionEventSchema>;
export type AirGraph = z.infer<typeof airGraphSchema>;

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  ref?: string;
}

/**
 * Hard invariant: every motion event must reference a validated edge id.
 * Export MUST fail when this is violated.
 */
export function validateGraph(graph: AirGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parsed = airGraphSchema.safeParse(graph);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        level: "error",
        code: "schema",
        message: issue.message,
        ref: issue.path.join("."),
      });
    }
    return issues;
  }

  const nodeIds = new Set<string>();
  for (const n of graph.nodes) {
    if (nodeIds.has(n.id)) {
      issues.push({
        level: "error",
        code: "duplicate_node_id",
        message: `Duplicate node id ${n.id}`,
        ref: n.id,
      });
    }
    nodeIds.add(n.id);
  }

  const edgeIds = new Set<string>();
  for (const e of graph.edges) {
    if (edgeIds.has(e.id)) {
      issues.push({
        level: "error",
        code: "duplicate_edge_id",
        message: `Duplicate edge id ${e.id}`,
        ref: e.id,
      });
    }
    edgeIds.add(e.id);
    if (!nodeIds.has(e.source_node_id)) {
      issues.push({
        level: "error",
        code: "dangling_edge_source",
        message: `Edge ${e.id} references missing source ${e.source_node_id}`,
        ref: e.id,
      });
    }
    if (!nodeIds.has(e.target_node_id)) {
      issues.push({
        level: "error",
        code: "dangling_edge_target",
        message: `Edge ${e.id} references missing target ${e.target_node_id}`,
        ref: e.id,
      });
    }
    if (e.semantic_type === "stream" && e.execution_mode !== "streaming") {
      issues.push({
        level: "warning",
        code: "stream_execution_mode",
        message: `Edge ${e.id} is a stream but execution mode is ${e.execution_mode}`,
        ref: e.id,
      });
    }
  }

  for (const m of graph.motion) {
    if (!edgeIds.has(m.edge_id)) {
      issues.push({
        level: "error",
        code: "phantom_motion",
        message: `Motion event references unknown edge ${m.edge_id}. No graph edge → no animated flow.`,
        ref: m.edge_id,
      });
    }
  }

  for (const n of graph.nodes) {
    const connected = graph.edges.some(
      (e) => e.source_node_id === n.id || e.target_node_id === n.id,
    );
    if (!connected) {
      issues.push({
        level: "warning",
        code: "orphan_node",
        message: `${n.label} has no declared connectors, so nothing can flow through it.`,
        ref: n.id,
      });
    }
  }

  return issues;
}

export function isExportable(issues: ValidationIssue[]) {
  return !issues.some((i) => i.level === "error");
}

/** Deterministic, stable content hash of the canonical graph (FNV-1a, hex). */
export function graphHash(graph: AirGraph): string {
  const canonical = JSON.stringify({
    air_version: graph.air_version,
    nodes: [...graph.nodes]
      .map((n) => ({ ...n, metadata: undefined }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...graph.edges]
      .map((e) => ({ ...e, metadata: undefined }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    motion: [...graph.motion].sort((a, b) => a.edge_id.localeCompare(b.edge_id)),
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
