import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, Download, Loader2, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { pageTitle } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModelStatus } from "@/components/studio/ModelStatus";
import { MOTION_ENGINE_VERSION, RENDERER_VERSION, AIR_VERSION } from "@/lib/studio/air";
import {
  ENDPOINT_PRESETS,
  TEXT_MODEL_PRESETS,
  VISION_MODEL_PRESETS,
  updateAiSettings,
  useAiSettings,
  type AiDevice,
  type AiEngine,
} from "@/lib/studio/ai/settings";
import {
  clearModelCache,
  loadLocalModel,
  probeLocalRuntime,
  unloadLocalModels,
  useLocalModel,
  type RuntimeProbe,
} from "@/lib/studio/ai/local";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: pageTitle("Settings") },
      {
        name: "description",
        content:
          "Canvas, export and AI engine preferences for the open-source architecture studio.",
      },
    ],
  }),
  component: Settings,
});

interface Prefs {
  snapToGrid: boolean;
  showGrid: boolean;
  showMiniMap: boolean;
  exportScale: number;
  animateExports: boolean;
}

const KEY = "aims.prefs.v1";
export const DEFAULT_PREFS: Prefs = {
  snapToGrid: true,
  showGrid: true,
  showMiniMap: true,
  exportScale: 2,
  animateExports: true,
};

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    return {
      ...DEFAULT_PREFS,
      ...(JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function Settings() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const ai = useAiSettings();
  const model = useLocalModel();

  useEffect(() => setPrefs(loadPrefs()), []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  };

  const busy = model.status === "loading" || model.status === "generating";
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<RuntimeProbe | null>(null);

  return (
    <AppShell
      title="Settings"
      subtitle="Everything is stored in this browser. There are no accounts and no server: exports, the rule-based compiler and the in-browser model all run locally."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <p className="text-sm font-medium">Canvas</p>
          {(
            [
              ["showGrid", "Show grid"],
              ["snapToGrid", "Snap to grid"],
              ["showMiniMap", "Show minimap"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-xs">{label}</Label>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(v) => update({ [key]: v } as Partial<Prefs>)}
              />
            </div>
          ))}
        </Card>

        <Card className="space-y-4 p-5">
          <p className="text-sm font-medium">Export</p>
          <div className="space-y-2">
            <Label className="text-xs">Raster scale · {prefs.exportScale}x</Label>
            <Slider
              min={1}
              max={4}
              step={1}
              value={[prefs.exportScale]}
              onValueChange={([v]) => update({ exportScale: v ?? 2 })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Include motion in SVG exports</Label>
            <Switch
              checked={prefs.animateExports}
              onCheckedChange={(v) => update({ animateExports: v })}
            />
          </div>
        </Card>

        <Card className="space-y-4 p-5 lg:col-span-2">
          <div>
            <p className="text-sm font-medium">AI engine</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Used by "Create Architecture" and image reconstruction. The rule-based compiler always
              works without any model.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:max-w-md">
            {(
              [
                ["local", "In-browser open-weight model"],
                ["endpoint", "My own OpenAI-compatible endpoint"],
              ] as [AiEngine, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => updateAiSettings({ engine: id })}
                className={`chip justify-center ${ai.engine === id ? "chip-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          {ai.engine === "local" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Text model (Hugging Face id, ONNX q4f16)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TEXT_MODEL_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      title={`${p.size} · ${p.note}`}
                      onClick={() => updateAiSettings({ textModel: p.id })}
                      className={`chip ${ai.textModel === p.id ? "chip-active" : ""}`}
                    >
                      {p.label} · {p.size}
                    </button>
                  ))}
                </div>
                <Input
                  value={ai.textModel}
                  onChange={(e) => updateAiSettings({ textModel: e.target.value })}
                  className="h-8 bg-input/60 font-mono text-xs"
                />
                <Label className="text-xs">Vision model (Transformers.js-compatible VLM)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {VISION_MODEL_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      title={`${p.size} · ${p.note}`}
                      onClick={() => updateAiSettings({ visionModel: p.id })}
                      className={`chip ${ai.visionModel === p.id ? "chip-active" : ""}`}
                    >
                      {p.label} · {p.size}
                    </button>
                  ))}
                </div>
                <Input
                  value={ai.visionModel}
                  onChange={(e) => updateAiSettings({ visionModel: e.target.value })}
                  className="h-8 bg-input/60 font-mono text-xs"
                />
                <Label className="text-xs">Compute</Label>
                <div className="flex gap-1.5">
                  {(["auto", "webgpu", "wasm"] as AiDevice[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => updateAiSettings({ device: d })}
                      className={`chip ${ai.device === d ? "chip-active" : ""}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Weights are served from this site (vendored by{" "}
                  <span className="font-mono">scripts/vendor-model.mjs</span>) with the Hugging Face
                  Hub as fallback, then cached by the browser. Defaults: SmolLM2-360M-Instruct
                  (text, ~270 MB) and SmolVLM-500M-Instruct (vision, ~360 MB), both Apache-2.0.
                  Prompts and images never leave your device.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={busy}
                    onClick={() =>
                      loadLocalModel("text", ai.textModel)
                        .then(() => toast.success("Text model ready."))
                        .catch((e) =>
                          toast.error(e instanceof Error ? e.message : "Model failed to load."),
                        )
                    }
                  >
                    <Download className="h-3.5 w-3.5" /> Download text model now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={busy || !ai.visionModel}
                    onClick={() =>
                      loadLocalModel("vision", ai.visionModel)
                        .then(() => toast.success("Vision model ready."))
                        .catch((e) =>
                          toast.error(e instanceof Error ? e.message : "Model failed to load."),
                        )
                    }
                  >
                    <Download className="h-3.5 w-3.5" /> Download vision model now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-2"
                    onClick={async () => {
                      unloadLocalModels();
                      const ok = await clearModelCache();
                      toast.info(ok ? "Cached model downloads removed." : "Nothing to clear.");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear cached weights
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={probing}
                    data-testid="test-runtime"
                    onClick={async () => {
                      setProbing(true);
                      try {
                        const r = await probeLocalRuntime();
                        setProbe(r);
                        const ok = r.results.filter((x) => x.ok).map((x) => x.device);
                        if (ok.length) toast.success(`Runtime OK on ${ok.join(" + ")}.`);
                        else toast.error("The in-browser runtime failed on every backend.");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Runtime self-test failed.");
                      } finally {
                        setProbing(false);
                      }
                    }}
                  >
                    {probing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5" />
                    )}{" "}
                    Test runtime
                  </Button>
                </div>
                <ModelStatus />
                {probe && (
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-[11px]">
                    <p className="font-medium">In-browser runtime self-test</p>
                    <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
                      {probe.results.map((r) => (
                        <li key={r.device} className={r.ok ? "text-primary" : "text-destructive"}>
                          {r.device}: {r.ok ? `ok · ${r.ms} ms` : r.detail}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-muted-foreground">
                      ONNX Runtime {probe.ortVersion ?? "?"} loaded from{" "}
                      {probe.source === "site" ? "this site" : "the jsDelivr CDN fallback"} (
                      <span className="break-all font-mono">{probe.files.mjs}</span>).
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Presets</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ENDPOINT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      title={p.note}
                      onClick={() =>
                        updateAiSettings({
                          endpoint: {
                            ...ai.endpoint,
                            baseUrl: p.baseUrl,
                            textModel: p.textModel,
                            visionModel: p.visionModel,
                            jsonMode: p.jsonMode,
                          },
                        })
                      }
                      className={`chip ${ai.endpoint.baseUrl === p.baseUrl ? "chip-active" : ""}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <Label className="text-xs">Base URL (…/v1)</Label>
                <Input
                  value={ai.endpoint.baseUrl}
                  onChange={(e) =>
                    updateAiSettings({ endpoint: { ...ai.endpoint, baseUrl: e.target.value } })
                  }
                  className="h-8 bg-input/60 font-mono text-xs"
                  placeholder="http://localhost:11434/v1"
                />
                <Label className="text-xs">API key (optional, stored in this browser only)</Label>
                <Input
                  type="password"
                  value={ai.endpoint.apiKey}
                  onChange={(e) =>
                    updateAiSettings({ endpoint: { ...ai.endpoint, apiKey: e.target.value } })
                  }
                  className="h-8 bg-input/60 font-mono text-xs"
                />
                <Label className="text-xs">Text model</Label>
                <Input
                  value={ai.endpoint.textModel}
                  onChange={(e) =>
                    updateAiSettings({ endpoint: { ...ai.endpoint, textModel: e.target.value } })
                  }
                  className="h-8 bg-input/60 font-mono text-xs"
                />
                <Label className="text-xs">Vision model (blank = image reconstruction off)</Label>
                <Input
                  value={ai.endpoint.visionModel}
                  onChange={(e) =>
                    updateAiSettings({ endpoint: { ...ai.endpoint, visionModel: e.target.value } })
                  }
                  className="h-8 bg-input/60 font-mono text-xs"
                />
                <div className="flex items-center justify-between pt-1">
                  <Label className="text-xs">Endpoint supports JSON mode (response_format)</Label>
                  <Switch
                    checked={ai.endpoint.jsonMode}
                    onCheckedChange={(v) =>
                      updateAiSettings({ endpoint: { ...ai.endpoint, jsonMode: v } })
                    }
                  />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Works with Ollama (start it with <span className="font-mono">OLLAMA_ORIGINS=*</span>
                ), vLLM, LM Studio, llama.cpp server, the Hugging Face router (
                <span className="font-mono">https://router.huggingface.co/v1</span> with your
                token), Groq or Together. Requests go straight from your browser to that host, so it
                must allow CORS from this site. Nothing is proxied through anyone else.
              </p>
            </div>
          )}
        </Card>

        <Card className="space-y-2 p-5 lg:col-span-2">
          <p className="text-sm font-medium">Engine versions</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            air_version {AIR_VERSION} · renderer_version {RENDERER_VERSION} · motion_engine_version{" "}
            {MOTION_ENGINE_VERSION}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Every export stamps project id, graph version, graph hash, renderer version,
            motion-engine version and a render trace id, so any rendered file can be traced back to
            the exact graph that produced it.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
