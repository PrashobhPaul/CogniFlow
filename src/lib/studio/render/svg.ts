import { CHIP, NODE, lockedDuration, type Scene, type SceneEdge, type SceneNode } from "../scene";
import { FONT_MONO, FONT_SANS, hexWithAlpha } from "../theme";
import { icon3dMarkup } from "./icons3d";
import { nodeOverlayMarkup } from "./motion";

/**
 * Scene → SVG. Static or SMIL-animated, optionally focused on one connector
 * (used for storyboard slides). This is the single visual definition shared by
 * every exporter: GIF/video frames rasterise the static output of this file and
 * overlay particles at the positions the same SMIL timing would produce.
 */

export interface SvgOptions {
  animated: boolean;
  /** When set, particle timings are snapped so the animation loops seamlessly every N seconds. */
  loopSeconds?: number | undefined;
  /** Storyboard mode: highlight this connector, dim the rest, freeze particles along it. */
  focusEdgeId?: string | undefined;
  /** Omit particles entirely (frame painters draw their own). */
  particles?: boolean;
  /** Draw only background layers (used by frame painters for layering). */
  layer?: "all" | "background" | "foreground";
  /**
   * Draw component motion overlays and the executing spinner. Frame painters
   * turn this off for their static layer and paint those parts per frame.
   */
  nodeMotion?: boolean;
}

export const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const r2 = (v: number) => Math.round(v * 100) / 100;

export function sceneToSvg(scene: Scene, opts: SvgOptions): string {
  const t = scene.theme;
  const focus = opts.focusEdgeId;
  const drawParticles = opts.particles ?? true;
  const focusEdge = focus ? scene.edges.find((e) => e.id === focus) : undefined;
  const focusNodes = new Set(focusEdge ? [focusEdge.sourceId, focusEdge.targetId] : []);

  const defs: string[] = [];
  defs.push(
    `<marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${t.foreground}" opacity="0.6" /></marker>`,
  );
  defs.push(
    `<radialGradient id="bg-glow" cx="0.3" cy="0" r="0.7"><stop offset="0" stop-color="${t.backgroundGlow}" stop-opacity="0.07" /><stop offset="1" stop-color="${t.backgroundGlow}" stop-opacity="0" /></radialGradient>`,
  );
  defs.push(
    `<filter id="node-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="${t.id === "studio" ? 0.35 : 0.12}" /></filter>`,
  );
  defs.push(
    `<filter id="edge-glow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${focusEdge?.color ?? t.foreground}" flood-opacity="0.9" /></filter>`,
  );
  const glowIds = new Set<string>();
  for (const e of scene.edges) {
    if (glowIds.has(e.semantic)) continue;
    glowIds.add(e.semantic);
    defs.push(
      `<filter id="glow-${e.semantic}" x="-100%" y="-100%" width="300%" height="300%"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${e.color}" flood-opacity="0.9" /></filter>`,
    );
  }
  if (scene.grid) {
    defs.push(
      `<pattern id="grid-dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="#91919a" /></pattern>`,
    );
  }
  for (const n of scene.nodes) {
    defs.push(
      `<clipPath id="clip-${esc(n.id)}"><rect x="${r2(n.x)}" y="${r2(n.y)}" width="${n.w}" height="${n.h}" rx="${NODE.radius}" /></clipPath>`,
    );
  }

  const bg: string[] = [];
  bg.push(`<rect width="${scene.width}" height="${scene.height}" fill="${t.background}" />`);
  bg.push(`<rect width="${scene.width}" height="${scene.height}" fill="url(#bg-glow)" />`);
  if (scene.grid) {
    bg.push(
      `<rect x="0" y="${scene.contentTop}" width="${scene.width}" height="${scene.contentBottom - scene.contentTop}" fill="url(#grid-dots)" opacity="${t.id === "studio" ? 0.5 : 0.7}" />`,
    );
  }
  if (scene.title) bg.push(renderTitle(scene));
  if (scene.legendBandH) bg.push(renderLegend(scene));
  if (scene.watermark) {
    bg.push(
      `<text x="${scene.width - 16}" y="${scene.height - 12}" text-anchor="end" fill="${t.muted}" fill-opacity="0.8" font-size="9" font-family="${FONT_MONO}" letter-spacing="1">${esc(scene.watermark)}</text>`,
    );
  }

  const edgeLayer: string[] = [];
  const chipLayer: string[] = [];
  const motionLayer: string[] = [];
  for (const e of scene.edges) {
    const isFocus = focus === e.id;
    const dimmed = !!focus && !isFocus;
    const baseOpacity = e.enabled ? 0.55 : 0.2;
    const opacity = dimmed ? 0.12 : isFocus ? 1 : baseOpacity;
    edgeLayer.push(
      `<path id="p_${esc(e.id)}" d="${e.d}" fill="none" stroke="${e.color}" stroke-width="${isFocus ? 2.4 : 1.4}" opacity="${opacity}" marker-end="url(#flow-arrow)"${isFocus ? ' filter="url(#edge-glow)"' : ""} />`,
    );
    if (e.chip) chipLayer.push(renderChip(scene, e, dimmed ? 0.3 : 1));
    if (e.step !== null) chipLayer.push(renderStepBadge(scene, e, dimmed ? 0.3 : 1));

    if (!drawParticles || !e.motion) continue;
    if (focus) {
      if (!isFocus) continue;
      // Frozen packets along the focused connector so a still frame still reads as motion.
      const count = Math.max(2, Math.min(6, e.motion.density));
      for (let k = 0; k < count; k++) {
        const p = e.sampler.pointAt((k + 0.5) / count);
        motionLayer.push(
          `<circle cx="${r2(p.x)}" cy="${r2(p.y)}" r="${e.motion.size}" fill="${e.color}" filter="url(#glow-${e.semantic})" />`,
        );
      }
      continue;
    }
    if (!opts.animated) continue;
    const dur = opts.loopSeconds
      ? lockedDuration(e.motion.dur, e.motion.density, opts.loopSeconds)
      : e.motion.dur;
    const dirs: boolean[] =
      e.direction === "bidirectional" ? [false, true] : [e.direction === "reverse"];
    for (const reverse of dirs) {
      for (let i = 0; i < e.motion.density; i++) {
        motionLayer.push(
          `<circle r="${e.motion.size}" fill="${e.color}" filter="url(#glow-${e.semantic})"${reverse && e.direction === "bidirectional" ? ' opacity="0.75"' : ""}><animateMotion dur="${r2(dur)}s" begin="${r2((-i * dur) / e.motion.density)}s" repeatCount="indefinite" keyPoints="${reverse ? "1;0" : "0;1"}" keyTimes="0;1" calcMode="linear"><mpath href="#p_${esc(e.id)}" /></animateMotion></circle>`,
        );
      }
    }
  }

  const nodeLayer = scene.nodes.map((n) =>
    renderNode(scene, n, focus ? (focusNodes.has(n.id) ? 1 : 0.45) : 1, {
      animated: opts.animated && !focus,
      loopSeconds: opts.loopSeconds,
      motionLayer: opts.nodeMotion ?? true,
    }),
  );

  const layer = opts.layer ?? "all";
  const body =
    layer === "background"
      ? bg.join("")
      : layer === "foreground"
        ? edgeLayer.join("") + nodeLayer.join("") + chipLayer.join("") + motionLayer.join("")
        : bg.join("") +
          edgeLayer.join("") +
          nodeLayer.join("") +
          chipLayer.join("") +
          motionLayer.join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" font-family="${FONT_SANS}"><defs>${defs.join("")}</defs>${body}</svg>`;
}

function renderNode(
  scene: Scene,
  n: SceneNode,
  opacity: number,
  motion: { animated: boolean; loopSeconds: number | undefined; motionLayer: boolean },
): string {
  const t = scene.theme;
  const x = r2(n.x);
  const y = r2(n.y);
  const textX = x + NODE.borderL + NODE.padX + NODE.iconBox + NODE.gap;
  const textBlockH = NODE.labelLH + (n.subtitle ? NODE.subLH : 0);
  const contentH = Math.max(NODE.iconBox, textBlockH);
  const contentTop =
    y + NODE.border + NODE.padY + (n.h - NODE.border * 2 - NODE.padY * 2 - contentH) / 2;
  const iconTop = contentTop + (contentH - NODE.iconBox) / 2;
  const textTop = contentTop + (contentH - textBlockH) / 2;
  const labelBaseline = textTop + (NODE.labelLH - NODE.labelSize) / 2 + NODE.labelSize * 0.8;
  const subBaseline = textTop + NODE.labelLH + (NODE.subLH - NODE.subSize) / 2 + NODE.subSize * 0.8;
  const iconX = x + NODE.borderL + NODE.padX;
  const icon = icon3dMarkup({
    icon: n.icon,
    category: n.category,
    accent: n.accent,
    shape: n.shape,
    size: NODE.iconBox,
    x: r2(iconX),
    y: r2(iconTop),
  });
  const overlay = nodeOverlayMarkup({
    motion: n.motion,
    status: n.status,
    accent: n.accent,
    statusColor: n.statusColor,
    bg: t.card,
    size: NODE.iconBox,
    x: r2(iconX),
    y: r2(iconTop),
    period: motion.loopSeconds ? lockedDuration(n.period, 1, motion.loopSeconds) : n.period,
    animated: motion.animated,
    motionLayer: motion.motionLayer,
  });
  const cardFill = t.id === "studio" ? hexWithAlpha(t.card, 0.95) : t.card;
  return [
    `<g opacity="${opacity}">`,
    `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${NODE.radius}" fill="${cardFill}" stroke="${hexWithAlpha(t.cardBorder, 0.7)}" stroke-width="1" filter="url(#node-shadow)" />`,
    `<rect x="${x}" y="${y}" width="${NODE.borderL}" height="${n.h}" fill="${n.accent}" clip-path="url(#clip-${esc(n.id)})" />`,
    icon,
    overlay,
    `<text x="${r2(textX)}" y="${r2(labelBaseline)}" fill="${t.foreground}" font-size="${NODE.labelSize}" font-weight="600" letter-spacing="-0.2">${esc(n.label)}</text>`,
    n.subtitle
      ? `<text x="${r2(textX)}" y="${r2(subBaseline)}" fill="${t.muted}" font-size="${NODE.subSize}" font-family="${FONT_MONO}" letter-spacing="${NODE.subTracking}">${esc(n.subtitle.toUpperCase())}</text>`
      : "",
    `</g>`,
  ].join("");
}

function renderChip(scene: Scene, e: SceneEdge, opacity: number): string {
  const t = scene.theme;
  const c = e.chip!;
  const x = r2(c.x);
  const y = r2(c.y);
  const baseline =
    y + CHIP.border + CHIP.padY + (CHIP.lineH - CHIP.fontSize) / 2 + CHIP.fontSize * 0.8;
  const protoX = x + CHIP.border + CHIP.padX;
  const sepX = protoX + c.protoW + CHIP.gap;
  const labelX = sepX + 1 + CHIP.gap;
  const chipBg = t.id === "studio" ? hexWithAlpha(t.chipBg, 0.85) : t.chipBg;
  return [
    `<g opacity="${opacity}">`,
    `<rect x="${x}" y="${y}" width="${r2(c.w)}" height="${r2(c.h)}" rx="${CHIP.radius}" fill="${chipBg}" stroke="${hexWithAlpha(t.chipBorder, 0.6)}" stroke-width="1" />`,
    `<text x="${r2(protoX)}" y="${r2(baseline)}" fill="${e.color}" font-size="${CHIP.fontSize}" font-family="${FONT_MONO}">${esc(e.protocol)}</text>`,
    `<rect x="${r2(sepX)}" y="${r2(y + (c.h - 10) / 2)}" width="1" height="10" fill="${t.chipBorder}" />`,
    `<text x="${r2(labelX)}" y="${r2(baseline)}" fill="${e.color}" font-size="${CHIP.fontSize}" letter-spacing="-0.1">${esc(e.label ?? "")}</text>`,
    `</g>`,
  ].join("");
}

function renderStepBadge(scene: Scene, e: SceneEdge, opacity: number): string {
  const t = scene.theme;
  const r = 9;
  const cx = e.chip ? e.chip.x - r - 2 : e.labelX;
  const cy = e.chip ? e.chip.y + e.chip.h / 2 : e.labelY;
  return `<g opacity="${opacity}"><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r}" fill="${e.color}" stroke="${t.background}" stroke-width="1.5" /><text x="${r2(cx)}" y="${r2(cy + 3.4)}" text-anchor="middle" fill="${t.background}" font-size="10" font-weight="700" font-family="${FONT_MONO}">${e.step}</text></g>`;
}

function renderTitle(scene: Scene): string {
  const t = scene.theme;
  const pad = 24;
  const parts = [
    `<rect x="0" y="0" width="${scene.width}" height="${scene.titleBandH}" fill="${t.titleBand}" />`,
    `<rect x="0" y="${scene.titleBandH - 1}" width="${scene.width}" height="1" fill="${hexWithAlpha(t.cardBorder, 0.7)}" />`,
    `<rect x="${pad}" y="22" width="4" height="20" rx="2" fill="${t.flow.request}" />`,
    `<text x="${pad + 14}" y="38" fill="${t.foreground}" font-size="18" font-weight="600" letter-spacing="-0.3">${esc(scene.title ?? "")}</text>`,
  ];
  if (scene.subtitle) {
    parts.push(
      `<text x="${scene.width - pad}" y="38" text-anchor="end" fill="${t.muted}" font-size="11" font-family="${FONT_MONO}" letter-spacing="1.2">${esc(scene.subtitle.toUpperCase())}</text>`,
    );
  }
  return parts.join("");
}

function renderLegend(scene: Scene): string {
  const t = scene.theme;
  const y = scene.height - scene.legendBandH;
  const cy = y + scene.legendBandH / 2;
  const parts = [
    `<rect x="0" y="${y}" width="${scene.width}" height="${scene.legendBandH}" fill="${t.titleBand}" />`,
    `<rect x="0" y="${y}" width="${scene.width}" height="1" fill="${hexWithAlpha(t.cardBorder, 0.7)}" />`,
  ];
  let x = 24;
  for (const item of scene.legend) {
    parts.push(
      `<line x1="${x}" y1="${cy}" x2="${x + 22}" y2="${cy}" stroke="${item.color}" stroke-width="1.6" opacity="0.7" />`,
      `<circle cx="${x + 11}" cy="${cy}" r="3" fill="${item.color}" />`,
      `<text x="${x + 30}" y="${r2(cy + 4)}" fill="${t.muted}" font-size="11">${esc(item.semantic)}</text>`,
    );
    x += 34 + measure(item.semantic) + 18;
  }
  return parts.join("");
}

let ctx: CanvasRenderingContext2D | null | undefined;
function measure(text: string): number {
  if (ctx === undefined)
    ctx =
      typeof document === "undefined"
        ? null
        : (document.createElement("canvas").getContext("2d") ?? null);
  if (!ctx) return text.length * 6.4;
  ctx.font = `11px ${FONT_SANS}`;
  return ctx.measureText(text).width;
}
