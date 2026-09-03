import { describe, expect, test } from "bun:test";
import { compile, exportGraph, PATTERNS } from "../src/lib/studio/headless";
import { importMermaid, exportMermaid } from "../src/lib/studio/mermaid";
import { validateGraph } from "../src/lib/studio/air";
import { parseDsl, repairJson, extractJson } from "../src/lib/studio/ai/prompts";
import { candidateToGraph } from "../src/lib/studio/candidate";

describe("rule compiler", () => {
  test("compiles arrows and verbs into a validated graph", () => {
    const res = compile({
      text: "A RAG chatbot: web app -> gateway -> orchestrator. Orchestrator retrieves from the vector DB over gRPC. LLM returns the answer to the web app over SSE.",
    });
    expect(res.title).toBe("RAG Chatbot");
    expect(res.graph.nodes.length).toBeGreaterThanOrEqual(5);
    expect(res.issues.filter((i) => i.level === "error")).toHaveLength(0);
    expect(res.story.length).toBe(res.graph.edges.length);
  });

  test("gateway targets are requests, not control (no 'gate' false positive)", () => {
    const res = compile({ text: "web app -> gateway" });
    expect(res.graph.edges[0]!.semantic_type).toBe("request");
  });

  test("every reference pattern validates cleanly", () => {
    for (const p of PATTERNS) {
      expect(validateGraph(p.graph).filter((i) => i.level === "error")).toHaveLength(0);
    }
  });
});

describe("mermaid", () => {
  const SAMPLE = `flowchart LR
  user([User]) -->|prompt| gw[API Gateway]
  subgraph retrieval [Retrieval]
    embed[Embedding Model] --> vdb[(Vector DB)]
  end
  gw -->|embed query| embed
  vdb -.->|candidates| rerank[Reranker]
  rerank ==> llm[LLM]
  llm <-->|tool call| mcp[MCP Tools]
  a1[Svc A] & a2[Svc B] --> bus[Event Bus]`;

  test("imports flowcharts with subgraphs, fan-out and edge styles", () => {
    const res = importMermaid(SAMPLE);
    expect(res.graph.nodes.length).toBe(10);
    expect(res.graph.edges.length).toBe(8);
    expect(res.graph.nodes.find((n) => n.id === "vdb")!.group_id).toBe("retrieval");
    expect(res.graph.edges.find((e) => e.source_node_id === "llm")!.direction).toBe(
      "bidirectional",
    );
    expect(validateGraph(res.graph).filter((i) => i.level === "error")).toHaveLength(0);
  });

  test("round-trips through export deterministically", () => {
    const first = importMermaid(SAMPLE);
    const exported = exportMermaid(first.graph, "Test");
    const second = importMermaid(exported);
    expect([...second.graph.nodes.map((n) => n.id)].sort()).toEqual(
      [...first.graph.nodes.map((n) => n.id)].sort(),
    );
    expect(second.graph.edges.length).toBe(first.graph.edges.length);
    expect(exportMermaid(first.graph, "Test")).toBe(exported); // no timestamps
  });
});

describe("exports", () => {
  test("svg renders headlessly with nodes and motion", () => {
    const res = compile({ text: "web app -> gateway -> llm. llm returns tokens to web app." });
    const svg = exportGraph(res.graph, "svg_animated", { name: "T" });
    expect(svg).toStartWith("<svg");
    expect(svg).toContain("animateMotion");
    const drawio = exportGraph(res.graph, "drawio");
    expect(drawio).toContain("mxGraphModel");
  });
});

describe("small-model output handling", () => {
  test("parses the arrow DSL, tolerating junk and undeclared ids", () => {
    const cand = parseDsl(
      "title: X\napp = App [web]\napp -> llm : prompt | request | REST\nnot a line",
    );
    expect(cand.nodes.length).toBe(2);
    expect(cand.edges.length).toBe(1);
    expect(cand.warnings.length).toBe(1);
    const g = candidateToGraph(cand);
    expect(validateGraph(g.graph).filter((i) => i.level === "error")).toHaveLength(0);
  });

  test("repairs truncated JSON", () => {
    const fixed = extractJson(
      '{"title":"x","nodes":[{"id":"a","label":"A"},{"id":"b","label":"B"}],"edges":[{"source_node_id":"a","target_node_id":"b","label":"re',
    ) as { nodes: unknown[] };
    expect(fixed.nodes).toHaveLength(2);
    expect(repairJson('{"a":[1,{"b":"c')).toBe('{"a":[1,{"b":"c"}]}');
  });
});
