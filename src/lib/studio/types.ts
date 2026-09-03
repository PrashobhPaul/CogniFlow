export type SemanticType =
  | "request"
  | "response"
  | "data"
  | "event"
  | "stream"
  | "retrieval"
  | "embedding"
  | "message"
  | "file"
  | "control"
  | "error"
  | "retry";

export type Direction = "forward" | "reverse" | "bidirectional";

export type ExecutionMode = "synchronous" | "asynchronous" | "streaming" | "batch";

export type Grammar = "packet" | "stream" | "dense" | "pulse" | "batch";

export type NodeCategory =
  "ai" | "data" | "integration" | "security" | "application" | "cloud" | "devops";

/**
 * Declared runtime state of a component. "auto" derives the badge from the
 * connectors that touch the node (error/retry flows, otherwise executing when
 * any flow is active, idle when none is).
 */
export type NodeStatus = "auto" | "idle" | "executing" | "success" | "retry" | "error";

export const NODE_STATUSES: NodeStatus[] = [
  "auto",
  "idle",
  "executing",
  "success",
  "retry",
  "error",
];

export interface ArchNodeData {
  label: string;
  subtitle?: string | undefined;
  category: NodeCategory;
  icon: string;
  componentType?: string;
  status?: NodeStatus | undefined;
  [key: string]: unknown;
}

export interface FlowEdgeData {
  semanticType: SemanticType;
  protocol: string;
  direction: Direction;
  executionMode: ExecutionMode;
  payloadType?: string | undefined;
  grammar: Grammar;
  speed: number; // seconds per traversal
  density: number; // particles in flight
  size: number; // particle radius
  label?: string | undefined;
  enabled: boolean;
  [key: string]: unknown;
}

export const SEMANTIC_COLORS: Record<SemanticType, string> = {
  request: "var(--flow-request)",
  response: "var(--flow-response)",
  data: "var(--flow-data)",
  event: "var(--flow-event)",
  stream: "var(--flow-stream)",
  retrieval: "var(--flow-retrieval)",
  embedding: "var(--flow-embedding)",
  message: "var(--flow-message)",
  file: "var(--flow-data)",
  control: "var(--flow-control)",
  error: "var(--flow-error)",
  retry: "var(--flow-retry)",
};

export const SEMANTIC_TYPES = Object.keys(SEMANTIC_COLORS) as SemanticType[];

export const EXECUTION_MODES: ExecutionMode[] = [
  "synchronous",
  "asynchronous",
  "streaming",
  "batch",
];

export const GRAMMAR_PRESETS: Record<Grammar, { density: number; speed: number; size: number }> = {
  packet: { density: 3, speed: 2.4, size: 4 },
  stream: { density: 9, speed: 1.6, size: 2.6 },
  dense: { density: 16, speed: 1.1, size: 2 },
  pulse: { density: 1, speed: 1.2, size: 5.5 },
  batch: { density: 5, speed: 3.4, size: 6 },
};

export const CATEGORY_LABEL: Record<NodeCategory, string> = {
  ai: "AI / ML",
  data: "Knowledge & Data",
  integration: "Integration",
  security: "Security",
  application: "Application",
  cloud: "Cloud",
  devops: "DevOps",
};
