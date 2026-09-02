import { useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Download,
  FileCode2,
  FileJson2,
  Film,
  Image as ImageIcon,
  Presentation,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useStudio } from "@/lib/studio/store";
import { toAir } from "@/lib/studio/adapter";
import { isExportable, validateGraph } from "@/lib/studio/air";
import { exportDrawio } from "@/lib/studio/drawio";
import {
  canvasToBlob,
  downloadBlob,
  downloadText,
  formatBytes,
  makeRenderTrace,
  svgToRaster,
} from "@/lib/studio/exporters";
import { buildScene, type Scene } from "@/lib/studio/scene";
import { sceneToSvg } from "@/lib/studio/render/svg";
import { createFramePainter, rasterizeSvg } from "@/lib/studio/render/frames";
import { encodeGif, GIF_FPS_OPTIONS, type GifFps } from "@/lib/studio/render/gif";
import { detectVideoSupport, encodeVideo, type VideoFormat } from "@/lib/studio/render/video";
import { buildPptx } from "@/lib/studio/render/pptx";
import { EXPORT_THEMES, type ExportThemeId } from "@/lib/studio/theme";
import { useEntitlements } from "@/lib/studio/use-entitlements";
import { loadPrefs } from "@/routes/settings";

/**
 * Export Center. Everything renders from the validated graph through one
 * scene model, so the preview here, the GIF, the video frames and the deck all
 * show the same diagram the canvas does — components, connectors, chips,
 * particle timing. GIF and animated SVG are free-tier (rule-based, in-browser);
 * MP4/WebM and PPTX storyboards follow the plan's entitlements.
 */

type SizeId = "s" | "m" | "l";
const SIZES: Record<SizeId, { label: string; width: number }> = {
  s: { label: "S · 960px", width: 960 },
  m: { label: "M · 1280px", width: 1280 },
  l: { label: "L · 1920px", width: 1920 },
};

interface ExportPrefs {
  theme: ExportThemeId;
  size: SizeId;
  loopSeconds: number;
  fps: GifFps;
  title: boolean;
  legend: boolean;
  steps: boolean;
  grid: boolean;
  watermark: boolean;
  watermarkText: string;
}

const PREFS_KEY = "aims.export.v1";
const DEFAULT_EXPORT_PREFS: ExportPrefs = {
  theme: "studio",
  size: "m",
  loopSeconds: 6,
  fps: 25,
  title: true,
  legend: true,
  steps: true,
  grid: true,
  watermark: true,
  watermarkText: "CogniFlow",
};

const loadExportPrefs = (): ExportPrefs => {
  if (typeof window === "undefined") return DEFAULT_EXPORT_PREFS;
  try {
    return {
      ...DEFAULT_EXPORT_PREFS,
      ...(JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<ExportPrefs>),
    };
  } catch {
    return DEFAULT_EXPORT_PREFS;
  }
};

interface Progress {
  label: string;
  done: number;
  total: number;
}

export function ExportCenter() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<ExportPrefs>(DEFAULT_EXPORT_PREFS);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { entitlements } = useEntitlements();

  const projectName = useStudio((s) => s.projectName);
  const projectId = useStudio((s) => s.projectId);
  const graphVersion = useStudio((s) => s.graphVersion);
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const showLabels = useStudio((s) => s.showLabels);
  const speedScale = useStudio((s) => s.speedScale);

  useEffect(() => setPrefs(loadExportPrefs()), []);
  const update = (patch: Partial<ExportPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const graph = useMemo(() => toAir(nodes, edges), [nodes, edges]);
  const issues = useMemo(() => validateGraph(graph), [graph]);
  const ok = isExportable(issues);
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "architecture";
  const loopSeconds = Math.min(prefs.loopSeconds, entitlements.limits.maxLoopSeconds);
  const fps = Math.min(prefs.fps, entitlements.limits.maxFps) as GifFps;
  const videoSupport = useMemo(() => detectVideoSupport(), []);

  const measured = useMemo(() => {
    const m = new Map<string, { width: number; height: number }>();
    for (const n of nodes) {
      if (n.measured?.width && n.measured?.height)
        m.set(n.id, { width: n.measured.width, height: n.measured.height });
    }
    return m;
  }, [nodes]);

  const scene: Scene | null = useMemo(() => {
    if (!ok || !open) return null;
    try {
      return buildScene(graph, {
        theme: prefs.theme,
        measured,
        showLabels,
        speedScale,
        title: prefs.title ? projectName : undefined,
        subtitle: prefs.title
          ? `${graph.nodes.length} components · ${graph.edges.length} flows · v${graphVersion}`
          : undefined,
        legend: prefs.legend,
        stepNumbers: prefs.steps,
        grid: prefs.grid,
        watermark: prefs.watermark ? prefs.watermarkText : undefined,
      });
    } catch {
      return null;
    }
  }, [ok, open, graph, prefs, measured, showLabels, speedScale, projectName, graphVersion]);

  // Live preview: the animated SVG the browser plays is literally the export definition.
  useEffect(() => {
    if (!scene) {
      setPreviewUrl(null);
      return;
    }
    const svg = sceneToSvg(scene, { animated: true, loopSeconds });
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [scene, loopSeconds]);

  const scaleFor = (targetWidth: number) => {
    if (!scene) return 1;
    return Math.min(entitlements.limits.maxScale, Math.max(0.5, targetWidth / scene.width));
  };

  const trace = () => makeRenderTrace(graph, projectId ?? "unsaved", graphVersion);

  const run =
    (
      label: string,
      fn: (signal: AbortSignal) => Promise<{ blob: Blob; filename: string } | null>,
    ) =>
    async () => {
      if (!ok || !scene) {
        toast.error("Export blocked: fix the validation errors first.");
        return;
      }
      if (progress) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ label, done: 0, total: 1 });
      try {
        const out = await fn(controller.signal);
        if (out) {
          downloadBlob(out.blob, out.filename);
          toast.success(
            `${out.filename} · ${formatBytes(out.blob.size)} · trace ${trace().render_trace_id}`,
          );
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") toast.info("Export cancelled.");
        else toast.error(e instanceof Error ? e.message : "Export failed.");
      } finally {
        setProgress(null);
        abortRef.current = null;
      }
    };

  const onProgress = (label: string) => (done: number, total: number) =>
    setProgress({ label, done, total });

  const exportRaster = (type: "image/png" | "image/jpeg") =>
    run(type === "image/png" ? "Rendering PNG" : "Rendering JPEG", async () => {
      const svg = sceneToSvg(scene!, { animated: false });
      const blob = await svgToRaster(
        svg,
        type,
        Math.min(loadPrefs().exportScale, entitlements.limits.maxScale),
        scene!.theme.background,
      );
      return { blob, filename: `${slug}.${type === "image/png" ? "png" : "jpg"}` };
    });

  const exportSvg = (animated: boolean) =>
    run("Writing SVG", async () => {
      const svg = sceneToSvg(scene!, { animated, loopSeconds });
      return {
        blob: new Blob([svg], { type: "image/svg+xml" }),
        filename: `${slug}${animated ? "-animated" : ""}.svg`,
      };
    });

  const exportGif = run("Encoding GIF", async (signal) => {
    const painter = await createFramePainter(scene!, {
      scale: scaleFor(SIZES[prefs.size].width),
      fps,
      loopSeconds,
    });
    try {
      const blob = await encodeGif(painter, { onProgress: onProgress("Encoding GIF"), signal });
      return { blob, filename: `${slug}.gif` };
    } finally {
      painter.dispose();
    }
  });

  const exportVideo = (format: VideoFormat) =>
    run(`Encoding ${format.toUpperCase()}`, async (signal) => {
      const seconds = Math.min(loopSeconds * 2, entitlements.limits.maxVideoSeconds);
      const painter = await createFramePainter(scene!, {
        scale: scaleFor(SIZES[prefs.size].width),
        fps: 30,
        loopSeconds: seconds,
        even: true,
      });
      try {
        const blob = await encodeVideo(painter, {
          format,
          onProgress: onProgress(`Encoding ${format.toUpperCase()}`),
          signal,
        });
        return { blob, filename: `${slug}.${format}` };
      } finally {
        painter.dispose();
      }
    });

  const exportPptx = run("Building PPTX", async (signal) => {
    const painter = await createFramePainter(scene!, { scale: scaleFor(1280), fps, loopSeconds });
    let gif: Blob;
    try {
      gif = await encodeGif(painter, { onProgress: onProgress("Rendering cover GIF"), signal });
    } finally {
      painter.dispose();
    }
    const blob = await buildPptx({
      scene: scene!,
      projectName,
      gif,
      trace: trace(),
      scale: 2,
      onProgress: onProgress("Building slides"),
      signal,
    });
    return { blob, filename: `${slug}.pptx` };
  });

  const exportThumbnail = run("Rendering preview", async () => {
    const svg = sceneToSvg(scene!, { animated: false });
    const canvas = await rasterizeSvg(svg, scene!.width, scene!.height);
    return { blob: await canvasToBlob(canvas, "image/png"), filename: `${slug}-preview.png` };
  });

  const pct =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const locked = (feature: boolean) => !feature;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) abortRef.current?.abort();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Center</DialogTitle>
          <DialogDescription>
            Every file is rendered from the validated graph through the same scene the canvas draws
            — identical components, connectors, labels and particle timing — and stamped with graph
            hash, renderer version and a render trace id.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`rounded-lg border p-3 font-mono text-[11px] ${
            ok
              ? "border-border/60 text-muted-foreground"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          }`}
        >
          {ok
            ? `graph_ok · ${graph.nodes.length} nodes · ${graph.edges.length} edges · hash ${trace().graph_hash} · ${entitlements.label}`
            : issues
                .filter((i) => i.level === "error")
                .map((i) => i.message)
                .join(" · ")}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Preview */}
          <div className="space-y-2">
            <p className="panel-subhead">Live preview · what you will get</p>
            <div className="grid min-h-[220px] place-items-center overflow-hidden rounded-xl border border-border/60 bg-background/60 p-2">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Export preview"
                  className="max-h-[360px] w-auto max-w-full rounded-md"
                />
              ) : (
                <p className="text-xs text-muted-foreground">Fix validation errors to preview.</p>
              )}
            </div>
            {scene && (
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {scene.width}×{scene.height} scene · loop {loopSeconds}s · {fps} fps ·{" "}
                {scene.steps.length} story steps ·{" "}
                {Math.round(scene.width * scaleFor(SIZES[prefs.size].width))}px output
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="panel-subhead">Look</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(EXPORT_THEMES) as ExportThemeId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => update({ theme: id })}
                  className={`chip justify-center ${prefs.theme === id ? "chip-active" : ""}`}
                >
                  {id === "studio" ? "Studio dark" : "Paper light"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {(
                [
                  ["title", "Title band"],
                  ["legend", "Legend"],
                  ["steps", "Step numbers"],
                  ["grid", "Canvas grid"],
                  ["watermark", "Watermark"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-2 text-xs">
                  {label}
                  <Switch
                    checked={prefs[key]}
                    onCheckedChange={(v) => update({ [key]: v } as Partial<ExportPrefs>)}
                  />
                </label>
              ))}
            </div>
            {prefs.watermark && (
              <Input
                value={prefs.watermarkText}
                onChange={(e) => update({ watermarkText: e.target.value })}
                className="h-7 bg-input/60 text-[11px]"
                placeholder="Watermark text"
              />
            )}

            <p className="panel-subhead pt-1">Motion</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(SIZES) as SizeId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => update({ size: id })}
                  className={`chip justify-center ${prefs.size === id ? "chip-active" : ""}`}
                >
                  {SIZES[id].label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Loop</span>
              {[3, 4, 6, 8, 12, 20].map((s) => {
                const allowed = s <= entitlements.limits.maxLoopSeconds;
                return (
                  <button
                    key={s}
                    disabled={!allowed}
                    title={
                      allowed ? undefined : "Longer loops are part of the Architect / Pro plan"
                    }
                    onClick={() => update({ loopSeconds: s })}
                    className={`chip ${loopSeconds === s ? "chip-active" : ""} ${allowed ? "" : "opacity-40"}`}
                  >
                    {s}s
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Frame rate</span>
              {GIF_FPS_OPTIONS.map((f) => {
                const allowed = f <= entitlements.limits.maxFps;
                return (
                  <button
                    key={f}
                    disabled={!allowed}
                    onClick={() => update({ fps: f })}
                    className={`chip ${fps === f ? "chip-active" : ""} ${allowed ? "" : "opacity-40"}`}
                  >
                    {f} fps
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Particle speeds are snapped to the loop length so the GIF and video repeat seamlessly;
              the deviation from the canvas speed is under a few percent.
            </p>
          </div>
        </div>

        {progress && (
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-[11px]">
                <span>{progress.label}</span>
                <span className="font-mono">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => abortRef.current?.abort()}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="panel-subhead">Motion · free</p>
            <Button
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!!progress}
              onClick={exportGif}
            >
              <Film className="h-3.5 w-3.5" /> Animated GIF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!!progress}
              onClick={exportSvg(true)}
            >
              <Sparkles className="h-3.5 w-3.5" /> SVG (animated)
            </Button>
            <p className="panel-subhead pt-2">Static · free</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                disabled={!!progress}
                onClick={exportRaster("image/png")}
              >
                <ImageIcon className="h-3.5 w-3.5" /> PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                disabled={!!progress}
                onClick={exportRaster("image/jpeg")}
              >
                <ImageIcon className="h-3.5 w-3.5" /> JPEG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                disabled={!!progress}
                onClick={exportSvg(false)}
              >
                <FileCode2 className="h-3.5 w-3.5" /> SVG (static)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                disabled={!!progress}
                onClick={exportThumbnail}
              >
                <ImageIcon className="h-3.5 w-3.5" /> Preview PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                disabled={!!progress}
                onClick={run("Writing draw.io", async () => ({
                  blob: new Blob([exportDrawio(graph, projectName)], { type: "application/xml" }),
                  filename: `${slug}.drawio`,
                }))}
              >
                <FileCode2 className="h-3.5 w-3.5" /> Draw.io XML
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                disabled={!!progress}
                onClick={() =>
                  ok
                    ? downloadText(
                        JSON.stringify({ ...trace(), graph }, null, 2),
                        `${slug}.air.json`,
                        "application/json",
                      )
                    : toast.error("Export blocked: fix the validation errors first.")
                }
              >
                <FileJson2 className="h-3.5 w-3.5" /> AIR graph JSON
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="panel-subhead flex items-center gap-1.5">Video & deck · {"included"}</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!!progress || locked(entitlements.features.video) || !videoSupport.mp4}
              title={
                !videoSupport.mp4
                  ? "This browser cannot encode MP4; use Chrome or Edge."
                  : undefined
              }
              onClick={exportVideo("mp4")}
            >
              <Clapperboard className="h-3.5 w-3.5" /> MP4 video (H.264, 30 fps)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!!progress || locked(entitlements.features.video) || !videoSupport.webm}
              onClick={exportVideo("webm")}
            >
              <Clapperboard className="h-3.5 w-3.5" /> WebM video (VP9, 30 fps)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={!!progress || locked(entitlements.features.pptx)}
              onClick={exportPptx}
            >
              <Presentation className="h-3.5 w-3.5" /> PPTX storyboard (GIF cover +{" "}
              {scene?.steps.length ?? 0} step slides)
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {entitlements.features.pptx
                ? `Video runs for ${Math.min(loopSeconds * 2, entitlements.limits.maxVideoSeconds)}s (two loops) and is encoded in-browser with WebCodecs. The deck opens with the animated GIF, then walks the ${scene?.steps.length ?? 0} numbered flows with narration.`
                : "Video (MP4 / WebM) and the PPTX storyboard are unlocked on the Architect / Pro plan, together with open-weight LLM compilation from descriptions and images. GIF and animated SVG stay free."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
