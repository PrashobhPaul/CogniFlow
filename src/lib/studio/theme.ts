import type { NodeCategory, SemanticType } from "./types";

/**
 * Export themes. The "studio" theme is derived from the exact oklch tokens in
 * styles.css so a rendered file looks identical to the canvas; "paper" is a
 * print-friendly light variant. Everything is resolved to hex so SVG, Canvas 2D,
 * GIF palettes and PPTX all agree on the same bytes.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** oklch(L, C, H°) → #rrggbb (sRGB, gamut-clipped). */
export function oklchToHex(l: number, c: number, h: number): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;
  const gamma = (v: number) => {
    const x = clamp01(v);
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  const toHex = (v: number) =>
    Math.round(gamma(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

/** Mix a hex colour with another by ratio (0 → a, 1 → b). */
export function mixHex(a: string, b: string, ratio: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const ch = (i: number) =>
    Math.round(pa[i]! + (pb[i]! - pa[i]!) * ratio)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type ExportThemeId = "studio" | "paper";

export interface ExportTheme {
  id: ExportThemeId;
  label: string;
  background: string;
  backgroundGlow: string;
  grid: string;
  card: string;
  cardBorder: string;
  foreground: string;
  muted: string;
  chipBg: string;
  chipBorder: string;
  chipText: string;
  titleBand: string;
  flow: Record<SemanticType, string>;
  category: Record<NodeCategory, string>;
}

// Exact oklch values from styles.css (Motion Studio theme).
const studioFlow: Record<SemanticType, string> = {
  request: oklchToHex(0.8, 0.14, 200),
  response: oklchToHex(0.82, 0.16, 145),
  data: oklchToHex(0.82, 0.14, 255),
  event: oklchToHex(0.83, 0.16, 85),
  stream: oklchToHex(0.78, 0.17, 320),
  retrieval: oklchToHex(0.84, 0.15, 175),
  embedding: oklchToHex(0.78, 0.16, 300),
  message: oklchToHex(0.85, 0.13, 60),
  file: oklchToHex(0.82, 0.14, 255),
  control: oklchToHex(0.72, 0.02, 255),
  error: oklchToHex(0.68, 0.2, 25),
  retry: oklchToHex(0.78, 0.15, 45),
};

const categoryFromFlow = (flow: Record<SemanticType, string>): Record<NodeCategory, string> => ({
  ai: flow.embedding,
  data: flow.data,
  integration: flow.request,
  security: flow.event,
  application: flow.response,
  cloud: flow.retrieval,
  devops: flow.message,
});

const STUDIO: ExportTheme = {
  id: "studio",
  label: "Studio (matches canvas)",
  background: oklchToHex(0.17, 0.022, 258),
  backgroundGlow: oklchToHex(0.79, 0.14, 195),
  grid: oklchToHex(0.3, 0.026, 258),
  card: oklchToHex(0.213, 0.024, 258),
  cardBorder: oklchToHex(0.3, 0.026, 258),
  foreground: oklchToHex(0.95, 0.008, 250),
  muted: oklchToHex(0.68, 0.02, 254),
  chipBg: oklchToHex(0.17, 0.022, 258),
  chipBorder: oklchToHex(0.3, 0.026, 258),
  chipText: oklchToHex(0.95, 0.008, 250),
  titleBand: oklchToHex(0.195, 0.022, 258),
  flow: studioFlow,
  category: categoryFromFlow(studioFlow),
};

// Same hues, lower lightness / higher chroma so they read on white.
const paperFlow: Record<SemanticType, string> = {
  request: oklchToHex(0.58, 0.14, 200),
  response: oklchToHex(0.58, 0.16, 145),
  data: oklchToHex(0.58, 0.16, 255),
  event: oklchToHex(0.62, 0.16, 85),
  stream: oklchToHex(0.56, 0.19, 320),
  retrieval: oklchToHex(0.58, 0.14, 175),
  embedding: oklchToHex(0.56, 0.18, 300),
  message: oklchToHex(0.6, 0.15, 60),
  file: oklchToHex(0.58, 0.16, 255),
  control: oklchToHex(0.5, 0.02, 255),
  error: oklchToHex(0.56, 0.2, 25),
  retry: oklchToHex(0.6, 0.16, 45),
};

const PAPER: ExportTheme = {
  id: "paper",
  label: "Paper (light)",
  background: "#f6f7fa",
  backgroundGlow: "#dbe8f5",
  grid: "#d5dae3",
  card: "#ffffff",
  cardBorder: "#d6dbe5",
  foreground: "#141b26",
  muted: "#5c6675",
  chipBg: "#ffffff",
  chipBorder: "#d6dbe5",
  chipText: "#141b26",
  titleBand: "#eef1f6",
  flow: paperFlow,
  category: categoryFromFlow(paperFlow),
};

export const EXPORT_THEMES: Record<ExportThemeId, ExportTheme> = { studio: STUDIO, paper: PAPER };

// Single quotes only: these strings are embedded inside double-quoted SVG attributes.
export const FONT_SANS =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const FONT_MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
