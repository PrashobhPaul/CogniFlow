import { lockedDuration, type Scene } from "../scene";
import { sceneToSvg } from "./svg";

/**
 * Offline frame painter: rasterises the static scene once, then draws
 * particles for any point in time using the same distance-along-path timing as
 * the canvas' SMIL animation. Frames are deterministic — frame i of a given
 * scene is always the same pixels — so GIF and video encoders can sample at
 * their own frame rates without ever depending on wall-clock playback.
 */

export interface PainterOptions {
  scale: number;
  fps: number;
  loopSeconds: number;
  /** Force even canvas dimensions (H.264 requirement). */
  even?: boolean;
}

export interface FramePainter {
  width: number;
  height: number;
  scale: number;
  fps: number;
  loopSeconds: number;
  frameCount: number;
  canvas: HTMLCanvasElement;
  paint: (frameIndex: number) => HTMLCanvasElement;
  dispose: () => void;
}

export function svgToBlobUrl(svg: string): string {
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
}

export async function rasterizeSvg(
  svg: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const url = svgToBlobUrl(svg);
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not rasterise the scene. Try a smaller size."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface ParticleTrack {
  color: string;
  size: number;
  dur: number;
  density: number;
  reverse: boolean;
  opacity: number;
  pointAt: (t: number) => { x: number; y: number };
}

export async function createFramePainter(
  scene: Scene,
  opts: PainterOptions,
): Promise<FramePainter> {
  const scale = opts.scale;
  const sceneW = Math.ceil(scene.width * scale);
  const sceneH = Math.ceil(scene.height * scale);
  const width = opts.even && sceneW % 2 ? sceneW + 1 : sceneW;
  const height = opts.even && sceneH % 2 ? sceneH + 1 : sceneH;

  const staticSvg = sceneToSvg(scene, { animated: false, particles: false });
  const staticLayer = await rasterizeSvg(staticSvg, sceneW, sceneH);

  const tracks: ParticleTrack[] = [];
  for (const e of scene.edges) {
    if (!e.motion) continue;
    const dur = lockedDuration(e.motion.dur, e.motion.density, opts.loopSeconds);
    const dirs: { reverse: boolean; opacity: number }[] =
      e.direction === "bidirectional"
        ? [
            { reverse: false, opacity: 1 },
            { reverse: true, opacity: 0.75 },
          ]
        : [{ reverse: e.direction === "reverse", opacity: 1 }];
    for (const d of dirs) {
      tracks.push({
        color: e.color,
        size: e.motion.size,
        dur,
        density: e.motion.density,
        reverse: d.reverse,
        opacity: d.opacity,
        pointAt: e.sampler.pointAt,
      });
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  const frameCount = Math.max(1, Math.round(opts.loopSeconds * opts.fps));

  const paint = (frameIndex: number) => {
    const time = frameIndex / opts.fps;
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = scene.theme.background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(staticLayer, 0, 0);
    for (const tr of tracks) {
      ctx.fillStyle = tr.color;
      ctx.shadowColor = tr.color;
      ctx.shadowBlur = 4 * scale;
      ctx.globalAlpha = tr.opacity;
      for (let k = 0; k < tr.density; k++) {
        // SMIL: begin = -k·dur/density → progress(t) = t/dur + k/density (mod 1).
        let phase = (time / tr.dur + k / tr.density) % 1;
        if (tr.reverse) phase = 1 - phase;
        const p = tr.pointAt(phase);
        ctx.beginPath();
        ctx.arc(p.x * scale, p.y * scale, tr.size * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    return canvas;
  };

  return {
    width,
    height,
    scale,
    fps: opts.fps,
    loopSeconds: opts.loopSeconds,
    frameCount,
    canvas,
    paint,
    dispose: () => {
      canvas.width = 0;
      canvas.height = 0;
      staticLayer.width = 0;
      staticLayer.height = 0;
    },
  };
}

/** Let the UI breathe between heavy frames. */
export const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
