import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { nextTick, type FramePainter } from "./frames";

/**
 * GIF encoder. A single global palette is quantised from frames sampled across
 * the loop so colours never shift between frames; frame delay is an exact
 * multiple of 10 ms (GIF's clock), which is why the painter's fps is limited to
 * values that divide 100.
 */

export const GIF_FPS_OPTIONS = [10, 20, 25, 50] as const;
export type GifFps = (typeof GIF_FPS_OPTIONS)[number];

export interface GifOptions {
  onProgress?: ((done: number, total: number) => void) | undefined;
  signal?: AbortSignal | undefined;
  maxColors?: number;
}

export async function encodeGif(painter: FramePainter, opts: GifOptions = {}): Promise<Blob> {
  const { width, height, frameCount, fps } = painter;
  const delay = Math.round(1000 / fps);
  if (delay % 10 !== 0) throw new Error(`GIF frame rate must divide 100 (got ${fps} fps).`);
  const ctx = painter.canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  // Palette from a stratified sample of frames (every other pixel keeps memory modest).
  const sampleFrames = Array.from(
    new Set([0, Math.floor(frameCount / 3), Math.floor((2 * frameCount) / 3)]),
  );
  const stride = 2;
  const perFrame = Math.ceil(width / stride) * Math.ceil(height / stride);
  const sample = new Uint8Array(perFrame * sampleFrames.length * 4);
  let offset = 0;
  for (const f of sampleFrames) {
    painter.paint(f);
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const i = (y * width + x) * 4;
        sample[offset++] = data[i]!;
        sample[offset++] = data[i + 1]!;
        sample[offset++] = data[i + 2]!;
        sample[offset++] = 255;
      }
    }
    await nextTick();
  }
  const palette = quantize(sample.subarray(0, offset), opts.maxColors ?? 256, {
    format: "rgb565",
    oneBitAlpha: false,
  });

  const gif = GIFEncoder();
  for (let f = 0; f < frameCount; f++) {
    if (opts.signal?.aborted) throw new DOMException("Export cancelled.", "AbortError");
    painter.paint(f);
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const index = applyPalette(rgba, palette, "rgb565");
    if (f === 0) gif.writeFrame(index, width, height, { palette, delay, repeat: 0 });
    else gif.writeFrame(index, width, height, { delay });
    opts.onProgress?.(f + 1, frameCount);
    if (f % 3 === 0) await nextTick();
  }
  gif.finish();
  const bytes = gif.bytes();
  return new Blob(
    [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
    {
      type: "image/gif",
    },
  );
}
