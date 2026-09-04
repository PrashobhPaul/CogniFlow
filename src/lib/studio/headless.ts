import { graphHash, validateGraph, type AirGraph, type ValidationIssue } from "./air";
import { compileDescription } from "./compiler";
import { exportDrawio } from "./drawio";
import { autoLayout } from "./layout";
import { exportMermaid, importMermaid } from "./mermaid";
import { matchPattern, PATTERNS } from "./samples";
import { buildScene, type SceneOptions } from "./scene";
import { sceneToSvg } from "./render/svg";
import { buildStory, type StoryStep } from "./story";

/**
 * Node-safe compile / render API. Imports only DOM-free modules, so the same
 * pipeline that powers the studio runs in the MCP server, CLI scripts and
 * tests. (importDrawio needs DOMParser and stays browser-only.)
 */

export interface HeadlessCompileResult {
  graph: AirGraph;
  title: string | undefined;
  engine: string;
  warnings: string[];
  issues: ValidationIssue[];
  hash: string;
  story: StoryStep[];
}

export function compile(input: { text?: string; mermaid?: string }): HeadlessCompileResult {
  let graph: AirGraph;
  let title: string | undefined;
  let engine: string;
  let warnings: string[] = [];
  if (input.mermaid) {
    const res = importMermaid(input.mermaid);
    graph = res.graph;
    title = res.title ?? undefined;
    warnings = res.warnings;
    engine = "mermaid parser";
  } else if (input.text) {
    const res = compileDescription(input.text);
    graph = res.graph;
    title = res.title;
    warnings = res.warnings;
    engine = `rule-based compiler · ${res.statements} statements`;
  } else {
    throw new Error("Provide `text` (a description) or `mermaid` (a flowchart).");
  }
  return {
    graph,
    title,
    engine,
    warnings,
    issues: validateGraph(graph),
    hash: graphHash(graph),
    story: buildStory(graph),
  };
}

export type ExportFormat = "air" | "mermaid" | "drawio" | "svg" | "svg_animated";

export function exportGraph(
  graph: AirGraph,
  format: ExportFormat,
  opts: { name?: string; scene?: SceneOptions } = {},
): string {
  switch (format) {
    case "air":
      return JSON.stringify(graph, null, 2);
    case "mermaid":
      return exportMermaid(graph, opts.name);
    case "drawio":
      return exportDrawio(graph, opts.name ?? "architecture");
    case "svg":
    case "svg_animated": {
      const scene = buildScene(autoLayoutIfUnplaced(graph), {
        title: opts.name,
        legend: true,
        stepNumbers: true,
        // Kept as a literal (not BRAND) so this module stays Node-safe.
        watermark: "CogniFlow · Prashobh Paul",
        ...opts.scene,
      });
      return sceneToSvg(scene, { animated: format === "svg_animated", loopSeconds: 6 });
    }
  }
}

/** Graphs authored by tools often have every node at (0,0); lay those out. */
function autoLayoutIfUnplaced(graph: AirGraph): AirGraph {
  const placed = graph.nodes.some((n) => n.position.x !== 0 || n.position.y !== 0);
  return placed ? graph : autoLayout(graph);
}

export { matchPattern, PATTERNS };
