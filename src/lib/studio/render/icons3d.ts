import type { NodeCategory } from "../types";
import { FONT_SANS, mixHex, parseHex } from "../theme";
import { iconMarkup } from "./icons";
import { brandFor } from "./brands";

/**
 * 3D icon medallions for architecture diagrams.
 *
 * Every component gets a small volumetric base — a glowing crystal for models,
 * a gear hub for orchestration, a lattice cylinder for data, a portal for
 * gateways and protocols, a shield for safety, a glass tile for interfaces —
 * with the component's glyph (a lucide icon, a brand mark or a monogram) lit
 * from the top-left. Each icon is a self-contained <svg> with a 64×64 viewBox,
 * so the identical markup renders in React Flow nodes, the palette and every
 * export (SVG, GIF, MP4, PPTX): what you see on the canvas is what you ship.
 *
 * Gradient / filter ids are derived from the colours, so duplicates across
 * many icons in one document always refer to identical definitions.
 */

export type IconShape =
  | "crystal"
  | "cube"
  | "cylinder"
  | "portal"
  | "shield"
  | "glass"
  | "platform"
  | "gear"
  | "scroll"
  | "orb"
  // CogniFlow symbol library: functional silhouettes for AI pipelines.
  | "lattice" // multi-layered neural grid (open / custom LLMs)
  | "funnel" // embedding: unstructured shapes compress into a dense array
  | "pointcloud" // vector store: 3D point cloud in a spatial cube
  | "stack" // relational store: stacked database cylinders
  | "hub" // orchestrator: central core branching to sub-nodes
  | "ring" // agent frameworks: cyclic state-machine loop
  | "conveyor" // queues: partitioned belt, FIFO
  | "fanout" // pub/sub: one entry fanning out to subscribers
  | "gate" // guardrails: dual-pillar checkpoint with a scan frame
  | "radar" // observability: dish with range rings
  | "sheet" // documents: page with a folded corner
  | "avatar" // people: framed portrait
  | "splitter" // chunking: a page passing through a blade
  | "wave" // audio inputs: waveform bars
  | "reel" // video / media inputs: film strip
  | "monitor"; // watchdogs & alerts: heartbeat trace

const SHAPE_FOR_CATEGORY: Record<NodeCategory, IconShape> = {
  ai: "crystal",
  data: "cylinder",
  integration: "portal",
  security: "shield",
  application: "glass",
  cloud: "platform",
  devops: "gear",
};

/** Component types whose tier calls for a different base than their category default. */
const SHAPE_FOR_TYPE: Record<string, IconShape> = {
  // Foundation models: hosted models stay crystals; open / custom weights are neural lattices.
  slm: "lattice",
  llama: "lattice",
  deepseek: "lattice",
  mistral: "lattice",
  ollama: "lattice",
  huggingface: "lattice",
  // Embedding: funnel that compresses text into a dense vector.
  embedder: "funnel",
  // Agents are neural cubes with a thinking ring.
  agent: "cube",
  subagent: "cube",
  evaluator: "cube",
  extractor: "cube",
  translator: "cube",
  clarifier: "cube",
  reranker: "cube",
  copilot: "cube",
  kiro: "cube",
  // Orchestration: a central hub dispatching to sub-nodes.
  orchestrator: "hub",
  planner: "hub",
  router: "hub",
  parallel: "hub",
  dag: "hub",
  workflow: "hub",
  // Agent frameworks: cyclic state-machine rings.
  langgraph: "ring",
  langchain: "ring",
  llamaindex: "ring",
  autogen: "ring",
  crewai: "ring",
  semantickernel: "ring",
  agentframework: "ring",
  statemachine: "ring",
  // Schedulers, hooks and workers keep the gear.
  n8n: "gear",
  airflow: "gear",
  hooks: "gear",
  worker: "gear",
  // Agent mechanics: directive scrolls and isolation chambers.
  steering: "scroll",
  prompts: "scroll",
  skills: "scroll",
  memory: "cylinder",
  sandbox: "glass",
  cli: "glass",
  // Vector search: spatial point clouds.
  vectordb: "pointcloud",
  search: "pointcloud",
  pinecone: "pointcloud",
  chroma: "pointcloud",
  faiss: "pointcloud",
  qdrant: "pointcloud",
  milvus: "pointcloud",
  weaviate: "pointcloud",
  // Relational & tabular stores: stacked cylinders.
  sql: "stack",
  nosql: "stack",
  postgres: "stack",
  warehouse: "stack",
  enterprise: "stack",
  // Caches keep the lattice cylinder.
  cache: "cylinder",
  semanticcache: "cylinder",
  // Data inputs.
  documents: "sheet",
  kb: "sheet",
  parser: "sheet",
  chunker: "splitter",
  audio: "wave",
  video: "reel",
  // Queues, buses and fan-out.
  queue: "conveyor",
  kafka: "conveyor",
  rabbitmq: "conveyor",
  sqs: "conveyor",
  pubsub: "fanout",
  gcppubsub: "fanout",
  loadbalancer: "fanout",
  webhook: "fanout",
  // Governance checkpoints.
  guardrail: "gate",
  aigateway: "gate",
  ratelimiter: "gate",
  // Humans.
  user: "avatar",
  hitl: "avatar",
  // Observability: radar dishes and heartbeat monitors.
  observability: "radar",
  tracing: "radar",
  langsmith: "radar",
  arize: "radar",
  langfuse: "radar",
  datadog: "radar",
  alerts: "monitor",
  cloudwatch: "monitor",
  dashboard: "glass",
  // Platforms.
  k8s: "platform",
  serverless: "platform",
  aws: "platform",
  azure: "platform",
  gcp: "platform",
};

export function shapeFor(type: string | undefined, category: NodeCategory): IconShape {
  return (type ? SHAPE_FOR_TYPE[type] : undefined) ?? SHAPE_FOR_CATEGORY[category] ?? "glass";
}

export interface Icon3dSpec {
  /** lucide icon name, "brand:<slug>" or "mono:<letters>". */
  icon: string;
  category: NodeCategory;
  /** Category accent (drives the glow and the default body colour). */
  accent: string;
  shape?: IconShape;
  size: number;
  /** Position inside a parent SVG; omit for a standalone element. */
  x?: number;
  y?: number;
}

const cache = new Map<string, string>();
const r1 = (v: number) => Math.round(v * 10) / 10;

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => c / 255) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function gearPath(cx: number, cy: number, teeth: number, outer: number, inner: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const w = step * 0.28;
    const seq: [number, number][] = [
      [a - w * 1.35, inner],
      [a - w * 0.85, outer],
      [a + w * 0.85, outer],
      [a + w * 1.35, inner],
    ];
    for (const [ang, r] of seq)
      pts.push(`${r1(cx + Math.cos(ang) * r)},${r1(cy + Math.sin(ang) * r)}`);
  }
  return `M${pts.join("L")}Z`;
}

interface Body {
  /** Base geometry (already filled / stroked). */
  markup: string;
  /** Glyph centre and scale relative to the 28-unit glyph box. */
  cx: number;
  cy: number;
  scale: number;
}

function body(shape: IconShape, ids: { lg: string; hl: string; top: string }, base: string): Body {
  const dark = mixHex(base, "#000000", 0.45);
  const rim = `stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"`;
  switch (shape) {
    case "crystal":
      return {
        markup:
          `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="url(#${ids.lg})" ${rim} />` +
          `<polygon points="32,4 56,18 32,32 8,18" fill="#ffffff" fill-opacity="0.2" />` +
          `<polygon points="8,18 32,32 32,60 8,46" fill="#000000" fill-opacity="0.1" />` +
          `<polygon points="56,18 56,46 32,60 32,32" fill="#000000" fill-opacity="0.26" />` +
          `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 33,
        scale: 1,
      };
    case "cube":
      return {
        markup:
          `<polygon points="32,6 56,19 56,45 32,58 8,45 8,19" fill="url(#${ids.lg})" ${rim} />` +
          `<polygon points="32,6 56,19 32,32 8,19" fill="#ffffff" fill-opacity="0.28" />` +
          `<polygon points="8,19 32,32 32,58 8,45" fill="#000000" fill-opacity="0.08" />` +
          `<polygon points="56,19 56,45 32,58 32,32" fill="#000000" fill-opacity="0.3" />` +
          `<polyline points="8,19 32,32 56,19" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1" />` +
          `<line x1="32" y1="32" x2="32" y2="58" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1" />`,
        cx: 32,
        cy: 34,
        scale: 0.9,
      };
    case "cylinder":
      return {
        markup:
          `<path d="M10,17 V47 A22,8 0 0 0 54,47 V17 Z" fill="url(#${ids.lg})" />` +
          `<rect x="10" y="40" width="44" height="8" fill="#000000" fill-opacity="0.14" />` +
          `<line x1="10" y1="27" x2="54" y2="27" stroke="#ffffff" stroke-opacity="0.12" />` +
          `<line x1="10" y1="35" x2="54" y2="35" stroke="#ffffff" stroke-opacity="0.12" />` +
          `<path d="M10,47 A22,8 0 0 0 54,47" fill="none" ${rim} />` +
          `<ellipse cx="32" cy="17" rx="22" ry="8" fill="url(#${ids.top})" ${rim} />` +
          `<path d="M10,17 V47 A22,8 0 0 0 54,47 V17 Z" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 36,
        scale: 0.82,
      };
    case "portal":
      return {
        markup:
          `<rect x="6" y="6" width="52" height="52" rx="15" fill="url(#${ids.lg})" ${rim} />` +
          `<rect x="14" y="14" width="36" height="36" rx="9" fill="${dark}" />` +
          `<rect x="14" y="14" width="36" height="36" rx="9" fill="none" stroke="#000000" stroke-opacity="0.25" stroke-width="1.5" />` +
          `<rect x="6" y="6" width="52" height="52" rx="15" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 0.86,
      };
    case "shield":
      return {
        markup:
          `<path d="M32,4 L56,13 V31 C56,45 45,55 32,60 C19,55 8,45 8,31 V13 Z" fill="url(#${ids.lg})" ${rim} />` +
          `<path d="M32,4 L8,13 V31 C8,45 19,55 32,60 Z" fill="#ffffff" fill-opacity="0.12" />` +
          `<path d="M32,9 L51,16 V31 C51,42 42,50 32,54 Z" fill="#000000" fill-opacity="0.16" />` +
          `<path d="M32,4 L56,13 V31 C56,45 45,55 32,60 C19,55 8,45 8,31 V13 Z" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 31,
        scale: 0.9,
      };
    case "glass":
      return {
        markup:
          `<rect x="7" y="7" width="50" height="50" rx="13" fill="url(#${ids.lg})" ${rim} />` +
          `<polygon points="7,7 57,7 57,17 7,36" fill="#ffffff" fill-opacity="0.2" />` +
          `<rect x="7" y="49" width="50" height="8" fill="#000000" fill-opacity="0.14" />` +
          `<rect x="7" y="7" width="50" height="50" rx="13" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 1,
      };
    case "platform":
      return {
        markup:
          `<ellipse cx="32" cy="48" rx="27" ry="10" fill="${dark}" />` +
          `<path d="M5,42 V48 A27,10 0 0 0 59,48 V42 Z" fill="url(#${ids.lg})" />` +
          `<ellipse cx="32" cy="42" rx="27" ry="10" fill="url(#${ids.top})" ${rim} />` +
          `<ellipse cx="32" cy="42" rx="27" ry="10" fill="url(#${ids.hl})" />` +
          `<ellipse cx="32" cy="42" rx="12" ry="4" fill="#000000" fill-opacity="0.22" />`,
        cx: 32,
        cy: 22,
        scale: 1,
      };
    case "gear":
      return {
        markup:
          `<path d="${gearPath(32, 32, 8, 28, 22)}" fill="url(#${ids.lg})" ${rim} />` +
          `<circle cx="32" cy="32" r="20" fill="url(#${ids.top})" />` +
          `<circle cx="32" cy="32" r="20" fill="url(#${ids.hl})" />` +
          `<circle cx="32" cy="32" r="20" fill="none" stroke="#000000" stroke-opacity="0.18" />`,
        cx: 32,
        cy: 32,
        scale: 0.86,
      };
    case "scroll":
      return {
        markup:
          `<rect x="13" y="12" width="38" height="40" rx="3" fill="url(#${ids.lg})" ${rim} />` +
          `<line x1="20" y1="26" x2="44" y2="26" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" />` +
          `<line x1="20" y1="32" x2="44" y2="32" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" />` +
          `<line x1="20" y1="38" x2="40" y2="38" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2" />` +
          `<rect x="9" y="7" width="46" height="10" rx="5" fill="url(#${ids.top})" ${rim} />` +
          `<rect x="9" y="47" width="46" height="10" rx="5" fill="${dark}" ${rim} />` +
          `<rect x="13" y="12" width="38" height="40" rx="3" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 0.72,
      };
    case "lattice":
      return {
        markup:
          `<rect x="6" y="6" width="52" height="52" rx="13" fill="url(#${ids.lg})" ${rim} />` +
          `<path d="M16,18 L32,12 M16,18 L32,26 M16,18 L32,40 M16,32 L32,26 M16,32 L32,40 M16,46 L32,40 M16,46 L32,52 M32,12 L48,20 M32,26 L48,20 M32,26 L48,34 M32,40 L48,34 M32,40 L48,46 M32,52 L48,46" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1" />` +
          `<g fill="#ffffff" fill-opacity="0.6"><circle cx="16" cy="18" r="2.4" /><circle cx="16" cy="32" r="2.4" /><circle cx="16" cy="46" r="2.4" /><circle cx="32" cy="12" r="2.4" /><circle cx="32" cy="26" r="2.4" /><circle cx="32" cy="40" r="2.4" /><circle cx="32" cy="52" r="2.4" /><circle cx="48" cy="20" r="2.4" /><circle cx="48" cy="34" r="2.4" /><circle cx="48" cy="46" r="2.4" /></g>` +
          `<circle cx="32" cy="32" r="13" fill="${dark}" fill-opacity="0.88" />` +
          `<rect x="6" y="6" width="52" height="52" rx="13" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 0.68,
      };
    case "funnel":
      return {
        markup:
          `<path d="M6,14 H58 L40,38 V56 L24,60 V38 Z" fill="url(#${ids.lg})" ${rim} />` +
          `<path d="M24,46 H40 M24,52 H40" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2" />` +
          `<ellipse cx="32" cy="14" rx="26" ry="6" fill="url(#${ids.top})" ${rim} />` +
          `<path d="M6,14 H58 L40,38 V56 L24,60 V38 Z" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 27,
        scale: 0.62,
      };
    case "pointcloud":
      return {
        markup:
          `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="url(#${ids.lg})" fill-opacity="0.6" ${rim} />` +
          `<path d="M8,18 L32,32 L56,18 M32,32 V60" fill="none" stroke="#ffffff" stroke-opacity="0.3" />` +
          `<g fill="#ffffff" fill-opacity="0.8"><circle cx="20" cy="26" r="2" /><circle cx="42" cy="22" r="2.4" /><circle cx="30" cy="44" r="2" /><circle cx="47" cy="40" r="2.2" /><circle cx="17" cy="42" r="1.8" /><circle cx="38" cy="52" r="2" /><circle cx="26" cy="14" r="1.6" /><circle cx="50" cy="29" r="1.6" /></g>` +
          `<circle cx="32" cy="33" r="12" fill="${dark}" fill-opacity="0.85" />` +
          `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 33,
        scale: 0.66,
      };
    case "stack":
      return {
        markup:
          `<path d="M10,34 V50 A22,7 0 0 0 54,50 V34 Z" fill="url(#${ids.lg})" />` +
          `<rect x="10" y="42" width="44" height="3" fill="#ffffff" fill-opacity="0.22" />` +
          `<path d="M10,50 A22,7 0 0 0 54,50" fill="none" ${rim} />` +
          `<ellipse cx="32" cy="34" rx="22" ry="7" fill="url(#${ids.top})" ${rim} />` +
          `<path d="M10,12 V28 A22,7 0 0 0 54,28 V12 Z" fill="url(#${ids.lg})" />` +
          `<rect x="10" y="20" width="44" height="3" fill="#ffffff" fill-opacity="0.22" />` +
          `<path d="M10,28 A22,7 0 0 0 54,28" fill="none" ${rim} />` +
          `<ellipse cx="32" cy="12" rx="22" ry="7" fill="url(#${ids.top})" ${rim} />` +
          `<circle cx="32" cy="32" r="11" fill="${dark}" fill-opacity="0.9" />` +
          `<path d="M10,12 V50 A22,7 0 0 0 54,50 V12 Z" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 0.6,
      };
    case "hub":
      return {
        markup:
          `<path d="M32,32 L32,8 M32,32 L53,20 M32,32 L53,44 M32,32 L32,56 M32,32 L11,44 M32,32 L11,20" fill="none" stroke="url(#${ids.lg})" stroke-width="3" />` +
          `<g fill="url(#${ids.top})" ${rim}><circle cx="32" cy="8" r="5" /><circle cx="53" cy="20" r="5" /><circle cx="53" cy="44" r="5" /><circle cx="32" cy="56" r="5" /><circle cx="11" cy="44" r="5" /><circle cx="11" cy="20" r="5" /></g>` +
          `<circle cx="32" cy="32" r="16" fill="url(#${ids.lg})" ${rim} />` +
          `<circle cx="32" cy="32" r="16" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 0.68,
      };
    case "ring":
      return {
        markup:
          `<circle cx="32" cy="32" r="23" fill="none" stroke="url(#${ids.lg})" stroke-width="9" />` +
          `<circle cx="32" cy="32" r="27.5" fill="none" ${rim} />` +
          `<circle cx="32" cy="32" r="23" fill="none" stroke="url(#${ids.hl})" stroke-width="9" />` +
          `<g fill="url(#${ids.top})" ${rim}><circle cx="32" cy="9" r="5.5" /><circle cx="52" cy="43.5" r="5.5" /><circle cx="12" cy="43.5" r="5.5" /></g>` +
          `<path d="M45,13.5 L50,12 L48.5,17" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />` +
          `<circle cx="32" cy="32" r="14" fill="${dark}" fill-opacity="0.88" />`,
        cx: 32,
        cy: 32,
        scale: 0.62,
      };
    case "conveyor":
      return {
        markup:
          `<rect x="12" y="4" width="40" height="34" rx="9" fill="url(#${ids.lg})" ${rim} />` +
          `<rect x="12" y="4" width="40" height="34" rx="9" fill="url(#${ids.hl})" />` +
          `<rect x="4" y="42" width="56" height="16" rx="8" fill="${dark}" ${rim} />` +
          `<g fill="url(#${ids.top})"><rect x="9" y="46" width="9" height="8" rx="2" /><rect x="21" y="46" width="9" height="8" rx="2" /><rect x="33" y="46" width="9" height="8" rx="2" /><rect x="45" y="46" width="9" height="8" rx="2" /></g>`,
        cx: 32,
        cy: 21,
        scale: 0.7,
      };
    case "fanout":
      return {
        markup:
          `<path d="M12,32 L52,12 M12,32 L52,32 M12,32 L52,52" fill="none" stroke="url(#${ids.lg})" stroke-width="4" stroke-linecap="round" />` +
          `<circle cx="12" cy="32" r="9" fill="url(#${ids.lg})" ${rim} />` +
          `<g fill="url(#${ids.top})" ${rim}><circle cx="52" cy="12" r="6.5" /><circle cx="52" cy="32" r="6.5" /><circle cx="52" cy="52" r="6.5" /></g>` +
          `<circle cx="32" cy="32" r="13" fill="${dark}" ${rim} />` +
          `<circle cx="32" cy="32" r="13" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 0.58,
      };
    case "gate":
      return {
        markup:
          `<rect x="6" y="12" width="11" height="48" rx="4" fill="url(#${ids.lg})" ${rim} />` +
          `<rect x="47" y="12" width="11" height="48" rx="4" fill="url(#${ids.lg})" ${rim} />` +
          `<rect x="17" y="20" width="30" height="38" fill="${dark}" fill-opacity="0.6" />` +
          `<rect x="19" y="22" width="26" height="34" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-dasharray="3 3" />` +
          `<rect x="6" y="6" width="52" height="11" rx="5.5" fill="url(#${ids.top})" ${rim} />` +
          `<rect x="6" y="6" width="52" height="11" rx="5.5" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 39,
        scale: 0.66,
      };
    case "radar":
      return {
        markup:
          `<ellipse cx="32" cy="57" rx="18" ry="4" fill="#000000" fill-opacity="0.25" />` +
          `<circle cx="32" cy="31" r="26" fill="url(#${ids.lg})" ${rim} />` +
          `<g fill="none" stroke="#ffffff" stroke-opacity="0.22"><circle cx="32" cy="31" r="18" /><circle cx="32" cy="31" r="10" /><path d="M6,31 H58 M32,5 V57" /></g>` +
          `<path d="M32,31 L58,31 A26,26 0 0 0 50.4,12.6 Z" fill="#ffffff" fill-opacity="0.16" />` +
          `<circle cx="32" cy="31" r="26" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 31,
        scale: 0.72,
      };
    case "sheet":
      return {
        markup:
          `<path d="M14,4 H42 L54,16 V60 H14 Z" fill="url(#${ids.lg})" ${rim} />` +
          `<path d="M42,4 V16 H54 Z" fill="#ffffff" fill-opacity="0.45" />` +
          `<path d="M22,46 H46 M22,52 H38" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="2" stroke-linecap="round" />` +
          `<path d="M14,4 H42 L54,16 V60 H14 Z" fill="url(#${ids.hl})" />`,
        cx: 34,
        cy: 30,
        scale: 0.62,
      };
    case "avatar":
      return {
        markup:
          `<rect x="6" y="6" width="52" height="52" rx="14" fill="url(#${ids.lg})" ${rim} />` +
          `<circle cx="32" cy="30" r="17" fill="${dark}" fill-opacity="0.85" />` +
          `<rect x="18" y="50" width="28" height="4" rx="2" fill="#ffffff" fill-opacity="0.35" />` +
          `<rect x="6" y="6" width="52" height="52" rx="14" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 30,
        scale: 0.78,
      };
    case "splitter":
      return {
        markup:
          `<rect x="16" y="4" width="32" height="24" rx="4" fill="url(#${ids.lg})" ${rim} />` +
          `<g fill="url(#${ids.lg})" ${rim}><rect x="16" y="38" width="32" height="5" rx="2" /><rect x="16" y="46" width="32" height="5" rx="2" /><rect x="16" y="54" width="32" height="5" rx="2" /></g>` +
          `<rect x="4" y="29" width="56" height="7" rx="3.5" fill="url(#${ids.top})" ${rim} />` +
          `<rect x="16" y="4" width="32" height="24" rx="4" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 16,
        scale: 0.55,
      };
    case "wave":
      return {
        markup:
          `<rect x="6" y="6" width="52" height="52" rx="13" fill="url(#${ids.lg})" ${rim} />` +
          `<path d="M13,30 V34 M18,26 V38 M23,22 V42 M28,16 V48 M33,20 V44 M38,26 V38 M43,22 V42 M48,28 V36 M53,30 V34" fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2.4" stroke-linecap="round" />` +
          `<circle cx="32" cy="32" r="13" fill="${dark}" fill-opacity="0.88" />` +
          `<rect x="6" y="6" width="52" height="52" rx="13" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 0.66,
      };
    case "reel":
      return {
        markup:
          `<rect x="4" y="10" width="56" height="44" rx="6" fill="url(#${ids.lg})" ${rim} />` +
          `<g fill="${dark}"><rect x="9" y="13" width="7" height="5" rx="1" /><rect x="21" y="13" width="7" height="5" rx="1" /><rect x="33" y="13" width="7" height="5" rx="1" /><rect x="45" y="13" width="7" height="5" rx="1" /><rect x="9" y="46" width="7" height="5" rx="1" /><rect x="21" y="46" width="7" height="5" rx="1" /><rect x="33" y="46" width="7" height="5" rx="1" /><rect x="45" y="46" width="7" height="5" rx="1" /></g>` +
          `<rect x="12" y="21" width="40" height="22" rx="3" fill="${dark}" fill-opacity="0.78" />` +
          `<rect x="4" y="10" width="56" height="44" rx="6" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 32,
        scale: 0.6,
      };
    case "monitor":
      return {
        markup:
          `<rect x="6" y="6" width="52" height="52" rx="13" fill="url(#${ids.lg})" ${rim} />` +
          `<circle cx="32" cy="26" r="13" fill="${dark}" fill-opacity="0.85" />` +
          `<path d="M10,48 H20 L24,40 L29,54 L34,44 L38,48 H54" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />` +
          `<rect x="6" y="6" width="52" height="52" rx="13" fill="url(#${ids.hl})" />`,
        cx: 32,
        cy: 26,
        scale: 0.62,
      };
    case "orb":
    default:
      return {
        markup:
          `<ellipse cx="32" cy="56" rx="18" ry="4" fill="#000000" fill-opacity="0.25" />` +
          `<circle cx="32" cy="31" r="26" fill="url(#${ids.lg})" ${rim} />` +
          `<circle cx="32" cy="31" r="26" fill="url(#${ids.hl})" />` +
          `<ellipse cx="32" cy="31" rx="26" ry="8" fill="none" stroke="#ffffff" stroke-opacity="0.16" />`,
        cx: 32,
        cy: 32,
        scale: 0.95,
      };
  }
}

function glyph(icon: string, cx: number, cy: number, scale: number): string {
  const box = 28 * scale;
  const brand = brandFor(icon);
  const shadow = (inner: (color: string) => string) =>
    `<g transform="translate(${r1(cx - box / 2 + 0.6)} ${r1(cy - box / 2 + 1.1)})" opacity="0.35">${inner("#000000")}</g>` +
    `<g transform="translate(${r1(cx - box / 2)} ${r1(cy - box / 2)})">${inner("#ffffff")}</g>`;
  if (brand?.path) {
    const s = r1(box / 24);
    return shadow((c: string) => `<path d="${brand.path}" fill="${c}" transform="scale(${s})" />`);
  }
  const letters = brand?.mono ?? (icon.startsWith("mono:") ? icon.slice(5) : null);
  if (letters) {
    const fs =
      letters.length <= 1 ? 26 : letters.length === 2 ? 21 : letters.length === 3 ? 16 : 13;
    return shadow(
      (c: string) =>
        `<text x="${r1(box / 2)}" y="${r1(box / 2)}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_SANS}" font-weight="700" font-size="${r1(fs * scale)}" letter-spacing="-0.5" fill="${c}">${letters}</text>`,
    );
  }
  return shadow((c: string) => iconMarkup(icon, r1(box), c, 2.2));
}

/** Standalone (or positioned, when x/y are given) 3D icon as SVG markup. */
export function icon3dMarkup(spec: Icon3dSpec): string {
  const shape = spec.shape ?? SHAPE_FOR_CATEGORY[spec.category] ?? "glass";
  const key = `${spec.icon}|${spec.category}|${spec.accent}|${shape}|${spec.size}|${spec.x ?? ""}|${spec.y ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const brand = brandFor(spec.icon);
  let base = brand?.hex ?? spec.accent;
  // Near-black brand colours would swallow the lighting; pull them toward the accent.
  if (luminance(base) < 0.12) base = mixHex(base, spec.accent, 0.45);
  const k = `${base.slice(1)}${spec.accent.slice(1)}`.toLowerCase();
  const ids = { lg: `i3d-lg-${k}`, hl: `i3d-hl-${k}`, top: `i3d-top-${k}`, glow: `i3d-gl-${k}` };
  const light = mixHex(base, "#ffffff", 0.42);
  const dark = mixHex(base, "#000000", 0.4);
  const defs =
    `<linearGradient id="${ids.lg}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.48" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></linearGradient>` +
    `<linearGradient id="${ids.top}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mixHex(base, "#ffffff", 0.6)}"/><stop offset="1" stop-color="${mixHex(base, "#ffffff", 0.15)}"/></linearGradient>` +
    `<radialGradient id="${ids.hl}" cx="0.3" cy="0.22" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>` +
    `<filter id="${ids.glow}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="${spec.accent}" flood-opacity="0.55"/></filter>`;
  const b = body(shape, ids, base);
  const pos =
    spec.x !== undefined && spec.y !== undefined ? ` x="${r1(spec.x)}" y="${r1(spec.y)}"` : "";
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg"${pos} width="${spec.size}" height="${spec.size}" viewBox="0 0 64 64" overflow="visible" aria-hidden="true">` +
    `<defs>${defs}</defs>` +
    `<g filter="url(#${ids.glow})">${b.markup}</g>` +
    glyph(spec.icon, b.cx, b.cy, b.scale) +
    `</svg>`;
  cache.set(key, markup);
  return markup;
}

/** Short description of each base silhouette, for the inspector and gallery. */
export const SHAPE_LABEL: Record<IconShape, string> = {
  crystal: "Neural crystal",
  cube: "Neural cube",
  cylinder: "Lattice cylinder",
  portal: "Portal",
  shield: "Shield",
  glass: "Glass tile",
  platform: "Platform",
  gear: "Gear hub",
  scroll: "Directive scroll",
  orb: "Orb",
  lattice: "Neural lattice",
  funnel: "Embedding funnel",
  pointcloud: "Point cloud",
  stack: "Stacked store",
  hub: "Dispatch hub",
  ring: "State ring",
  conveyor: "Conveyor",
  fanout: "Fan-out",
  gate: "Checkpoint gate",
  radar: "Radar",
  sheet: "Document sheet",
  avatar: "Avatar frame",
  splitter: "Splitter",
  wave: "Waveform",
  reel: "Film reel",
  monitor: "Heartbeat monitor",
};

/** Human-readable label for gallery / tooltips. */
export function iconTitle(icon: string): string {
  const brand = brandFor(icon);
  if (brand) return brand.title;
  if (icon.startsWith("mono:")) return icon.slice(5);
  return icon.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
}
