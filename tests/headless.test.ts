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

  test("a trailing ': label' on an arrow labels the connector, not the node", () => {
    const res = compile({ text: "ingestion pipeline -> vector index : vectors" });
    // The label must not fuse into the target's name.
    expect(res.graph.nodes.some((n) => /vectors/i.test(n.label))).toBe(false);
    expect(res.graph.nodes.some((n) => /^vector index$/i.test(n.label))).toBe(true);
    expect(res.graph.edges[0]!.label).toBe("vectors");
  });

  test("'# Lane' headers group the nodes that follow into stacked, non-overlapping lanes", () => {
    const res = compile({
      text: `Pipeline:
# Content Pipeline
Nova QMS -> Intake -> Bedrock KB Sync
# Grounded Answering
Retrieve -> Generate
Bedrock KB Sync -> Retrieve : vectors`,
    });
    expect(res.warnings).toHaveLength(0);
    expect(res.graph.groups?.map((g) => g.label).sort()).toEqual([
      "Content Pipeline",
      "Grounded Answering",
    ]);
    // Every declared node carries its lane id.
    const kb = res.graph.nodes.find((n) => /bedrock kb sync/i.test(n.label))!;
    const retrieve = res.graph.nodes.find((n) => /^retrieve$/i.test(n.label))!;
    expect(kb.group_id).toBe("content_pipeline");
    expect(retrieve.group_id).toBe("grounded_answering");
    // Lanes are stacked: the answering lane sits entirely below the pipeline lane.
    const laneY = (id: string) =>
      res.graph.nodes.filter((n) => n.group_id === id).map((n) => n.position.y);
    expect(Math.min(...laneY("grounded_answering"))).toBeGreaterThan(
      Math.max(...laneY("content_pipeline")),
    );
    // And the lanes render as titled containers.
    const svg = exportGraph(res.graph, "svg_animated");
    expect(svg).toContain("CONTENT PIPELINE");
    expect(svg).toContain("GROUNDED ANSWERING");
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

describe("review regression fixes", () => {
  test("mermaid: ids that change under slugging keep their subgraph", () => {
    const res = importMermaid(`flowchart LR
  subgraph Zone-1 [Edge Zone]
    Svc-A[Service A]
  end
  Svc-A --> DB[(Store)]`);
    const svc = res.graph.nodes.find((n) => n.label === "Service A")!;
    expect(svc.group_id).toBe("Zone-1");
  });

  test("mermaid: '&' inside a bracket label is not a fan-out", () => {
    const res = importMermaid(`flowchart LR
  a["Fish & Chips"] --> b[Out]
  c[C] & d[D] --> e[E]`);
    expect(res.graph.nodes.find((n) => n.id === "a")!.label).toBe("Fish & Chips");
    expect(res.graph.edges.length).toBe(3);
  });

  test("mermaid: semicolon-terminated lines import normally", () => {
    const res = importMermaid("flowchart LR;\n  a[A] --> b[B];\n  b --> c[C];");
    expect(res.graph.edges.length).toBe(2);
  });

  test("mermaid: quoted subgraph titles keep the group stack balanced", () => {
    const res = importMermaid(`flowchart LR
  subgraph "Retrieval Zone"
    a[A]
  end
  subgraph g2 [Second]
    b[B]
  end
  a --> b`);
    expect(res.graph.nodes.find((n) => n.id === "a")!.group_id).toBe("group_1");
    expect(res.graph.nodes.find((n) => n.id === "b")!.group_id).toBe("g2");
  });

  test("mermaid: a node referenced before its subgraph declaration joins the group", () => {
    const res = importMermaid(`flowchart LR
  x --> y
  subgraph g [G]
    y[Why]
  end`);
    expect(res.graph.nodes.find((n) => n.id === "y")!.group_id).toBe("g");
  });

  test("mermaid: exported labels with pipes and dashes re-import cleanly", () => {
    const first = importMermaid(`flowchart LR
  a["left | right -- mid"] --> b[B]`);
    const round = importMermaid(exportMermaid(first.graph));
    expect(round.graph.nodes.length).toBe(2);
    expect(round.graph.edges.length).toBe(1);
  });

  test("repairJson recounts brackets after stripping a partial element", () => {
    const fixed = extractJson('{"nodes":[{"id":"a"},{"id":"b","label"') as { nodes: unknown[] };
    expect(fixed.nodes).toHaveLength(2);
  });

  test("parseDsl caps overlong ids to the candidate schema limit", () => {
    const longId = "x".repeat(100);
    const cand = parseDsl(`${longId} = Big [web]\n${longId} -> llm : p | request | REST`);
    for (const n of cand.nodes) expect(n.id.length).toBeLessThanOrEqual(64);
    const g = candidateToGraph(cand);
    expect(validateGraph(g.graph).filter((i) => i.level === "error")).toHaveLength(0);
  });

  test("group lanes and node detail lines render into the exported SVG", () => {
    const graph = {
      air_version: 1 as const,
      groups: [
        { id: "ingest", label: "Content Pipeline", color: "#E8892B" },
        { id: "answer", label: "Grounded Answering" },
      ],
      nodes: [
        {
          id: "kb",
          label: "Bedrock KB Sync",
          component_type: "vectordb",
          category: "data",
          icon: "vectordb",
          position: { x: 0, y: 0 },
          group_id: "ingest",
          details: ["Titan Embeddings V2", "incremental sync"],
        },
        {
          id: "retrieve",
          label: "Retrieve",
          component_type: "search",
          category: "data",
          icon: "search",
          position: { x: 360, y: 0 },
          group_id: "answer",
          details: ["hybrid search"],
        },
      ],
      edges: [
        {
          id: "e1",
          source_node_id: "kb",
          target_node_id: "retrieve",
          direction: "forward" as const,
          semantic_type: "retrieval" as const,
          protocol: "gRPC",
          execution_mode: "synchronous" as const,
        },
      ],
      motion: [
        {
          edge_id: "e1",
          grammar: "stream" as const,
          speed: 1.6,
          density: 9,
          size: 2.6,
          enabled: true,
        },
      ],
    };
    // Valid AIR (groups + details are accepted by the schema).
    expect(validateGraph(graph).filter((i) => i.level === "error")).toHaveLength(0);
    const svg = exportGraph(graph, "svg_animated");
    // Both lane titles are drawn (uppercased), a themed default colour is used
    // for the group that declared none, and a detail line reaches the output.
    expect(svg).toContain("CONTENT PIPELINE");
    expect(svg).toContain("GROUNDED ANSWERING");
    expect(svg).toContain("#E8892B");
    expect(svg).toContain("Titan Embeddings V2");
  });
});
