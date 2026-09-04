import { Position, getBezierPath, getSmoothStepPath, getStraightPath } from "@xyflow/react";
import type { AirGraph } from "./air";
import { validateGraph, isExportable } from "./air";
import { EXPORT_THEMES, FONT_MONO, FONT_SANS, type ExportTheme, type ExportThemeId } from "./theme";
import { buildStory, type StoryStep } from "./story";
import { samplePath, type PathSampler } from "./render/path";
import { shapeFor, type IconShape } from "./render/icons3d";
import {
  NODE_MOTION_PERIOD,
  motionForShape,
  resolveStatus,
  statusColor,
  type NodeMotion,
  type ResolvedStatus,
} from "./render/motion";
import type { NodeCategory, SemanticType } from "./types";
import { CATEGORY_LABEL } from "./types";

/**
 * Scene = the AIR graph resolved to the exact geometry the studio canvas draws:
 * same node metrics as `.arch-node`, same React Flow smoothstep connector paths,
 * same label chips and particle timing. Every exporter (SVG, GIF, MP4/WebM,
 * PPTX) renders from this one structure, so files match the page.
 */

// `.arch-node` metrics from styles.css / ArchNode.tsx (Tailwind v4 defaults).
export const NODE = {
  minW: 190,
  padX: 14,
  padY: 12,
  borderL: 3,
  border: 1,
  iconBox: 32,
  iconSize: 32,
  gap: 12,
  labelSize: 14,
  labelLH: 20,
  subSize: 10,
  subLH: 15,
  subTracking: 1.4, // 0.14em × 10px
  radius: 12,
} as const;

// Body-line ("details") metrics for container nodes.
export const DETAIL = {
  size: 11,
  lh: 16,
  gapTop: 4,
} as const;

// Group/lane container metrics.
export const GROUP = {
  pad: 22,
  header: 34,
  radius: 14,
  titleSize: 13,
} as const;

// `.edge-chip` metrics.
export const CHIP = {
  padX: 6,
  padY: 2,
  gap: 6,
  fontSize: 10,
  lineH: 15,
  radius: 6,
  border: 1,
} as const;

export const TITLE_BAND_H = 64;
export const LEGEND_BAND_H = 40;

/** Default lane accents, cycled when a group declares no colour. */
export const GROUP_PALETTE = [
  "#2563EB",
  "#14A38B",
  "#7C3AED",
  "#E8892B",
  "#2E7D32",
  "#C2185B",
] as const;

export interface SceneOptions {
  theme?: ExportThemeId;
  /** Measured DOM sizes from the live canvas (node.measured). Falls back to text measurement. */
  measured?: Map<string, { width: number; height: number }> | undefined;
  showLabels?: boolean;
  speedScale?: number;
  title?: string | undefined;
  subtitle?: string | undefined;
  legend?: boolean;
  stepNumbers?: boolean;
  grid?: boolean;
  watermark?: string | undefined;
  padding?: number;
}

export interface SceneNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  subtitle: string | undefined;
  details: string[];
  icon: string;
  category: NodeCategory;
  accent: string;
  /** 3D medallion base, derived from the component type (see render/icons3d). */
  shape: IconShape;
  /** Component motion grammar, derived from the shape (see render/motion). */
  motion: NodeMotion;
  /** Seconds per motion cycle after speed scaling (loop-locked at render time). */
  period: number;
  /** Resolved status badge (declared, or derived from the connectors). */
  status: ResolvedStatus;
  statusColor: string;
}

export interface SceneEdge {
  id: string;
  sourceId: string;
  targetId: string;
  d: string;
  sampler: PathSampler;
  labelX: number;
  labelY: number;
  color: string;
  semantic: SemanticType;
  protocol: string;
  label: string | undefined;
  direction: "forward" | "reverse" | "bidirectional";
  enabled: boolean;
  motion: { dur: number; density: number; size: number; grammar: string } | null;
  chip: { x: number; y: number; w: number; h: number; protoW: number; labelW: number } | null;
  step: number | null;
}

export interface SceneGroup {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scene {
  width: number;
  height: number;
  theme: ExportTheme;
  groups: SceneGroup[];
  nodes: SceneNode[];
  edges: SceneEdge[];
  steps: StoryStep[];
  legend: { semantic: SemanticType; color: string }[];
  title: string | undefined;
  subtitle: string | undefined;
  watermark: string | undefined;
  grid: boolean;
  showLabels: boolean;
  titleBandH: number;
  legendBandH: number;
  contentTop: number;
  contentBottom: number;
  /** Longest single-traversal duration, useful for choosing a loop length. */
  maxDur: number;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
function measureText(text: string, font: string): number {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === "undefined"
        ? null
        : (document.createElement("canvas").getContext("2d") ?? null);
  }
  if (!measureCtx) return text.length * (Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1]) || 12) * 0.58;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export function labelFont() {
  return `600 ${NODE.labelSize}px ${FONT_SANS}`;
}
export function subFont() {
  return `${NODE.subSize}px ${FONT_MONO}`;
}
export function chipFont(mono: boolean) {
  return `${CHIP.fontSize}px ${mono ? FONT_MONO : FONT_SANS}`;
}
export function detailFont() {
  return `${DETAIL.size}px ${FONT_SANS}`;
}

/** Total height a node's text block needs for label + subtitle + detail lines. */
export function textBlockHeight(
  subtitle: string | undefined,
  details: string[] | undefined,
): number {
  return (
    NODE.labelLH +
    (subtitle ? NODE.subLH : 0) +
    (details && details.length ? DETAIL.gapTop + details.length * DETAIL.lh : 0)
  );
}

/** Same size the DOM would give `.arch-node` for this content. */
export function estimateNodeSize(
  label: string,
  subtitle: string | undefined,
  details?: string[],
): { w: number; h: number } {
  const labelW = measureText(label, labelFont());
  const subW = subtitle
    ? measureText(subtitle.toUpperCase(), subFont()) + subtitle.length * NODE.subTracking
    : 0;
  const detailW = (details ?? []).reduce((m, d) => Math.max(m, measureText(d, detailFont())), 0);
  const textW = Math.max(labelW, subW, detailW);
  const w = Math.max(
    NODE.minW,
    Math.ceil(NODE.borderL + NODE.padX + NODE.iconBox + NODE.gap + textW + NODE.padX + NODE.border),
  );
  const textH = textBlockHeight(subtitle, details);
  const h = NODE.border * 2 + NODE.padY * 2 + Math.max(NODE.iconBox, textH);
  return { w, h };
}

/**
 * Snap a traversal duration so an integer number of particle periods fit into
 * the loop. Keeps GIF/video loops seamless with < a few % speed deviation.
 */
export function lockedDuration(dur: number, density: number, loopSeconds: number): number {
  const period = dur / Math.max(1, density);
  const k = Math.max(1, Math.round(loopSeconds / period));
  return (loopSeconds / k) * Math.max(1, density);
}

export function buildScene(graph: AirGraph, opts: SceneOptions = {}): Scene {
  const issues = validateGraph(graph);
  if (!isExportable(issues)) {
    const errors = issues.filter((i) => i.level === "error");
    throw new Error(
      `Export blocked by ${errors.length} validation error(s): ${errors.map((i) => i.message).join("; ")}`,
    );
  }
  const theme = EXPORT_THEMES[opts.theme ?? "studio"];
  const pad = opts.padding ?? 48;
  const showLabels = opts.showLabels ?? true;
  const speedScale = opts.speedScale ?? 1;
  const titleBandH = opts.title ? TITLE_BAND_H : 0;
  const legendBandH = opts.legend ? LEGEND_BAND_H : 0;

  // 1. Node rects in graph space.
  const rawNodes = graph.nodes.map((n) => {
    const m = opts.measured?.get(n.id);
    const size =
      m && m.width > 0 && m.height > 0
        ? { w: m.width, h: m.height }
        : estimateNodeSize(n.label, n.subtitle, n.details);
    return { n, x: n.position.x, y: n.position.y, ...size };
  });
  const byId = new Map(rawNodes.map((r) => [r.n.id, r]));

  // 1b. Group/lane boxes: bound the members of each declared group in graph space.
  const rawGroups = (graph.groups ?? [])
    .map((g, i) => {
      const members = rawNodes.filter((r) => r.n.group_id === g.id);
      if (members.length === 0) return null;
      let gx1 = Infinity;
      let gy1 = Infinity;
      let gx2 = -Infinity;
      let gy2 = -Infinity;
      for (const r of members) {
        gx1 = Math.min(gx1, r.x);
        gy1 = Math.min(gy1, r.y);
        gx2 = Math.max(gx2, r.x + r.w);
        gy2 = Math.max(gy2, r.y + r.h);
      }
      const color = g.color ?? GROUP_PALETTE[i % GROUP_PALETTE.length]!;
      return {
        id: g.id,
        label: g.label,
        color,
        x: gx1 - GROUP.pad,
        y: gy1 - GROUP.pad - GROUP.header,
        w: gx2 - gx1 + GROUP.pad * 2,
        h: gy2 - gy1 + GROUP.pad * 2 + GROUP.header,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);

  // 2. Edge paths (React Flow smoothstep, right handle → left handle).
  const motionById = new Map(graph.motion.map((m) => [m.edge_id, m]));
  const story = buildStory(graph);
  const stepByEdge = new Map(story.map((s) => [s.edge_id, s.index]));

  const rawEdges = graph.edges.map((e) => {
    const s = byId.get(e.source_node_id)!;
    const t = byId.get(e.target_node_id)!;
    // Must mirror FlowEdge.tsx exactly so exports match the canvas.
    const geom = {
      sourceX: s.x + s.w,
      sourceY: s.y + s.h / 2,
      sourcePosition: Position.Right,
      targetX: t.x,
      targetY: t.y + t.h / 2,
      targetPosition: Position.Left,
    };
    const [d, labelX, labelY] =
      e.path_type === "bezier"
        ? getBezierPath(geom)
        : e.path_type === "straight"
          ? getStraightPath({
              sourceX: geom.sourceX,
              sourceY: geom.sourceY,
              targetX: geom.targetX,
              targetY: geom.targetY,
            })
          : getSmoothStepPath({ ...geom, borderRadius: 18 });
    const motion = motionById.get(e.id);
    const protoW = measureText(e.protocol, chipFont(true));
    const labelW = e.label ? measureText(e.label, chipFont(false)) : 0;
    const chipW = CHIP.border * 2 + CHIP.padX * 2 + protoW + CHIP.gap + 1 + CHIP.gap + labelW;
    const chipH = CHIP.border * 2 + CHIP.padY * 2 + CHIP.lineH;
    const hasChip = showLabels && !!e.label;
    return {
      e,
      d,
      labelX,
      labelY,
      motion,
      chip: hasChip
        ? { x: labelX - chipW / 2, y: labelY - chipH / 2, w: chipW, h: chipH, protoW, labelW }
        : null,
    };
  });

  // 3. Bounds.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x1: number, y1: number, x2: number, y2: number) => {
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  };
  for (const g of rawGroups) grow(g.x, g.y, g.x + g.w, g.y + g.h);
  for (const r of rawNodes) grow(r.x, r.y, r.x + r.w, r.y + r.h);
  for (const r of rawEdges) {
    if (r.chip) grow(r.chip.x - 14, r.chip.y, r.chip.x + r.chip.w, r.chip.y + r.chip.h);
    for (const p of samplePath(r.d).points) grow(p.x, p.y, p.x, p.y);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 400;
    maxY = 200;
  }

  const legendItems = Array.from(new Set(graph.edges.map((e) => e.semantic_type))).map(
    (semantic) => ({
      semantic,
      color: theme.flow[semantic],
    }),
  );
  const legendW = legendItems.reduce(
    (w, item) => w + 34 + measureText(item.semantic, `11px ${FONT_SANS}`) + 18,
    0,
  );
  const titleW = opts.title ? measureText(opts.title, `600 18px ${FONT_SANS}`) + 2 * pad : 0;

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const width = Math.ceil(
    Math.max(contentW + pad * 2, legendBandH ? legendW + pad * 2 : 0, titleW, 320),
  );
  const height = Math.ceil(titleBandH + pad + contentH + pad + legendBandH);
  const offX = (width - contentW) / 2 - minX;
  const offY = titleBandH + pad - minY;

  // 4. Shift into scene space.
  const nodes: SceneNode[] = rawNodes.map((r) => {
    const category = (
      r.n.category in CATEGORY_LABEL ? r.n.category : "application"
    ) as NodeCategory;
    const accent = theme.category[category];
    const shape = shapeFor(r.n.component_type, category);
    const motion = motionForShape(shape);
    const status = resolveStatus(
      r.n.status,
      graph.edges
        .filter((e) => e.source_node_id === r.n.id || e.target_node_id === r.n.id)
        .map((e) => ({
          semantic: e.semantic_type,
          enabled: motionById.get(e.id)?.enabled ?? true,
        })),
    );
    return {
      id: r.n.id,
      x: r.x + offX,
      y: r.y + offY,
      w: r.w,
      h: r.h,
      label: r.n.label,
      subtitle: r.n.subtitle,
      details: r.n.details ?? [],
      icon: r.n.icon,
      category,
      accent,
      shape,
      motion,
      period: NODE_MOTION_PERIOD[motion] / speedScale,
      status,
      statusColor: statusColor(status, theme, accent),
    };
  });

  let maxDur = 0;
  const edges: SceneEdge[] = rawEdges.map((r) => {
    const d = shiftPath(r.d, offX, offY);
    const dur = r.motion ? Math.max(0.2, r.motion.speed / speedScale) : 0;
    maxDur = Math.max(maxDur, dur);
    return {
      id: r.e.id,
      sourceId: r.e.source_node_id,
      targetId: r.e.target_node_id,
      d,
      sampler: samplePath(d),
      labelX: r.labelX + offX,
      labelY: r.labelY + offY,
      color: theme.flow[r.e.semantic_type],
      semantic: r.e.semantic_type,
      protocol: r.e.protocol,
      label: r.e.label,
      direction: r.e.direction,
      enabled: r.motion?.enabled ?? true,
      motion:
        r.motion && r.motion.enabled
          ? { dur, density: r.motion.density, size: r.motion.size, grammar: r.motion.grammar }
          : null,
      chip: r.chip ? { ...r.chip, x: r.chip.x + offX, y: r.chip.y + offY } : null,
      step: opts.stepNumbers ? (stepByEdge.get(r.e.id) ?? null) : null,
    };
  });

  const groups: SceneGroup[] = rawGroups.map((g) => ({
    ...g,
    x: g.x + offX,
    y: g.y + offY,
  }));

  return {
    width,
    height,
    theme,
    groups,
    nodes,
    edges,
    steps: story,
    legend: legendItems,
    title: opts.title,
    subtitle: opts.subtitle,
    watermark: opts.watermark,
    grid: opts.grid ?? false,
    showLabels,
    titleBandH,
    legendBandH,
    contentTop: titleBandH,
    contentBottom: height - legendBandH,
    maxDur,
  };
}

/** Translate every absolute coordinate pair in a path string (React Flow emits absolute commands only). */
export function shiftPath(d: string, dx: number, dy: number): string {
  const tokens = d.match(/[MLHVQCZmlhvqcz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const out: string[] = [];
  let cmd = "";
  let idx = 0;
  const round = (v: number) => Math.round(v * 100) / 100;
  for (const t of tokens) {
    if (/^[A-Za-z]$/.test(t)) {
      cmd = t;
      idx = 0;
      out.push(t);
      continue;
    }
    const v = Number(t);
    const upper = cmd.toUpperCase();
    const relative = cmd !== upper;
    let shifted = v;
    if (!relative) {
      if (upper === "H") shifted = v + dx;
      else if (upper === "V") shifted = v + dy;
      else shifted = idx % 2 === 0 ? v + dx : v + dy;
    }
    out.push(String(round(shifted)));
    idx++;
  }
  return out.join(" ");
}
