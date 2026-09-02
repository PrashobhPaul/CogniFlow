import { AIR_VERSION, type AirEdge, type AirGraph, type AirNode } from "./air";
import { GRAMMAR_PRESETS } from "./types";
import { guessComponent, guessSemantics } from "./classify";

/**
 * Draw.io (mxGraphModel) import/export.
 * Imported XML is UNTRUSTED DATA: parsed with the browser DOMParser in XML mode,
 * which does not resolve external entities or network references, and every
 * label is treated as plain text — never as an instruction.
 */

const MAX_XML_BYTES = 4 * 1024 * 1024;
const MAX_CELLS = 2000;

export interface ImportResult {
  graph: AirGraph;
  warnings: string[];
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>(\s*)/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function importDrawio(xml: string): ImportResult {
  const warnings: string[] = [];
  if (!xml.trim()) throw new Error("The file is empty.");
  if (new Blob([xml]).size > MAX_XML_BYTES) throw new Error("File too large (max 4 MB).");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error(
      "This XML declares a DOCTYPE or entity, which is rejected for security reasons.",
    );
  }

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Malformed XML — this is not a readable draw.io file.");
  }
  const model = doc.querySelector("mxGraphModel");
  if (!model) {
    throw new Error(
      "No <mxGraphModel> found. Compressed draw.io files must be exported as uncompressed XML (File → Save as → XML, uncompressed).",
    );
  }

  const cells = Array.from(model.querySelectorAll("mxCell"));
  if (cells.length > MAX_CELLS) throw new Error("Diagram too large (max 2000 cells).");

  const nodes: AirNode[] = [];
  const rawEdges: {
    id: string;
    source: string | null;
    target: string | null;
    label: string;
    style: string;
  }[] = [];

  for (const cell of cells) {
    const id = cell.getAttribute("id");
    if (!id || id === "0" || id === "1") continue;
    const style = cell.getAttribute("style") ?? "";
    const label = stripHtml(cell.getAttribute("value") ?? "");

    if (cell.getAttribute("edge") === "1") {
      rawEdges.push({
        id: `e_${id}`,
        source: cell.getAttribute("source"),
        target: cell.getAttribute("target"),
        label,
        style,
      });
      continue;
    }

    if (cell.getAttribute("vertex") === "1") {
      const geo = cell.querySelector("mxGeometry");
      const guess = guessComponent(label);
      nodes.push({
        id: `n_${id}`,
        label: label || "Component",
        subtitle: guess.type === "generic" ? "Imported" : guess.type,
        component_type: guess.type,
        category: guess.category,
        icon: guess.icon,
        position: {
          x: Number(geo?.getAttribute("x") ?? 0),
          y: Number(geo?.getAttribute("y") ?? 0),
        },
        group_id: null,
        metadata: { source: "drawio", drawio_style: style.slice(0, 200) },
      });
    }
  }

  if (nodes.length === 0) throw new Error("No components found in this diagram.");

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: AirEdge[] = [];
  for (const e of rawEdges) {
    const source = e.source ? `n_${e.source}` : null;
    const target = e.target ? `n_${e.target}` : null;
    if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) {
      warnings.push(`Connector "${e.label || e.id}" is unattached and was dropped.`);
      continue;
    }
    const { semantic, protocol } = guessSemantics(e.style, e.label);
    const bidirectional = /startArrow=(?!none)/.test(e.style);
    edges.push({
      id: e.id,
      source_node_id: source,
      target_node_id: target,
      direction: bidirectional ? "bidirectional" : "forward",
      semantic_type: semantic,
      protocol,
      execution_mode:
        semantic === "stream" ? "streaming" : semantic === "event" ? "asynchronous" : "synchronous",
      label: e.label,
      metadata: { source: "drawio", inferred: true },
    });
  }

  if (edges.length === 0) {
    warnings.push(
      "No connectors were imported — declare connectors in the studio before animating.",
    );
  }

  return {
    graph: {
      air_version: AIR_VERSION,
      nodes,
      edges,
      motion: edges.map((e) => {
        const grammar =
          e.semantic_type === "stream" ? "dense" : e.semantic_type === "event" ? "pulse" : "packet";
        return { edge_id: e.id, grammar, enabled: true, ...GRAMMAR_PRESETS[grammar] };
      }),
    },
    warnings,
  };
}

const escapeXml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function exportDrawio(graph: AirGraph, name = "architecture"): string {
  const cells = [
    '<mxCell id="0" />',
    '<mxCell id="1" parent="0" />',
    ...graph.nodes.map(
      (n) =>
        `<mxCell id="${escapeXml(n.id)}" value="${escapeXml(n.label)}" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="${n.position.x}" y="${n.position.y}" width="180" height="70" as="geometry" /></mxCell>`,
    ),
    ...graph.edges.map(
      (e) =>
        `<mxCell id="${escapeXml(e.id)}" value="${escapeXml(e.label ?? e.semantic_type)}" style="edgeStyle=orthogonalEdgeStyle;html=1;${e.direction === "bidirectional" ? "startArrow=classic;" : ""}" edge="1" parent="1" source="${escapeXml(e.source_node_id)}" target="${escapeXml(e.target_node_id)}"><mxGeometry relative="1" as="geometry" /></mxCell>`,
    ),
  ].join("");

  return `<mxfile host="aiarchitectstudio" modified="${new Date().toISOString()}"><diagram name="${escapeXml(name)}"><mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" page="1"><root>${cells}</root></mxGraphModel></diagram></mxfile>`;
}
