import type { AirGraph } from "./air";
import { candidateToGraph, type Candidate, type CandidateResult } from "./candidate";
import { guessSemantics } from "./classify";

/**
 * Deterministic Mermaid flowchart import/export. Pure string parsing (no DOM),
 * so it runs identically in the browser, in the headless compile API and in
 * the MCP server. Imports build a Candidate and reuse candidateToGraph, so
 * ids, classification, protocol defaults, motion grammars and layout match
 * every other entry path.
 */

interface ParsedNode {
  id: string;
  label: string;
  shape: string;
  group: string | null;
}

interface ParsedEdge {
  source: string;
  target: string;
  label: string | undefined;
  bidirectional: boolean;
  dotted: boolean;
  thick: boolean;
}

const NODE_SHAPES: [RegExp, string][] = [
  [/^\(\[(.+)\]\)$/, "stadium"],
  [/^\[\((.+)\)\]$/, "cylinder"],
  [/^\(\((.+)\)\)$/, "circle"],
  [/^\{\{(.+)\}\}$/, "hexagon"],
  [/^\[\[(.+)\]\]$/, "subroutine"],
  [/^\[(.+)\]$/, "rect"],
  [/^\((.+)\)$/, "round"],
  [/^\{(.+)\}$/, "diamond"],
  [/^>(.+)\]$/, "flag"],
];

const unquote = (text: string): string => {
  const t = text.trim();
  const inner = t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
  return inner
    .replace(/<br\s*\/?>/gi, " · ")
    .replace(/\s+/g, " ")
    .trim();
};

/** Split `id[Label]` (any shape) into id + label + shape. */
function parseNodeRef(token: string): ParsedNode | null {
  const t = token.trim();
  const m = t.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*(.*)$/s);
  if (!m) return null;
  const id = m[1]!;
  const rest = m[2]!.trim();
  if (!rest) return { id, label: id, shape: "rect", group: null };
  for (const [re, shape] of NODE_SHAPES) {
    const sm = rest.match(re);
    if (sm) return { id, label: unquote(sm[1]!), shape, group: null };
  }
  return null;
}

export interface MermaidImportResult extends CandidateResult {
  title: string | undefined;
}

// Edge operator: --> , --- , -.-> , ==> , <--> , --x etc., with optional |label|
const EDGE_RE =
  /^(?<lhs>.+?)\s*(?<back><)?(?<line>-{2,3}|={2,3}|-\.+-?)\s*(?<head>>|x|o)?\s*(?:\|(?<label>[^|]*)\|)?\s*(?<rhs>.+)$/;
// `A -- label --> B` older syntax
const EDGE_MID_LABEL_RE = /^(?<lhs>.+?)\s*--\s*(?<label>[^-<>=|]+?)\s*(?:-->|---)\s*(?<rhs>.+)$/;

export function importMermaid(text: string): MermaidImportResult {
  const warnings: string[] = [];
  const nodes = new Map<string, ParsedNode>();
  const edges: ParsedEdge[] = [];
  const groupStack: string[] = [];
  const groupTitles = new Map<string, string>();
  let title: string | undefined;
  let sawHeader = false;

  const ensureNode = (token: string): string | null => {
    const parsed = parseNodeRef(token);
    if (!parsed) return null;
    const existing = nodes.get(parsed.id);
    if (!existing) {
      nodes.set(parsed.id, { ...parsed, group: groupStack[groupStack.length - 1] ?? null });
    } else if (existing.label === existing.id && parsed.label !== parsed.id) {
      existing.label = parsed.label;
      existing.shape = parsed.shape;
    }
    return parsed.id;
  };

  const lines = text.replace(/\r/g, "").split("\n");
  let inFrontmatter = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/%%.*$/, "").trim();
    if (!line) continue;
    if (line === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter && !/^title[:\s]/i.test(line)) continue;
    const header = line.match(/^(graph|flowchart)\s+(TB|TD|BT|LR|RL)?\s*$/i);
    if (header) {
      sawHeader = true;
      continue;
    }
    const titleMatch = line.match(/^title[:\s]+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1]!.trim();
      continue;
    }
    const sub = line.match(/^subgraph\s+([A-Za-z0-9_.-]+)?\s*(?:\[(.+)\])?\s*$/);
    if (sub) {
      const gid = sub[1] ?? `group_${groupTitles.size + 1}`;
      groupStack.push(gid);
      groupTitles.set(gid, unquote(sub[2] ?? sub[1] ?? "Group"));
      continue;
    }
    if (/^end$/i.test(line)) {
      groupStack.pop();
      continue;
    }
    if (/^(classDef|class|style|click|linkStyle|direction|accTitle|accDescr)\b/.test(line)) {
      continue;
    }

    // Chained edges: A --> B --> C. Split on edge operators while keeping them.
    const midLabel = line.match(EDGE_MID_LABEL_RE);
    if (midLabel) {
      const src = ensureNode(midLabel.groups!["lhs"]!);
      const dst = ensureNode(midLabel.groups!["rhs"]!);
      if (src && dst)
        edges.push({
          source: src,
          target: dst,
          label: unquote(midLabel.groups!["label"]!),
          bidirectional: false,
          dotted: false,
          thick: false,
        });
      else warnings.push(`Could not read edge line: "${line.slice(0, 80)}"`);
      continue;
    }

    if (EDGE_RE.test(line)) {
      // Handle chains by splitting on the operators.
      const segments = line.split(/\s*(<?(?:-{2,3}|={2,3}|-\.+-?)(?:>|x|o)?(?:\|[^|]*\|)?)\s*/);
      // segments: [nodeA, op1, nodeB, op2, nodeC, ...]
      let ok = segments.length >= 3 && segments.length % 2 === 1;
      for (let i = 0; ok && i + 2 < segments.length + 1 && i + 1 < segments.length; i += 2) {
        const lhsTokens = segments[i]!.split("&");
        const rhsTokens = segments[i + 2]!.split("&");
        const op = segments[i + 1]!;
        const label = op.match(/\|([^|]*)\|/)?.[1];
        const bidirectional = op.startsWith("<");
        const dotted = /-\./.test(op);
        const thick = /=/.test(op);
        for (const lt of lhsTokens) {
          const src = ensureNode(lt);
          if (!src) {
            ok = false;
            break;
          }
          for (const rt of rhsTokens) {
            const dst = ensureNode(rt);
            if (!dst) {
              ok = false;
              break;
            }
            edges.push({
              source: src,
              target: dst,
              label: label !== undefined ? unquote(label) : undefined,
              bidirectional,
              dotted,
              thick,
            });
          }
        }
      }
      if (ok) continue;
    }

    // Standalone node declaration.
    if (ensureNode(line)) continue;
    warnings.push(`Skipped unrecognised line: "${line.slice(0, 80)}"`);
  }

  if (!sawHeader && nodes.size === 0)
    throw new Error("Not a Mermaid flowchart (no graph/flowchart header and no nodes).");
  if (nodes.size === 0) throw new Error("The Mermaid diagram contains no nodes.");

  const candidate: Candidate = {
    ...(title !== undefined ? { title } : {}),
    nodes: [...nodes.values()].map((n) => ({
      id: n.id,
      label: n.label,
      ...(n.group ? { subtitle: groupTitles.get(n.group) ?? n.group } : {}),
    })),
    edges: edges.map((e, i) => {
      const targetLabel = nodes.get(e.target)?.label ?? e.target;
      const guess = guessSemantics("", `${e.label ?? ""} ${targetLabel}`);
      return {
        id: `e${i + 1}`,
        source_node_id: e.source,
        target_node_id: e.target,
        ...(e.label ? { label: e.label } : {}),
        semantic_type: e.thick ? "stream" : guess.semantic,
        direction: e.bidirectional ? ("bidirectional" as const) : ("forward" as const),
        ...(e.dotted ? { execution_mode: "asynchronous" as const } : {}),
      };
    }),
    warnings: [],
  };

  const result = candidateToGraph(candidate);
  // Carry subgraph membership onto the AIR nodes (group_id survives export).
  const groupOf = new Map([...nodes.values()].map((n) => [n.id, n.group]));
  for (const node of result.graph.nodes) {
    const g = groupOf.get(node.id);
    if (g) node.group_id = g;
  }
  return { ...result, warnings: [...warnings, ...result.warnings], title };
}

const MERMAID_SHAPE_FOR_CATEGORY: Record<string, [string, string]> = {
  data: ["[(", ")]"],
  application: ["([", "])"],
  security: ["{{", "}}"],
};

const escapeLabel = (label: string): string => `"${label.replace(/"/g, "'")}"`;

/** Deterministic export: no timestamps, stable ordering from the graph itself. */
export function exportMermaid(graph: AirGraph, name?: string): string {
  const lines: string[] = [];
  if (name) lines.push(`---`, `title: ${name}`, `---`);
  lines.push("flowchart LR");
  const grouped = new Map<string, string[]>();
  const ungrouped: string[] = [];
  for (const n of graph.nodes) {
    const [open, close] = MERMAID_SHAPE_FOR_CATEGORY[n.category] ?? ["[", "]"];
    const label = n.subtitle ? `${n.label}<br/>${n.subtitle}` : n.label;
    const line = `  ${n.id}${open}${escapeLabel(label)}${close}`;
    if (n.group_id) grouped.set(n.group_id, [...(grouped.get(n.group_id) ?? []), line]);
    else ungrouped.push(line);
  }
  lines.push(...ungrouped);
  for (const [gid, members] of grouped) {
    lines.push(`  subgraph ${gid}`);
    lines.push(...members.map((m) => `  ${m}`));
    lines.push("  end");
  }
  for (const e of graph.edges) {
    const label = e.label ?? `${e.semantic_type} · ${e.protocol}`;
    const arrow =
      e.direction === "bidirectional"
        ? "<-->"
        : e.execution_mode === "asynchronous"
          ? "-.->"
          : e.execution_mode === "streaming"
            ? "==>"
            : "-->";
    lines.push(`  ${e.source_node_id} ${arrow}|${escapeLabel(label)}| ${e.target_node_id}`);
  }
  return lines.join("\n") + "\n";
}
