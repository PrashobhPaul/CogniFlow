import { createFileRoute } from "@tanstack/react-router";
import { Check, Github, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BRAND, pageTitle } from "@/lib/brand";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon3D } from "@/components/studio/Icon3D";
import { NodeOverlay } from "@/components/studio/NodeOverlay";
import { PALETTE } from "@/lib/studio/palette";
import { shapeFor } from "@/lib/studio/render/icons3d";
import {
  NODE_MOTIONS,
  NODE_MOTION_LABEL,
  STATUS_LABEL,
  motionForShape,
  type NodeMotion,
  type ResolvedStatus,
} from "@/lib/studio/render/motion";
import { CATEGORY_LABEL, type NodeCategory } from "@/lib/studio/types";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as NodeCategory[];

/** One representative component per motion kind, for the legend. */
const MOTION_SAMPLES = NODE_MOTIONS.filter((m) => m !== "none").map((motion) => ({
  motion,
  item: PALETTE.find((p) => motionForShape(shapeFor(p.type, p.category)) === motion) ?? PALETTE[0]!,
}));

const STATUS_SAMPLES: ResolvedStatus[] = ["idle", "executing", "success", "retry", "error"];

function MotionSample({ motion, item }: { motion: NodeMotion; item: (typeof PALETTE)[number] }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/50 bg-card/60 p-2.5">
      <span className="relative h-9 w-9 shrink-0">
        <Icon3D icon={item.icon} category={item.category} type={item.type} size={36} />
        <NodeOverlay
          motion={motion}
          status="executing"
          category={item.category}
          size={36}
          badge={false}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium">{NODE_MOTION_LABEL[motion].label}</span>
        <span className="block text-[10px] leading-snug text-muted-foreground">
          {NODE_MOTION_LABEL[motion].hint}
        </span>
      </span>
    </div>
  );
}

export const Route = createFileRoute("/open-source")({
  head: () => ({
    meta: [
      { title: pageTitle("Open source & free") },
      {
        name: "description",
        content: `${BRAND.name} is MIT-licensed, hosted on GitHub Pages, and runs entirely in the browser with open-weight models. No accounts, no plans, no telemetry.`,
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
      subtitle={`${BRAND.name} is MIT-licensed. Fork it, self-host it on any static host, swap the model, or run it against your own inference endpoint. There is no paid tier — every feature below is on for every visitor.`}
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
            href={BRAND.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-xs hover:bg-card"
          >
            <Github className="h-3.5 w-3.5" /> {BRAND.repoLabel}
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

        <Card className="p-5 lg:col-span-2" data-testid="motion-legend">
          <p className="text-sm font-medium">Component motion & status badges</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Each silhouette carries its own processing animation, played only while the component
            has an active flow, and a micro-badge for its state. The canvas, the animated SVG and
            every GIF / video frame are drawn from the same keyframes.
          </p>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
            {MOTION_SAMPLES.map((s) => (
              <MotionSample key={s.motion} motion={s.motion} item={s.item} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_SAMPLES.map((status) => (
              <div
                key={status}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-card/60 px-2.5 py-1.5"
              >
                <span className="relative h-7 w-7 shrink-0">
                  <Icon3D icon="Bot" category="ai" type="agent" size={28} />
                  <NodeOverlay motion="none" status={status} category="ai" size={28} />
                </span>
                <span className="text-[11px]">{STATUS_LABEL[status]}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2" data-testid="icon-gallery">
          <p className="text-sm font-medium">Symbol library · {PALETTE.length} components</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Every component is a volumetric silhouette lit from the top-left: neural crystals for
            hosted models and lattices for open weights, a funnel for embedding, point clouds for
            vector stores, stacked cylinders for relational data, a dispatch hub for orchestrators,
            a state ring for agent frameworks, conveyor belts for queues, fan-out for pub/sub,
            portals for gateways, checkpoint gates for guardrails, radar dishes for telemetry and a
            heartbeat monitor for alerts. The same SVG draws the canvas, the palette and every
            export. Brand marks come from the CC0 simple-icons set; logos remain trademarks of their
            owners and denote the product only.
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
