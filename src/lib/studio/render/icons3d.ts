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
  | "orb";

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
  // Agents are neural cubes; models stay crystals.
  agent: "cube",
  subagent: "cube",
  evaluator: "cube",
  extractor: "cube",
  translator: "cube",
  clarifier: "cube",
  reranker: "cube",
  copilot: "cube",
  kiro: "cube",
  // Frameworks & orchestration: gears and hubs.
  orchestrator: "gear",
  planner: "gear",
  router: "gear",
  workflow: "gear",
  statemachine: "gear",
  dag: "gear",
  parallel: "gear",
  langgraph: "gear",
  langchain: "gear",
  llamaindex: "gear",
  autogen: "gear",
  crewai: "gear",
  semantickernel: "gear",
  agentframework: "gear",
  n8n: "gear",
  airflow: "gear",
  // Agent mechanics: directive scrolls and isolation chambers.
  steering: "scroll",
  prompts: "scroll",
  skills: "scroll",
  hooks: "gear",
  memory: "cylinder",
  sandbox: "glass",
  cli: "glass",
  // Humans and observability: orbs (avatar heads, radar spheres).
  user: "orb",
  hitl: "orb",
  observability: "orb",
  tracing: "orb",
  langsmith: "orb",
  arize: "orb",
  dashboard: "glass",
  // Data brands keep the lattice cylinder; caches too.
  cache: "cylinder",
  semanticcache: "cylinder",
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

/** Human-readable label for gallery / tooltips. */
export function iconTitle(icon: string): string {
  const brand = brandFor(icon);
  if (brand) return brand.title;
  if (icon.startsWith("mono:")) return icon.slice(5);
  return icon.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
}
