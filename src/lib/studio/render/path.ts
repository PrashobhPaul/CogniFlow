/**
 * Deterministic SVG path sampler. Mirrors SMIL <animateMotion calcMode="linear">
 * semantics: progress 0..1 maps to distance along the path, so GIF/video frames
 * place particles exactly where the browser would along the same connector.
 * Supports the commands React Flow's smoothstep/bezier/straight paths emit
 * (M, L, H, V, Q, C, Z; absolute and relative).
 */

export interface Point {
  x: number;
  y: number;
}

export interface PathSampler {
  length: number;
  /** Point at normalised progress t ∈ [0, 1]. */
  pointAt: (t: number) => Point;
  /** Point at an absolute distance along the path. */
  pointAtLength: (len: number) => Point;
  /** Polyline used for sampling (useful for hit tests / midpoints). */
  points: Point[];
}

const CURVE_STEPS = 24;

function tokenize(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([MmLlHhVvQqCcZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    if (m[1]) out.push(m[1]);
    else out.push(Number(m[2]));
  }
  return out;
}

export function flattenPath(d: string): Point[] {
  const tokens = tokenize(d);
  const pts: Point[] = [];
  let cmd = "";
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const push = (x: number, y: number) => {
    const last = pts[pts.length - 1];
    if (!last || last.x !== x || last.y !== y) pts.push({ x, y });
    cx = x;
    cy = y;
  };
  const num = () => {
    const v = tokens[i++];
    return typeof v === "number" ? v : 0;
  };
  const hasNum = () => typeof tokens[i] === "number";

  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === "string") {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        push(sx, sy);
        continue;
      }
    }
    if (!cmd) {
      i++;
      continue;
    }
    if (!hasNum()) {
      i++;
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": {
        const x = num();
        const y = num();
        const nx = rel ? cx + x : x;
        const ny = rel ? cy + y : y;
        pts.push({ x: nx, y: ny });
        cx = nx;
        cy = ny;
        sx = nx;
        sy = ny;
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        const x = num();
        const y = num();
        push(rel ? cx + x : x, rel ? cy + y : y);
        break;
      }
      case "H": {
        const x = num();
        push(rel ? cx + x : x, cy);
        break;
      }
      case "V": {
        const y = num();
        push(cx, rel ? cy + y : y);
        break;
      }
      case "Q": {
        const x1 = num();
        const y1 = num();
        const x = num();
        const y = num();
        const ax = rel ? cx + x1 : x1;
        const ay = rel ? cy + y1 : y1;
        const bx = rel ? cx + x : x;
        const by = rel ? cy + y : y;
        const ox = cx;
        const oy = cy;
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const u = s / CURVE_STEPS;
          const w = 1 - u;
          push(w * w * ox + 2 * w * u * ax + u * u * bx, w * w * oy + 2 * w * u * ay + u * u * by);
        }
        break;
      }
      case "C": {
        const x1 = num();
        const y1 = num();
        const x2 = num();
        const y2 = num();
        const x = num();
        const y = num();
        const ax = rel ? cx + x1 : x1;
        const ay = rel ? cy + y1 : y1;
        const bx = rel ? cx + x2 : x2;
        const by = rel ? cy + y2 : y2;
        const ex = rel ? cx + x : x;
        const ey = rel ? cy + y : y;
        const ox = cx;
        const oy = cy;
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const u = s / CURVE_STEPS;
          const w = 1 - u;
          push(
            w * w * w * ox + 3 * w * w * u * ax + 3 * w * u * u * bx + u * u * u * ex,
            w * w * w * oy + 3 * w * w * u * ay + 3 * w * u * u * by + u * u * u * ey,
          );
        }
        break;
      }
      default:
        i++;
    }
  }
  return pts;
}

export function samplePath(d: string): PathSampler {
  const points = flattenPath(d);
  const cum: number[] = [0];
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]!;
    const b = points[k]!;
    cum.push(cum[k - 1]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const length = cum[cum.length - 1] ?? 0;

  const pointAtLength = (len: number): Point => {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1 || length === 0) return points[0]!;
    const target = Math.min(length, Math.max(0, len));
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid]! <= target) lo = mid;
      else hi = mid;
    }
    const a = points[lo]!;
    const b = points[hi]!;
    const seg = cum[hi]! - cum[lo]!;
    const u = seg === 0 ? 0 : (target - cum[lo]!) / seg;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  };

  return {
    length,
    points,
    pointAtLength,
    pointAt: (t) => pointAtLength((((t % 1) + 1) % 1) * length),
  };
}
