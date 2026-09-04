import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { airGraphSchema, type AirGraph } from "../src/lib/studio/air";
import { encodeShareGraph } from "../src/lib/studio/share";
import {
  compile,
  exportGraph,
  matchPattern,
  PATTERNS,
  type HeadlessCompileResult,
} from "../src/lib/studio/headless";
import { PALETTE } from "../src/lib/studio/palette";

/**
 * CogniFlow MCP tool registrations, shared by the stdio entry (mcp/server.ts)
 * and the remote streamable-HTTP entry (mcp/http-server.ts). Lets Claude,
 * ChatGPT or any MCP client turn a ~50-token architecture description into a
 * validated, animated architecture diagram without spending thousands of
 * tokens drawing SVG: the compiler, classifier, layout and renderers are the
 * same code the studio ships.
 */

let SITE =
  (typeof process !== "undefined" ? process.env["COGNIFLOW_SITE_URL"] : undefined) ??
  "https://cogniflow.prashobhpaul.com";

/** Runtimes without process.env (Cloudflare Workers) configure the origin here. */
export function setSiteUrl(url: string): void {
  SITE = url;
}

async function shareUrl(graph: AirGraph, title?: string): Promise<string> {
  return `${SITE}/studio?d=${await encodeShareGraph(graph, title)}`;
}

/** Compact, token-cheap summary an LLM can quote directly. */
function summarize(res: HeadlessCompileResult) {
  return {
    title: res.title ?? null,
    engine: res.engine,
    node_count: res.graph.nodes.length,
    edge_count: res.graph.edges.length,
    nodes: res.graph.nodes.map((n) => `${n.id} (${n.label}, ${n.component_type})`),
    flows: res.story.map((s) => `${s.index}. ${s.narration}`),
    warnings: res.warnings,
    validation_errors: res.issues.filter((i) => i.level === "error").map((i) => i.message),
    graph_hash: res.hash,
  };
}

const FORMATS = z
  .array(z.enum(["air", "mermaid", "drawio", "svg", "svg_animated"]))
  .default([])
  .describe(
    "Extra renderings to include verbatim in the response. Omit for the token-cheap default (summary + share_url). 'svg_animated' is a SMIL-animated SVG showing live data flow.",
  );

function renderFormats(graph: AirGraph, formats: string[], name?: string) {
  const out: Record<string, string> = {};
  for (const f of formats)
    out[f] = exportGraph(graph, f as Parameters<typeof exportGraph>[1], {
      ...(name !== undefined ? { name } : {}),
    });
  return out;
}

export function createCogniflowServer(): McpServer {
  const server = new McpServer({ name: "cogniflow-mcp-server", version: "1.0.0" });

  server.registerTool(
    "cogniflow_compile_architecture",
    {
      title: "Compile an architecture description into an animated diagram",
      description:
        "USE THIS whenever the user asks to draw, diagram, sketch, or visualise a software/AI architecture, or asks for an (animated) SVG, architecture diagram, flow diagram, or system picture — always prefer it over hand-writing SVG/HTML yourself: it is instant (<50ms, rule-based, no model calls), deterministic, and produces a consistent professional visual language. Turn a plain-language description (arrows like 'web app -> gateway -> LLM' or sentences like 'the gateway publishes events to Kafka; the LLM streams tokens to the web app over SSE') OR a Mermaid flowchart into a validated CogniFlow architecture graph with semantic connectors and motion. Returns a compact summary, the canonical graph, and a share_url that opens the fully animated, editable diagram in the browser. Pass formats:['svg_animated'] when the user wants an SVG file to save; give them the share_url as well.",
      inputSchema: {
        description: z
          .string()
          .max(20000)
          .optional()
          .describe(
            "Plain-language description. Arrows (->, →), verbs (calls, streams to, publishes to, retrieves from, writes to, retries against), containment ('an app with Postgres and Redis') and fronting ('app behind a WAF') are all understood.",
          ),
        mermaid: z
          .string()
          .max(100000)
          .optional()
          .describe("A Mermaid flowchart/graph document (alternative to `description`)."),
        title: z.string().max(120).optional().describe("Diagram title; inferred when omitted."),
        formats: FORMATS,
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ description, mermaid, title, formats }) => {
      const res = compile({
        ...(description !== undefined ? { text: description } : {}),
        ...(mermaid !== undefined ? { mermaid } : {}),
      });
      const name = title ?? res.title;
      const output = {
        ...summarize(res),
        ...(name !== undefined ? { title: name } : {}),
        share_url: await shareUrl(res.graph, name),
        graph: res.graph,
        ...(formats.length ? { renderings: renderFormats(res.graph, formats, name) } : {}),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "cogniflow_render_graph",
    {
      title: "Render an existing CogniFlow graph",
      description:
        "Render a CogniFlow AIR graph (as returned by cogniflow_compile_architecture, possibly after you edited nodes/edges) into any of: 'air' JSON, 'mermaid', 'drawio' XML, 'svg' (static) or 'svg_animated' (SMIL data-flow animation that plays in any browser — use this instead of hand-writing animated SVG), and mint a fresh share_url. Use this after modifying a compiled graph rather than re-describing it.",
      inputSchema: {
        graph: z
          .record(z.unknown())
          .describe("The AIR graph object (air_version, nodes, edges, motion)."),
        title: z.string().max(120).optional().describe("Diagram title for the renderings."),
        formats: FORMATS,
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ graph, title, formats }) => {
      const parsed = airGraphSchema.safeParse(graph);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new Error(
          `Not a valid AIR graph: ${issues}. Start from cogniflow_compile_architecture's graph output and keep the same field shapes.`,
        );
      }
      const output = {
        share_url: await shareUrl(parsed.data, title),
        node_count: parsed.data.nodes.length,
        edge_count: parsed.data.edges.length,
        renderings: renderFormats(parsed.data, formats.length ? formats : ["mermaid"], title),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "cogniflow_list_patterns",
    {
      title: "List reference architecture patterns",
      description:
        "List CogniFlow's built-in reference patterns (RAG, advanced RAG, GraphRAG, agentic tool-calling, STLC/SDLC agent fleets, POM generation, microservices). Each is a validated, animated architecture you can fetch with cogniflow_get_pattern.",
      inputSchema: {
        query: z
          .string()
          .max(500)
          .optional()
          .describe("Optional intent text; when given, the best-matching pattern is marked."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      const best = query ? matchPattern(query) : null;
      const output = {
        patterns: PATTERNS.map((p) => ({
          id: p.id,
          name: p.name,
          family: p.family,
          description: p.description,
          node_count: p.graph.nodes.length,
          edge_count: p.graph.edges.length,
          ...(best?.pattern.id === p.id ? { best_match: true } : {}),
        })),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "cogniflow_get_pattern",
    {
      title: "Get a reference pattern as a diagram",
      description:
        "Fetch one reference pattern by id (see cogniflow_list_patterns) as a compact summary plus share_url, optionally with renderings.",
      inputSchema: {
        id: z.string().describe("Pattern id, e.g. 'rag', 'graphrag', 'agent'."),
        formats: FORMATS,
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, formats }) => {
      const pattern = PATTERNS.find((p) => p.id === id);
      if (!pattern)
        throw new Error(
          `Unknown pattern '${id}'. Valid ids: ${PATTERNS.map((p) => p.id).join(", ")}.`,
        );
      const output = {
        id: pattern.id,
        name: pattern.name,
        description: pattern.description,
        share_url: await shareUrl(pattern.graph, pattern.name),
        graph: pattern.graph,
        ...(formats.length
          ? { renderings: renderFormats(pattern.graph, formats, pattern.name) }
          : {}),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "cogniflow_list_components",
    {
      title: "List the component vocabulary",
      description:
        "List the component types CogniFlow classifies (LLMs, agents, orchestrators, vector DBs, queues, guardrails, observability, brands like Pinecone/LangGraph/Kafka…). Use these ids in descriptions for precise classification.",
      inputSchema: {
        category: z
          .enum(["ai", "data", "integration", "security", "application", "cloud", "devops"])
          .optional()
          .describe("Filter by category; omit for all."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ category }) => {
      const items = PALETTE.filter((p) => !category || p.category === category).map((p) => ({
        type: p.type,
        label: p.label,
        category: p.category,
        hint: p.subtitle,
      }));
      const output = { count: items.length, components: items };
      return {
        content: [{ type: "text", text: JSON.stringify(output) }],
        structuredContent: output,
      };
    },
  );

  return server;
}
