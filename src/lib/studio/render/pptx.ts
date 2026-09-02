import type { Scene } from "../scene";
import type { RenderTrace } from "../exporters";
import { sceneToSvg } from "./svg";
import { rasterizeSvg } from "./frames";

/**
 * PPTX storyboard: slide 1 carries the animated GIF (PowerPoint, Keynote and
 * Google Slides play GIFs in presentation mode), then one slide per story step
 * with the connector highlighted and a rule-based narration, then a legend /
 * provenance slide. Built entirely in the browser with pptxgenjs.
 */

export interface PptxOptions {
  scene: Scene;
  projectName: string;
  gif: Blob | null;
  trace: RenderTrace;
  scale?: number;
  includeSteps?: boolean;
  onProgress?: ((done: number, total: number) => void) | undefined;
  signal?: AbortSignal | undefined;
}

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read rendered media."));
    reader.readAsDataURL(blob);
  });

async function sceneToPngDataUrl(
  scene: Scene,
  scale: number,
  focusEdgeId?: string,
): Promise<string> {
  const svg = sceneToSvg(scene, { animated: false, focusEdgeId });
  const canvas = await rasterizeSvg(
    svg,
    Math.ceil(scene.width * scale),
    Math.ceil(scene.height * scale),
  );
  return canvas.toDataURL("image/png");
}

function fit(w: number, h: number, boxW: number, boxH: number) {
  const r = Math.min(boxW / w, boxH / h);
  return { w: w * r, h: h * r };
}

export async function buildPptx(opts: PptxOptions): Promise<Blob> {
  const { scene, projectName, trace } = opts;
  const t = scene.theme;
  const hex = (v: string) => v.replace("#", "");
  const scale = opts.scale ?? 2;
  const steps = opts.includeSteps === false ? [] : scene.steps;
  const total = steps.length + 2;
  let done = 0;
  const tick = () => opts.onProgress?.(++done, total);
  const check = () => {
    if (opts.signal?.aborted) throw new DOMException("Export cancelled.", "AbortError");
  };

  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = projectName;
  pptx.author = "AI Architecture Motion Studio";
  pptx.subject = "Architecture storyboard";

  // ── Slide 1: animated overview ────────────────────────────────────────────
  check();
  const cover = pptx.addSlide();
  cover.background = { color: hex(t.background) };
  cover.addText(projectName, {
    x: 0.5,
    y: 0.3,
    w: SLIDE_W - 1,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: hex(t.foreground),
    fontFace: "Calibri",
  });
  cover.addText(
    `${scene.nodes.length} components · ${scene.edges.length} connectors · ${scene.steps.length} story steps · animated data flow`,
    {
      x: 0.5,
      y: 0.85,
      w: SLIDE_W - 1,
      h: 0.35,
      fontSize: 12,
      color: hex(t.muted),
      fontFace: "Consolas",
    },
  );
  const mediaBox = { w: SLIDE_W - 1, h: SLIDE_H - 1.7 };
  const size = fit(scene.width, scene.height, mediaBox.w, mediaBox.h);
  const media = opts.gif ? await blobToDataUrl(opts.gif) : await sceneToPngDataUrl(scene, scale);
  cover.addImage({
    data: media,
    x: (SLIDE_W - size.w) / 2,
    y: 1.3 + (mediaBox.h - size.h) / 2,
    w: size.w,
    h: size.h,
  });
  if (opts.gif) {
    cover.addText("Animated GIF — plays in presentation mode", {
      x: 0.5,
      y: SLIDE_H - 0.4,
      w: 6,
      h: 0.3,
      fontSize: 9,
      color: hex(t.muted),
      fontFace: "Consolas",
    });
  }
  tick();

  // ── Step slides ───────────────────────────────────────────────────────────
  const nodeById = new Map(scene.nodes.map((n) => [n.id, n]));
  for (const step of steps) {
    check();
    const slide = pptx.addSlide();
    slide.background = { color: hex(t.background) };
    const edge = scene.edges.find((e) => e.id === step.edge_id);
    const color = edge?.color ?? t.foreground;
    const png = await sceneToPngDataUrl(scene, scale, step.edge_id);
    const imgBox = { w: 8.4, h: SLIDE_H - 1 };
    const s = fit(scene.width, scene.height, imgBox.w, imgBox.h);
    slide.addImage({ data: png, x: 0.4, y: 0.5 + (imgBox.h - s.h) / 2, w: s.w, h: s.h });

    const px = 9.1;
    const pw = SLIDE_W - px - 0.4;
    slide.addText(`STEP ${step.index} / ${scene.steps.length}`, {
      x: px,
      y: 0.6,
      w: pw,
      h: 0.35,
      fontSize: 11,
      color: hex(color),
      bold: true,
      fontFace: "Consolas",
      charSpacing: 2,
    });
    slide.addText(step.title, {
      x: px,
      y: 1.0,
      w: pw,
      h: 1.0,
      fontSize: 20,
      bold: true,
      color: hex(t.foreground),
      fontFace: "Calibri",
      valign: "top",
    });
    slide.addText(step.narration, {
      x: px,
      y: 2.1,
      w: pw,
      h: 1.6,
      fontSize: 13,
      color: hex(t.foreground),
      fontFace: "Calibri",
      valign: "top",
    });
    slide.addText(step.detail, {
      x: px,
      y: 3.8,
      w: pw,
      h: 0.8,
      fontSize: 10,
      color: hex(t.muted),
      fontFace: "Consolas",
      valign: "top",
    });
    const src = nodeById.get(step.source_id);
    const dst = nodeById.get(step.target_id);
    const endpoints = [src, dst].filter(Boolean) as NonNullable<typeof src>[];
    endpoints.forEach((n, i) => {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: px,
        y: 4.8 + i * 0.75,
        w: pw,
        h: 0.6,
        fill: { color: hex(t.card) },
        line: { color: hex(n.accent), width: 1 },
        rectRadius: 0.08,
      });
      slide.addText(
        [
          {
            text: n.label,
            options: { bold: true, color: hex(t.foreground), fontSize: 11, breakLine: true },
          },
          {
            text: (n.subtitle ?? n.category).toUpperCase(),
            options: { color: hex(t.muted), fontSize: 8, fontFace: "Consolas" },
          },
        ],
        { x: px + 0.15, y: 4.8 + i * 0.75, w: pw - 0.3, h: 0.6, valign: "middle" },
      );
    });
    tick();
  }

  // ── Legend / provenance ───────────────────────────────────────────────────
  check();
  const last = pptx.addSlide();
  last.background = { color: hex(t.background) };
  last.addText("Legend & provenance", {
    x: 0.5,
    y: 0.4,
    w: SLIDE_W - 1,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: hex(t.foreground),
    fontFace: "Calibri",
  });
  scene.legend.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.6 + col * 4.1;
    const y = 1.4 + row * 0.55;
    last.addShape(pptx.ShapeType.ellipse, {
      x,
      y: y + 0.12,
      w: 0.18,
      h: 0.18,
      fill: { color: hex(item.color) },
      line: { color: hex(item.color) },
    });
    last.addText(item.semantic, {
      x: x + 0.3,
      y,
      w: 3.5,
      h: 0.4,
      fontSize: 12,
      color: hex(t.foreground),
      fontFace: "Calibri",
    });
  });
  const provenance = [
    `project_id ${trace.project_id}`,
    `graph_version ${trace.graph_version}`,
    `graph_hash ${trace.graph_hash}`,
    `renderer ${trace.renderer_version} · motion engine ${trace.motion_engine_version}`,
    `render_trace ${trace.render_trace_id}`,
    "Rendered deterministically from the validated architecture graph — motion only follows declared connectors.",
  ].join("\n");
  last.addText(provenance, {
    x: 0.6,
    y: SLIDE_H - 2.4,
    w: SLIDE_W - 1.2,
    h: 1.9,
    fontSize: 10,
    color: hex(t.muted),
    fontFace: "Consolas",
    valign: "bottom",
  });
  tick();

  const out = await pptx.write({ outputType: "blob" });
  if (out instanceof Blob) return out;
  return new Blob([out as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}
