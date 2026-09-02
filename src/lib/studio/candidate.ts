import { z } from "zod";
import { AIR_VERSION, type AirGraph } from "./air";
import { autoLayout } from "./layout";
import {
  categoryForType,
  defaultExecutionMode,
  defaultGrammar,
  defaultProtocol,
  guessComponent,
  iconForType,
} from "./classify";
import { GRAMMAR_PRESETS, type NodeCategory } from "./types";

/**
 * Candidate graph: the untrusted, un-laid-out proposal every entry path
 * produces (rule-based compiler, model output, image reconstruction). It is
 * schema-validated, normalised deterministically and laid out before it can
 * become an AIR graph — the same post-processor regardless of who proposed it.
 */

export const SEMANTICS = [
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
] as const;

export const candidateSchema = z.object({
  title: z.string().max(120).optional(),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().min(1).max(80),
        subtitle: z.string().max(80).optional(),
        component_type: z.string().max(40).optional(),
        category: z.string().max(40).optional(),
      }),
    )
    .max(80),
  edges: z
    .array(
      z.object({
        id: z.string().min(1).max(64).optional(),
        source_node_id: z.string().min(1),
        target_node_id: z.string().min(1),
        label: z.string().max(80).optional(),
        protocol: z.string().max(40).optional(),
        semantic_type: z.string().optional(),
        direction: z.string().optional(),
        execution_mode: z.string().optional(),
        payload_type: z.string().max(60).optional(),
      }),
    )
    .max(200),
  warnings: z.array(z.string().max(300)).max(40).default([]),
});

export type Candidate = z.infer<typeof candidateSchema>;

const CATEGORIES: NodeCategory[] = [
  "ai",
  "data",
  "integration",
  "security",
  "application",
  "cloud",
  "devops",
];

const slug = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "node";

export interface CandidateResult {
  graph: AirGraph;
  warnings: string[];
  title: string | undefined;
}

export function candidateToGraph(
  candidate: Candidate,
  opts: { layout?: boolean } = {},
): CandidateResult {
  const warnings = [...candidate.warnings];
  const idMap = new Map<string, string>();
  const used = new Set<string>();
  const nodes: AirGraph["nodes"] = [];

  for (const n of candidate.nodes) {
    let id = slug(n.id);
    while (used.has(id)) id = `${id}_${used.size}`;
    used.add(id);
    idMap.set(n.id, id);
    idMap.set(n.id.toLowerCase(), id);
    const guess = guessComponent(`${n.label} ${n.subtitle ?? ""} ${n.component_type ?? ""}`);
    const type =
      n.component_type && n.component_type !== "generic" ? slug(n.component_type) : guess.type;
    const category = CATEGORIES.includes(n.category as NodeCategory)
      ? (n.category as NodeCategory)
      : type === guess.type
        ? guess.category
        : categoryForType(type);
    nodes.push({
      id,
      label: n.label.trim().slice(0, 40),
      subtitle: (n.subtitle?.trim() || (type === "generic" ? undefined : humanize(type)))?.slice(
        0,
        32,
      ),
      component_type: type,
      category,
      icon: type === guess.type ? guess.icon : iconForType(type, guess.icon),
      position: { x: 0, y: 0 },
      group_id: null,
    });
  }

  const edges: AirGraph["edges"] = [];
  const edgeIds = new Set<string>();
  const seenPairs = new Set<string>();
  let dropped = 0;
  candidate.edges.forEach((e, i) => {
    const source = idMap.get(e.source_node_id) ?? idMap.get(e.source_node_id.toLowerCase());
    const target = idMap.get(e.target_node_id) ?? idMap.get(e.target_node_id.toLowerCase());
    if (!source || !target || source === target) {
      dropped++;
      return;
    }
    const semantic = SEMANTICS.includes(e.semantic_type as (typeof SEMANTICS)[number])
      ? (e.semantic_type as (typeof SEMANTICS)[number])
      : "request";
    const direction =
      e.direction === "bidirectional" || e.direction === "reverse" ? e.direction : "forward";
    const key = `${source}>${target}>${semantic}`;
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    const executionMode = (["synchronous", "asynchronous", "streaming", "batch"] as const).includes(
      e.execution_mode as "synchronous",
    )
      ? (e.execution_mode as "synchronous" | "asynchronous" | "streaming" | "batch")
      : defaultExecutionMode(semantic);
    const targetType = nodes.find((n) => n.id === target)?.component_type ?? "generic";
    const sourceType = nodes.find((n) => n.id === source)?.component_type ?? "generic";
    const protocolHint =
      e.protocol?.trim() ||
      (sourceType === "kafka" ? "Kafka" : sourceType === "queue" ? "AMQP" : undefined) ||
      defaultProtocol(semantic, targetType);
    let id = slug(e.id ?? `e${i + 1}`);
    while (edgeIds.has(id)) id = `${id}_${edgeIds.size}`;
    edgeIds.add(id);
    edges.push({
      id,
      source_node_id: source,
      target_node_id: target,
      direction,
      semantic_type: semantic,
      protocol: protocolHint.slice(0, 24),
      execution_mode: executionMode,
      ...(e.payload_type ? { payload_type: e.payload_type.slice(0, 40) } : {}),
      ...(e.label ? { label: e.label.trim().slice(0, 40) } : {}),
    });
  });
  if (dropped > 0)
    warnings.push(`${dropped} connector(s) referenced unknown components and were dropped.`);
  if (nodes.length === 0) throw new Error("No components were found in the description.");
  if (edges.length === 0)
    warnings.push("No connectors were detected — declare flows in the studio before animating.");

  const motion: AirGraph["motion"] = edges.map((e) => {
    const grammar = defaultGrammar(e.semantic_type, e.execution_mode);
    return { edge_id: e.id, grammar, enabled: true, ...GRAMMAR_PRESETS[grammar] };
  });

  const graph: AirGraph = { air_version: AIR_VERSION, nodes, edges, motion };
  return {
    graph: opts.layout === false ? graph : autoLayout(graph),
    warnings,
    title: candidate.title?.trim() || undefined,
  };
}

function humanize(type: string): string {
  const known: Record<string, string> = {
    llm: "Language model",
    agent: "Tool-using loop",
    orchestrator: "Plan & route",
    embedder: "Vectorize",
    reranker: "Cross-encoder",
    guardrail: "Policy filter",
    evaluator: "Scoring / eval",
    vectordb: "Similarity search",
    kg: "Entities & links",
    sql: "Relational store",
    cache: "Low-latency cache",
    objectstore: "Object storage",
    memory: "Session state",
    documents: "Source documents",
    api: "REST / GraphQL",
    mcp: "Tool protocol",
    queue: "Async jobs",
    kafka: "Event topic",
    webhook: "Callback",
    iam: "OAuth / OIDC",
    secrets: "KMS / vault",
    waf: "Edge protection",
    web: "Browser client",
    mobile: "iOS / Android",
    user: "Human actor",
    service: "Container",
    worker: "Background job",
    serverless: "Function",
    k8s: "Cluster",
    cicd: "Pipeline",
    observability: "Traces & metrics",
    search: "Index & search",
  };
  return known[type] ?? type.replace(/_/g, " ");
}
