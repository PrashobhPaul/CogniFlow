import { graphHash, MOTION_ENGINE_VERSION, RENDERER_VERSION, type AirGraph } from "./air";
import { buildScene, type SceneOptions } from "./scene";
import { sceneToSvg } from "./render/svg";
import { rasterizeSvg } from "./render/frames";

/**
 * Export helpers. Rendering itself lives in scene.ts + render/*: one resolved
 * scene feeds SVG, raster, GIF, video and PPTX so every file matches the canvas.
 */

export interface RenderTrace {
  project_id: string;
  graph_version: number;
  graph_hash: string;
  renderer_version: string;
  motion_engine_version: string;
  render_trace_id: string;
}

export function makeRenderTrace(
  graph: AirGraph,
  projectId: string,
  graphVersion: number,
): RenderTrace {
  return {
    project_id: projectId,
    graph_version: graphVersion,
    graph_hash: graphHash(graph),
    renderer_version: RENDERER_VERSION,
    motion_engine_version: MOTION_ENGINE_VERSION,
    render_trace_id: `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

/** Convenience: AIR graph → SVG string (static or SMIL-animated). */
export function renderSvg(
  graph: AirGraph,
  opts: { animated: boolean; loopSeconds?: number } & SceneOptions,
): string {
  const { animated, loopSeconds, ...sceneOpts } = opts;
  const scene = buildScene(graph, sceneOpts);
  return sceneToSvg(scene, { animated, loopSeconds });
}

export async function svgToRaster(
  svg: string,
  type: "image/png" | "image/jpeg",
  scale = 2,
  background = "#0d1117",
): Promise<Blob> {
  const size = svg.match(/width="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/);
  const w = Math.ceil(Number(size?.[1] ?? 800) * scale);
  const h = Math.ceil(Number(size?.[2] ?? 600) * scale);
  const canvas = await rasterizeSvg(svg, w, h);
  if (type === "image/jpeg") {
    const flat = document.createElement("canvas");
    flat.width = w;
    flat.height = h;
    const ctx = flat.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(canvas, 0, 0);
    return canvasToBlob(flat, type);
  }
  return canvasToBlob(canvas, type);
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/png" | "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed."))), type, quality),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime: string) {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
