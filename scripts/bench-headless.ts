import { deflateRawSync } from "node:zlib";
import { airGraphSchema, graphHash, validateGraph, type AirGraph } from "../src/lib/studio/air";
import { compile, exportGraph } from "../src/lib/studio/headless";
import { PALETTE } from "../src/lib/studio/palette";

/**
 * Headless pipeline stress benchmark. Runs the exact compile/layout/render
 * code the studio and the MCP server ship, at increasing graph sizes, and
 * prints timings + output sizes. Reproduce with:
 *   bun run scripts/bench-headless.ts
 */

const SIZES = [50, 100, 250, 500, 1000];
const SHARE_URL_LIMIT = 8000;

function synthGraph(n: number): AirGraph {
  const nodes = Array.from({ length: n }, (_, i) => {
    const p = PALETTE[i % PALETTE.length]!;
    return {
      id: `n${i}`,
      label: `${p.label} ${i}`,
      component_type: p.type,
      category: p.category,
      icon: p.type,
      position: { x: 0, y: 0 },
    };
  });
  const edges = [];
  const semantics = ["request", "data", "event", "stream", "retrieval", "message"] as const;
  const modes = ["synchronous", "asynchronous", "streaming"] as const;
  for (let i = 1; i < n; i++) {
    edges.push({
      id: `e${i}`,
      source_node_id: `n${Math.floor((i - 1) / 3) % n}`,
      target_node_id: `n${i}`,
      direction: "forward" as const,
      semantic_type: semantics[i % semantics.length]!,
      protocol: "REST",
      execution_mode: modes[i % modes.length]!,
    });
  }
  // extra cross edges: ~0.3n
  for (let i = 0; i < Math.floor(n * 0.3); i++) {
    edges.push({
      id: `x${i}`,
      source_node_id: `n${(i * 7) % n}`,
      target_node_id: `n${(i * 13 + 5) % n}`,
      direction: "forward" as const,
      semantic_type: "data" as const,
      protocol: "gRPC",
      execution_mode: "asynchronous" as const,
    });
  }
  const motion = edges.map((e) => ({
    edge_id: e.id,
    grammar: "packet" as const,
    speed: 1,
    density: 3,
    size: 4,
    enabled: true,
  }));
  return airGraphSchema.parse({ air_version: 1, nodes, edges, motion });
}

function ms(fn: () => unknown): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

function median(runs: number, fn: () => unknown): number {
  const times = Array.from({ length: runs }, () => ms(fn)).sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

const kb = (s: string) => Math.round(s.length / 102.4) / 10;

console.log(
  "graph_size  validate  hash   layout+svg_anim  mermaid  drawio  air_kb  svg_kb  share_chars",
);
for (const n of SIZES) {
  const g = synthGraph(n);
  const reps = n <= 250 ? 5 : 3;
  const tValidate = median(reps, () => validateGraph(g));
  const tHash = median(reps, () => graphHash(g));
  let svg = "";
  const tSvg = median(reps, () => (svg = exportGraph(g, "svg_animated", { name: `Bench ${n}` })));
  let mer = "";
  const tMer = median(reps, () => (mer = exportGraph(g, "mermaid")));
  const tDraw = median(reps, () => exportGraph(g, "drawio"));
  const air = JSON.stringify(g);
  const share = deflateRawSync(Buffer.from(JSON.stringify({ t: `Bench ${n}`, g }), "utf8"))
    .toString("base64")
    .replace(/=+$/, "");
  const shareLen = share.length + "https://cogniflow.prashobhpaul.com/studio?d=".length;
  console.log(
    [
      String(n).padEnd(10),
      `${tValidate.toFixed(1)}ms`.padEnd(9),
      `${tHash.toFixed(1)}ms`.padEnd(6),
      `${tSvg.toFixed(1)}ms`.padEnd(16),
      `${tMer.toFixed(1)}ms`.padEnd(8),
      `${tDraw.toFixed(1)}ms`.padEnd(7),
      String(kb(air)).padEnd(7),
      String(kb(svg)).padEnd(7),
      `${shareLen}${shareLen > SHARE_URL_LIMIT ? " (>LIMIT)" : ""}`,
    ].join(" "),
  );
  void mer;
}

// Compiler stress: a 60-statement plain-language description.
const parts: string[] = [];
for (let i = 0; i < 60; i++) parts.push(`service ${i} calls service ${i + 1}`);
const bigText = parts.join("; ");
const tCompile = median(5, () => compile({ text: bigText }));
const compiled = compile({ text: bigText });
console.log(
  `\ncompiler: 60-statement description -> ${compiled.graph.nodes.length} nodes / ${compiled.graph.edges.length} edges in ${tCompile.toFixed(1)}ms`,
);

// Mermaid import stress: re-import the exported 250-node doc.
const merDoc = exportGraph(synthGraph(250), "mermaid");
const tImport = median(3, () => compile({ mermaid: merDoc }));
console.log(`mermaid import: 250-node document (${kb(merDoc)}KB) in ${tImport.toFixed(1)}ms`);
console.log(`peak RSS: ${Math.round(process.memoryUsage().rss / 1048576)}MB`);
