import { nextTick, type FramePainter } from "./frames";

/**
 * Video encoder. Preferred path: WebCodecs VideoEncoder + in-browser muxing
 * (mp4-muxer / webm-muxer), which encodes offline with exact frame timestamps.
 * Fallback: MediaRecorder on a canvas stream played back in real time.
 */

export type VideoFormat = "mp4" | "webm";

export interface VideoOptions {
  format: VideoFormat;
  onProgress?: ((done: number, total: number) => void) | undefined;
  signal?: AbortSignal | undefined;
  /** Target bitrate in bits/s. Defaults scale with pixel count. */
  bitrate?: number | undefined;
}

export interface VideoSupport {
  webcodecs: boolean;
  mediaRecorder: boolean;
  mp4: boolean;
  webm: boolean;
}

export function detectVideoSupport(): VideoSupport {
  if (typeof window === "undefined")
    return { webcodecs: false, mediaRecorder: false, mp4: false, webm: false };
  const webcodecs = "VideoEncoder" in window && "VideoFrame" in window;
  const mediaRecorder = "MediaRecorder" in window;
  const mrMp4 = mediaRecorder && MediaRecorder.isTypeSupported("video/mp4");
  const mrWebm =
    mediaRecorder &&
    (MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ||
      MediaRecorder.isTypeSupported("video/webm"));
  return { webcodecs, mediaRecorder, mp4: webcodecs || mrMp4, webm: webcodecs || mrWebm };
}

const MP4_CODECS = ["avc1.640033", "avc1.640028", "avc1.4d0028", "avc1.42e01e", "avc1.42001f"];
const WEBM_CODECS = ["vp09.00.10.08", "vp09.00.40.08", "vp8"];

export async function encodeVideo(painter: FramePainter, opts: VideoOptions): Promise<Blob> {
  const support = detectVideoSupport();
  if (support.webcodecs) {
    try {
      return await encodeWithWebCodecs(painter, opts);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      if (!support.mediaRecorder) throw e;
      console.warn("WebCodecs encode failed, falling back to MediaRecorder", e);
    }
  }
  if (!support.mediaRecorder)
    throw new Error(
      "This browser cannot encode video. Use a recent Chrome, Edge, Firefox or Safari.",
    );
  return encodeWithMediaRecorder(painter, opts);
}

async function pickCodec(
  candidates: string[],
  width: number,
  height: number,
  bitrate: number,
  framerate: number,
) {
  for (const codec of candidates) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate,
        framerate,
      });
      if (res.supported) return codec;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function encodeWithWebCodecs(painter: FramePainter, opts: VideoOptions): Promise<Blob> {
  const { width, height, fps, frameCount } = painter;
  const bitrate =
    opts.bitrate ?? Math.min(24e6, Math.max(2e6, Math.round(width * height * fps * 0.12)));
  const codec = await pickCodec(
    opts.format === "mp4" ? MP4_CODECS : WEBM_CODECS,
    width,
    height,
    bitrate,
    fps,
  );
  if (!codec)
    throw new Error(`No ${opts.format.toUpperCase()} encoder available for ${width}×${height}.`);

  let addChunk: (chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata | undefined) => void;
  let finalize: () => ArrayBuffer;
  if (opts.format === "mp4") {
    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width, height, frameRate: fps },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });
    addChunk = (chunk, meta) => muxer.addVideoChunk(chunk, meta);
    finalize = () => {
      muxer.finalize();
      return muxer.target.buffer;
    };
  } else {
    const { Muxer, ArrayBufferTarget } = await import("webm-muxer");
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: codec.startsWith("vp8") ? "V_VP8" : "V_VP9", width, height, frameRate: fps },
      firstTimestampBehavior: "offset",
    });
    addChunk = (chunk, meta) => muxer.addVideoChunk(chunk, meta);
    finalize = () => {
      muxer.finalize();
      return muxer.target.buffer;
    };
  }

  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => addChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });
  const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps };
  if (opts.format === "mp4") config.avc = { format: "avc" };
  encoder.configure(config);

  const frameMicros = Math.round(1e6 / fps);
  try {
    for (let f = 0; f < frameCount; f++) {
      if (opts.signal?.aborted) throw new DOMException("Export cancelled.", "AbortError");
      if (encodeError) throw encodeError;
      const canvas = painter.paint(f);
      const frame = new VideoFrame(canvas, { timestamp: f * frameMicros, duration: frameMicros });
      encoder.encode(frame, { keyFrame: f % (fps * 2) === 0 });
      frame.close();
      opts.onProgress?.(f + 1, frameCount);
      while (encoder.encodeQueueSize > 6) await nextTick();
      if (f % 4 === 0) await nextTick();
    }
    await encoder.flush();
    if (encodeError) throw encodeError;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  const buffer = finalize();
  return new Blob([buffer], { type: opts.format === "mp4" ? "video/mp4" : "video/webm" });
}

async function encodeWithMediaRecorder(painter: FramePainter, opts: VideoOptions): Promise<Blob> {
  const { fps, frameCount } = painter;
  const mime =
    opts.format === "mp4"
      ? ["video/mp4;codecs=avc1", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m))
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m),
        );
  if (!mime) throw new Error(`This browser cannot record ${opts.format.toUpperCase()} video.`);

  const stream = painter.canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as
    (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: opts.bitrate ?? 8e6,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start();
  const interval = 1000 / fps;
  const start = performance.now();
  for (let f = 0; f < frameCount; f++) {
    if (opts.signal?.aborted) {
      recorder.stop();
      throw new DOMException("Export cancelled.", "AbortError");
    }
    painter.paint(f);
    track?.requestFrame?.();
    opts.onProgress?.(f + 1, frameCount);
    const due = start + (f + 1) * interval;
    const wait = due - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }
  recorder.stop();
  await stopped;
  track?.stop();
  return new Blob(chunks, { type: mime.split(";")[0] ?? "video/webm" });
}
