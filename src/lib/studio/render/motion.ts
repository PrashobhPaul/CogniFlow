import type { IconShape } from "./icons3d";
import type { NodeStatus, SemanticType } from "../types";
import type { ExportTheme } from "../theme";

/**
 * Component motion grammar and status badges.
 *
 * Connectors already carry the data-flow animation; this module adds the
 * per-component "processing" language from the CogniFlow symbol library —
 * a pulsing perimeter for models, a thinking ring for agents, a radar sweep
 * for vector stores and telemetry, a scanning laser for gateways and
 * guardrails, ripples for fan-out, a marching belt for queues — plus the
 * standard micro-badge (idle · executing · success · retry · error).
 *
 * Every motion is defined analytically as a function of phase φ ∈ [0, 1), and
 * emitted twice from the same keyframes: as SMIL for the canvas and animated
 * SVG, and as Canvas 2D drawing for GIF / video frames. Frame i of a scene is
 * therefore the same pixels whichever renderer produced it.
 */

export type NodeMotion =
  | "pulse" // perimeter glow breathes while processing
  | "spin" // loader ring rotates (thinking / dispatching)
  | "sweep" // radar line sweeps the cluster
  | "scan" // laser line scans top to bottom
  | "ripple" // concentric ripples burst outward
  | "march" // dashed perimeter slides (belt / boundary)
  | "blink" // nodes light up in sequence (inference pass)
  | "beat" // heartbeat pulse
  | "none";

export type ResolvedStatus = Exclude<NodeStatus, "auto">;

export const NODE_MOTIONS: NodeMotion[] = [
  "pulse",
  "spin",
  "sweep",
  "scan",
  "ripple",
  "march",
  "blink",
  "beat",
  "none",
];

/** Seconds per cycle at speed 1×. Locked to the export loop like connector motion. */
export const NODE_MOTION_PERIOD: Record<NodeMotion, number> = {
  pulse: 1.8,
  spin: 1.4,
  sweep: 2.4,
  scan: 1.6,
  ripple: 2.2,
  march: 1.2,
  blink: 1.5,
  beat: 1.6,
  none: 0,
};

export const NODE_MOTION_LABEL: Record<NodeMotion, { label: string; hint: string }> = {
  pulse: { label: "Pulse", hint: "Perimeter glow breathes while the model processes" },
  spin: { label: "Thinking ring", hint: "Loader ring spins while waiting on a tool or dispatch" },
  sweep: { label: "Radar sweep", hint: "A sweep line crosses the cluster; nearest points glow" },
  scan: { label: "Scan line", hint: "Payloads pass through a scanning laser at the gate" },
  ripple: { label: "Ripple", hint: "Concentric ripples burst to every subscriber" },
  march: { label: "Belt march", hint: "Partition dashes slide along the perimeter, FIFO" },
  blink: { label: "Sequential lights", hint: "Layer nodes light up one after another" },
  beat: { label: "Heartbeat", hint: "Periodic double pulse on the monitor" },
  none: { label: "Static", hint: "No component motion; connectors carry the flow" },
};

const MOTION_FOR_SHAPE: Record<IconShape, NodeMotion> = {
  crystal: "pulse",
  cube: "spin",
  cylinder: "pulse",
  portal: "scan",
  shield: "pulse",
  glass: "none",
  platform: "march",
  gear: "spin",
  scroll: "none",
  orb: "pulse",
  lattice: "blink",
  funnel: "scan",
  pointcloud: "sweep",
  stack: "pulse",
  hub: "spin",
  ring: "spin",
  conveyor: "march",
  fanout: "ripple",
  gate: "scan",
  radar: "sweep",
  sheet: "none",
  avatar: "none",
  splitter: "scan",
  wave: "none",
  reel: "none",
  monitor: "beat",
};

export function motionForShape(shape: IconShape): NodeMotion {
  return MOTION_FOR_SHAPE[shape] ?? "none";
}

export const STATUS_LABEL: Record<ResolvedStatus, string> = {
  idle: "Idle",
  executing: "Executing",
  success: "Success",
  retry: "Fallback / retry",
  error: "Error",
};

/**
 * Derive the badge from the graph when the author left it on "auto":
 * error and retry connectors win, any active connector means executing,
 * and a component with no active flow is idle. "success" is only ever declared.
 */
export function resolveStatus(
  declared: NodeStatus | undefined,
  incident: { semantic: SemanticType; enabled: boolean }[],
): ResolvedStatus {
  if (declared && declared !== "auto") return declared;
  const active = incident.filter((e) => e.enabled);
  if (active.some((e) => e.semantic === "error")) return "error";
  if (active.some((e) => e.semantic === "retry")) return "retry";
  return active.length ? "executing" : "idle";
}

export function statusColor(status: ResolvedStatus, theme: ExportTheme, accent: string): string {
  switch (status) {
    case "idle":
      return theme.muted;
    case "executing":
      return accent;
    case "success":
      return theme.flow.response;
    case "retry":
      return theme.flow.retry;
    case "error":
      return theme.flow.error;
  }
}

/** Piecewise-linear keyframe evaluation — the same interpolation SMIL applies to `values`. */
export function keyframe(phase: number, keyTimes: number[], values: number[]): number {
  const p = ((phase % 1) + 1) % 1;
  for (let i = 1; i < keyTimes.length; i++) {
    const t0 = keyTimes[i - 1]!;
    const t1 = keyTimes[i]!;
    if (p <= t1) {
      const f = t1 === t0 ? 0 : (p - t0) / (t1 - t0);
      return values[i - 1]! + (values[i]! - values[i - 1]!) * f;
    }
  }
  return values[values.length - 1]!;
}

// Keyframes shared by both renderers. Triangle / step shapes only, so linear
// SMIL interpolation and the canvas evaluation agree exactly.
const KF = {
  pulse: { t: [0, 0.5, 1], v: [0.12, 0.6, 0.12] },
  beat: { t: [0, 0.12, 0.24, 0.36, 1], v: [0.12, 0.7, 0.2, 0.7, 0.12] },
  rippleR: { t: [0, 1], v: [12, 38] },
  rippleO: { t: [0, 1], v: [0.6, 0] },
  scanY: { t: [0, 1], v: [8, 56] },
  blink: { t: [0, 0.2, 1], v: [1, 0.25, 0.25] },
} as const;

const RING_R = 36;
const SPIN_ARC = `M68,32 A36,36 0 0 1 25.75,67.45`; // 100° arc starting at 3 o'clock
const SWEEP_WEDGE = `M32,32 L62,32 A30,30 0 0 0 47,6.02 Z`; // 60° trailing wedge
const MARCH_DASH = 12;
const BLINK_ANGLES = [-150, -120, -90, -60, -30];
const BADGE = { cx: 56, cy: 8, r: 6.5 } as const;
const BADGE_ARC = `M62.5,8 A6.5,6.5 0 0 1 54.87,14.2`; // 108° arc on the badge ring

const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (arr: readonly number[]) => arr.join(";");

export interface OverlaySpec {
  motion: NodeMotion;
  status: ResolvedStatus;
  /** Category accent (executing colour and default motion colour). */
  accent: string;
  /** Badge colour for the resolved status. */
  statusColor: string;
  /** Card background, used to separate the badge from the medallion. */
  bg: string;
  size: number;
  x?: number;
  y?: number;
  /** Seconds per cycle after speed scaling and loop locking. */
  period: number;
  /** Emit SMIL; otherwise a still at phase 0. */
  animated: boolean;
  /** Draw the status badge. */
  badge?: boolean;
  /**
   * Draw the moving parts (motion overlay and the executing spinner). Frame
   * painters turn this off for their static layer and paint them per frame.
   */
  motionLayer?: boolean;
}

/** Colour the motion overlay takes: category accent, or the status colour for faults. */
export function motionColor(spec: Pick<OverlaySpec, "status" | "accent" | "statusColor">) {
  return spec.status === "error" || spec.status === "retry" ? spec.statusColor : spec.accent;
}

/** Motion plays only while the component has something to do. */
export function motionActive(spec: Pick<OverlaySpec, "motion" | "status">): boolean {
  return spec.motion !== "none" && spec.status !== "idle";
}

/** SVG overlay (64×64 viewBox, overflow visible) drawn over the medallion. */
export function nodeOverlayMarkup(spec: OverlaySpec): string {
  const parts: string[] = [];
  const dur = r2(Math.max(0.1, spec.period));
  const motionLayer = spec.motionLayer ?? true;
  const color = motionColor(spec);

  if (motionLayer && motionActive(spec))
    parts.push(motionMarkup(spec.motion, color, dur, spec.animated));
  if (spec.badge ?? true) parts.push(badgeMarkup(spec, dur, motionLayer));

  const pos =
    spec.x !== undefined && spec.y !== undefined ? ` x="${r2(spec.x)}" y="${r2(spec.y)}"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${pos} width="${spec.size}" height="${spec.size}" viewBox="0 0 64 64" overflow="visible" aria-hidden="true">` +
    parts.join("") +
    `</svg>`
  );
}

function spin(dur: number, cx: number, cy: number, animated: boolean): string {
  return animated
    ? `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite" />`
    : "";
}

function animate(
  attr: string,
  kf: { t: readonly number[]; v: readonly number[] },
  dur: number,
  begin = 0,
) {
  return `<animate attributeName="${attr}" values="${fmt(kf.v)}" keyTimes="${fmt(kf.t)}" dur="${dur}s" begin="${r2(begin)}s" repeatCount="indefinite" calcMode="linear" />`;
}

function motionMarkup(motion: NodeMotion, color: string, dur: number, animated: boolean): string {
  switch (motion) {
    case "pulse":
    case "beat": {
      const kf = motion === "pulse" ? KF.pulse : KF.beat;
      const o = animated ? "" : ` opacity="${kf.v[0]}"`;
      return `<circle cx="32" cy="32" r="${RING_R}" fill="none" stroke="${color}" stroke-width="2.5"${o}>${animated ? animate("opacity", kf, dur) : ""}</circle>`;
    }
    case "spin":
      return (
        `<circle cx="32" cy="32" r="${RING_R}" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.15" />` +
        `<path d="${SPIN_ARC}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round">${spin(dur, 32, 32, animated)}</path>`
      );
    case "sweep":
      return (
        `<g>` +
        `<path d="${SWEEP_WEDGE}" fill="${color}" opacity="0.22" />` +
        `<line x1="32" y1="32" x2="62" y2="32" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.9" />` +
        spin(dur, 32, 32, animated) +
        `</g>`
      );
    case "scan": {
      const y0 = KF.scanY.v[0];
      const tf = animated
        ? `<animateTransform attributeName="transform" type="translate" values="0 ${KF.scanY.v[0]};0 ${KF.scanY.v[1]}" keyTimes="0;1" dur="${dur}s" repeatCount="indefinite" calcMode="linear" />`
        : "";
      return (
        `<g${animated ? "" : ` transform="translate(0 ${y0})"`}>` +
        `<line x1="6" y1="-3" x2="58" y2="-3" stroke="${color}" stroke-width="2" opacity="0.25" />` +
        `<line x1="6" y1="0" x2="58" y2="0" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.9" />` +
        tf +
        `</g>`
      );
    }
    case "ripple":
      return [0, 1]
        .map((k) => {
          const begin = (-k * dur) / 2;
          if (!animated) {
            const p = k / 2;
            return `<circle cx="32" cy="32" r="${r2(keyframe(p, [...KF.rippleR.t], [...KF.rippleR.v]))}" fill="none" stroke="${color}" stroke-width="2" opacity="${r2(keyframe(p, [...KF.rippleO.t], [...KF.rippleO.v]))}" />`;
          }
          return `<circle cx="32" cy="32" r="${KF.rippleR.v[0]}" fill="none" stroke="${color}" stroke-width="2" opacity="${KF.rippleO.v[0]}">${animate("r", KF.rippleR, dur, begin)}${animate("opacity", KF.rippleO, dur, begin)}</circle>`;
        })
        .join("");
    case "march":
      return `<rect x="3" y="3" width="58" height="58" rx="14" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6 6" opacity="0.7">${animated ? `<animate attributeName="stroke-dashoffset" values="0;-${MARCH_DASH}" keyTimes="0;1" dur="${dur}s" repeatCount="indefinite" calcMode="linear" />` : ""}</rect>`;
    case "blink":
      return BLINK_ANGLES.map((deg, k) => {
        const a = (deg * Math.PI) / 180;
        const cx = r2(32 + RING_R * Math.cos(a));
        const cy = r2(32 + RING_R * Math.sin(a));
        const begin = (-k * dur) / BLINK_ANGLES.length;
        const o = animated
          ? KF.blink.v[0]
          : keyframe(k / BLINK_ANGLES.length, [...KF.blink.t], [...KF.blink.v]);
        return `<circle cx="${cx}" cy="${cy}" r="3" fill="${color}" opacity="${r2(o)}">${animated ? animate("opacity", KF.blink, dur, begin) : ""}</circle>`;
      }).join("");
    case "none":
    default:
      return "";
  }
}

function badgeMarkup(spec: OverlaySpec, dur: number, motionLayer: boolean): string {
  const { cx, cy, r } = BADGE;
  const c = spec.statusColor;
  const halo = `<circle cx="${cx}" cy="${cy}" r="${r + 1.8}" fill="${spec.bg}" />`;
  const glyphStroke = `stroke="${spec.bg}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (spec.status) {
    case "idle":
      return halo + `<circle cx="${cx}" cy="${cy}" r="4" fill="${c}" />`;
    case "executing":
      return (
        halo +
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="2" opacity="0.3" />` +
        (motionLayer
          ? `<path d="${BADGE_ARC}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round">${spin(dur, cx, cy, spec.animated)}</path>`
          : "")
      );
    case "success":
      return (
        halo +
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" />` +
        `<path d="M52.6,8.3 L55,10.6 L59.5,5.6" ${glyphStroke} />`
      );
    case "retry":
      return (
        halo +
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" />` +
        `<path d="M56,4.6 V8.8" ${glyphStroke} /><circle cx="56" cy="11.4" r="1" fill="${spec.bg}" />`
      );
    case "error":
      return (
        halo +
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" />` +
        `<path d="M53.6,5.6 L58.4,10.4 M58.4,5.6 L53.6,10.4" ${glyphStroke} />`
      );
  }
}

export interface PaintSpec {
  motion: NodeMotion;
  status: ResolvedStatus;
  accent: string;
  statusColor: string;
  /** Icon top-left in scene units. */
  x: number;
  y: number;
  /** Icon size in scene units (the 64-unit box maps onto it). */
  size: number;
  period: number;
}

/**
 * Canvas 2D twin of the SMIL overlay for one point in time. Draws only the
 * moving parts — the static badge lives in the rasterised scene layer.
 */
export function paintNodeOverlay(
  ctx: CanvasRenderingContext2D,
  spec: PaintSpec,
  time: number,
  scale: number,
): void {
  const phase = spec.period > 0 ? (time / spec.period) % 1 : 0;
  const u = (spec.size / 64) * scale;
  ctx.save();
  ctx.translate(spec.x * scale, spec.y * scale);
  ctx.scale(u, u);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (motionActive(spec)) {
    const color = motionColor(spec);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    switch (spec.motion) {
      case "pulse":
      case "beat": {
        const kf = spec.motion === "pulse" ? KF.pulse : KF.beat;
        ctx.globalAlpha = keyframe(phase, [...kf.t], [...kf.v]);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(32, 32, RING_R, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "spin": {
        ctx.globalAlpha = 0.15;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(32, 32, RING_R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 3;
        const a0 = phase * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(32, 32, RING_R, a0, a0 + (100 * Math.PI) / 180);
        ctx.stroke();
        break;
      }
      case "sweep": {
        const a = phase * Math.PI * 2;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(32, 32);
        ctx.arc(32, 32, 30, a, a - Math.PI / 3, true);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(32, 32);
        ctx.lineTo(32 + 30 * Math.cos(a), 32 + 30 * Math.sin(a));
        ctx.stroke();
        break;
      }
      case "scan": {
        const y = keyframe(phase, [...KF.scanY.t], [...KF.scanY.v]);
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(6, y - 3);
        ctx.lineTo(58, y - 3);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(6, y);
        ctx.lineTo(58, y);
        ctx.stroke();
        break;
      }
      case "ripple": {
        ctx.lineWidth = 2;
        for (const k of [0, 1]) {
          const p = (phase + k / 2) % 1;
          ctx.globalAlpha = keyframe(p, [...KF.rippleO.t], [...KF.rippleO.v]);
          ctx.beginPath();
          ctx.arc(32, 32, keyframe(p, [...KF.rippleR.t], [...KF.rippleR.v]), 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case "march": {
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -MARCH_DASH * phase;
        ctx.beginPath();
        roundRect(ctx, 3, 3, 58, 58, 14);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "blink": {
        BLINK_ANGLES.forEach((deg, k) => {
          const a = (deg * Math.PI) / 180;
          const local = (phase - k / BLINK_ANGLES.length + 1) % 1;
          ctx.globalAlpha = keyframe(local, [...KF.blink.t], [...KF.blink.v]);
          ctx.beginPath();
          ctx.arc(32 + RING_R * Math.cos(a), 32 + RING_R * Math.sin(a), 3, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }
      default:
        break;
    }
  }

  if (spec.status === "executing") {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = spec.statusColor;
    ctx.lineWidth = 2;
    const a0 = phase * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(BADGE.cx, BADGE.cy, BADGE.r, a0, a0 + (108 * Math.PI) / 180);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
