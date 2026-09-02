import { createFileRoute } from "@tanstack/react-router";
import { Check, Github, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon3D } from "@/components/studio/Icon3D";
import { PALETTE } from "@/lib/studio/palette";
import { CATEGORY_LABEL, type NodeCategory } from "@/lib/studio/types";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as NodeCategory[];

export const Route = createFileRoute("/open-source")({
  head: () => ({
    meta: [
      { title: "Open source & free — ArchAnimate" },
      {
        name: "description",
        content:
          "ArchAnimate is MIT-licensed, hosted on GitHub Pages, and runs entirely in the browser with open-weight models. No accounts, no plans, no telemetry.",
      },
    ],
  }),
  component: OpenSource,
});

const INCLUDED = [
  "Infinite canvas, component library, semantic connectors, motion grammars",
  "Rule-based description compiler (instant, deterministic)",
  "Open-weight LLM compile in the browser (SmolLM2-360M) or on your own endpoint",
  "Image + instructions reconstruction (SmolVLM-500M in the browser)",
  "Animated GIF, animated SVG, PNG, JPEG, draw.io and AIR JSON exports",
  "MP4 / WebM video (WebCodecs) and PPTX storyboard with narrated steps",
  "Projects and versions, kept in this browser",
];

const STACK = [
  [
    "Hosting",
    "GitHub Pages — static files only, deployed by the workflow in .github/workflows/deploy.yml",
  ],
  [
    "Models",
    "ONNX open weights vendored into public/models at build time (chunked under GitHub's 100 MB file limit) and served from the same origin",
  ],
  [
    "Inference",
    "Transformers.js + ONNX Runtime Web, WebGPU when available, WASM otherwise, inside a Web Worker",
  ],
  [
    "Rendering",
    "One scene model mirrors the canvas; gifenc, mp4-muxer, webm-muxer and pptxgenjs encode in the browser",
  ],
  [
    "Privacy",
    "No backend, no accounts, no analytics. Descriptions and images stay on your device with the in-browser engine",
  ],
];

function OpenSource() {
  return (
    <AppShell
      title="Open source & free for everyone"
      subtitle="ArchAnimate is MIT-licensed. Fork it, self-host it on any static host, swap the model, or run it against your own inference endpoint. There is no paid tier — every feature below is on for every visitor."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Everything included</p>
            <Badge variant="secondary">MIT</Badge>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--flow-response)]" />
                {f}
              </li>
            ))}
          </ul>
          <a
            href="https://github.com/PrashobhPaul/ArchAnimate"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-xs hover:bg-card"
          >
            <Github className="h-3.5 w-3.5" /> github.com/PrashobhPaul/ArchAnimate
          </a>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium">How it is built</p>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {STACK.map(([label, detail]) => (
              <li key={label}>
                <span className="font-medium text-foreground">{label}</span> — {detail}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-[color:var(--flow-response)]" /> Model licences
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            SmolLM2-360M-Instruct and SmolVLM-500M-Instruct are published by Hugging Face TB under
            Apache-2.0. The ONNX conversions are downloaded from the Hugging Face Hub when the site
            is built; nothing is fine-tuned or redistributed under different terms. Prefer a
            different model? Change the ids in Settings (in-browser) or point the endpoint engine at
            any OpenAI-compatible server.
          </p>
        </Card>

        <Card className="p-5 lg:col-span-2" data-testid="icon-gallery">
          <p className="text-sm font-medium">3D icon set · {PALETTE.length} components</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Every component is a volumetric medallion lit from the top-left: crystals for foundation
            models, neural cubes for agents, gear hubs for orchestration, lattice cylinders for
            vector and data systems, portals for gateways and protocols, shields for safety, glass
            tiles for interfaces. The same SVG draws the canvas, the palette and every export. Brand
            marks come from the CC0 simple-icons set; logos remain trademarks of their owners and
            denote the product only.
          </p>
          {CATEGORIES.map((cat) => {
            const items = PALETTE.filter((item) => item.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {CATEGORY_LABEL[cat]} · {items.length}
                </p>
                <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                  {items.map((item) => (
                    <div
                      key={item.type}
                      title={`${item.label} — ${item.subtitle}`}
                      className="flex items-center gap-2 rounded-md border border-border/50 bg-card/60 p-2"
                    >
                      <Icon3D
                        icon={item.icon}
                        category={item.category}
                        type={item.type}
                        size={30}
                        className="shrink-0"
                      />
                      <span className="truncate text-[11px]">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </AppShell>
  );
}
