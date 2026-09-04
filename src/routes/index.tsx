import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  FileCode2,
  ImageUp,
  Loader2,
  PenLine,
  Sparkles,
  SquareDashed,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { pageTitle } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GraphReview } from "@/components/studio/GraphReview";
import { ModelStatus } from "@/components/studio/ModelStatus";
import { createProject } from "@/lib/studio/projects";
import { BLANK_GRAPH, PATTERNS } from "@/lib/studio/samples";
import { compileDescription } from "@/lib/studio/compiler";
import { compileWithAi } from "@/lib/studio/ai/compile";
import { preloadLocalModel } from "@/lib/studio/ai/local";
import { candidateToGraph } from "@/lib/studio/candidate";
import { useEntitlements } from "@/lib/studio/use-entitlements";
import type { AirGraph } from "@/lib/studio/air";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: pageTitle("Create New Architecture") },
      {
        name: "description",
        content:
          "Start a new architecture from a blank canvas, a written description, an uploaded sketch or a draw.io import, then animate real data flow along every validated connector and export it as GIF, video or a slide deck.",
      },
    ],
  }),
  component: NewArchitecture,
});

const MODES = [
  {
    id: "describe",
    label: "Describe architecture",
    icon: PenLine,
    hint: "Write it in plain language",
  },
  { id: "image", label: "Upload image / sketch", icon: ImageUp, hint: "PNG, JPG, JPEG, WebP" },
  {
    id: "drawio",
    label: "Import draw.io / Mermaid",
    icon: FileCode2,
    hint: "Deterministic parsers",
  },
  { id: "blank", label: "Start blank", icon: SquareDashed, hint: "Empty infinite canvas" },
] as const;

const EXAMPLES = [
  "A RAG chatbot: web app → gateway → orchestrator → embedding model → vector DB → reranker → streaming LLM response",
  "An agentic assistant with MCP tools, session memory and an async worker queue",
  "A microservices commerce platform behind a WAF with Kafka events and observability",
  "Agents that run a full AIDLC lifecycle with evaluation gates and human review",
  "User -> chat UI -> agent API. Agent API sends tasks to the orchestrator. Orchestrator queries the vector DB over gRPC. Orchestrator streams tokens to the LLM. LLM returns the answer to the chat UI over SSE. Orchestrator publishes trace events to Kafka. Kafka feeds observability.",
];

type Engine = "rules" | "model";

function NewArchitecture() {
  const navigate = useNavigate();
  const { entitlements } = useEntitlements();
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("describe");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [engine, setEngine] = useState<Engine>("rules");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    graph: AirGraph;
    warnings: string[];
    engine: string;
  } | null>(null);

  const aiAvailable = entitlements.features.aiCompile;
  const activeEngine: Engine = aiAvailable ? engine : "rules";

  const startFromPattern = (patternId: string) => {
    const pattern = PATTERNS.find((p) => p.id === patternId);
    if (!pattern) return;
    const project = createProject(name || pattern.name, "blank", pattern.graph);
    navigate({ to: "/studio", search: { project: project.project_id } });
  };

  const startBlank = () => {
    const project = createProject(name || "Untitled architecture", "blank", BLANK_GRAPH);
    navigate({ to: "/studio", search: { project: project.project_id } });
  };

  const compile = async () => {
    if (!prompt.trim()) {
      setError("Describe the architecture first.");
      return;
    }
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      if (activeEngine === "model") {
        try {
          const res = await compileWithAi({ prompt: prompt.trim() });
          const converted = candidateToGraph(res.candidate);
          setResult({
            graph: converted.graph,
            warnings: converted.warnings,
            engine: `${res.engine === "local" ? "in-browser" : "endpoint"} model · ${res.model}`,
          });
          if (!name && converted.title) setName(converted.title);
          return;
        } catch (e) {
          toast.warning(
            `Model compile failed (${e instanceof Error ? e.message : "unknown"}). Falling back to the rule engine.`,
          );
        }
      }
      const res = compileDescription(prompt);
      setResult({
        graph: res.graph,
        warnings: res.warnings,
        engine: `rule-based compiler · ${res.statements} statements`,
      });
      if (!name && res.title) setName(res.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compilation failed.");
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!result) return;
    const project = createProject(name || "Described architecture", "prompt", result.graph);
    navigate({ to: "/studio", search: { project: project.project_id } });
  };

  return (
    <AppShell
      title="Create New Architecture"
      subtitle="Every input becomes one canonical architecture graph — components, semantic connectors and motion are data, never pixels. Everything runs in your browser; nothing is uploaded anywhere."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() =>
              m.id === "drawio"
                ? navigate({ to: "/import" })
                : m.id === "blank"
                  ? startBlank()
                  : setMode(m.id)
            }
            className={`rounded-xl border p-4 text-left transition-colors ${
              mode === m.id
                ? "border-primary/60 bg-card"
                : "border-border/60 bg-card/40 hover:bg-card/70"
            }`}
          >
            <m.icon className="h-4 w-4 text-primary" />
            <p className="mt-3 text-sm font-medium">{m.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="max-w-sm bg-input/60"
        />

        {mode === "describe" && (
          <Card className="space-y-4 p-5">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="Describe the architecture with arrows (web app -> gateway -> LLM) or sentences (gateway publishes events to Kafka; LLM streams tokens to the web app over SSE). Mention the flows that matter: requests, retrieval, streaming, events."
              className="bg-input/50 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="chip max-w-full truncate"
                  title={ex}
                >
                  {ex.slice(0, 52)}…
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Engine</span>
              <button
                onClick={() => setEngine("rules")}
                className={`chip ${activeEngine === "rules" ? "chip-active" : ""}`}
              >
                <Wand2 className="h-3 w-3" /> Rule-based · instant
              </button>
              <button
                onClick={() => aiAvailable && setEngine("model")}
                disabled={!aiAvailable}
                title={aiAvailable ? undefined : "Configure an AI engine in Settings"}
                className={`chip ${activeEngine === "model" ? "chip-active" : ""} ${aiAvailable ? "" : "opacity-50"}`}
              >
                <Sparkles className="h-3 w-3" /> Open-weight LLM
                {aiAvailable ? ` · ${entitlements.ai.textModel}` : " · configure in Settings"}
              </button>
              <Button size="sm" className="ml-auto gap-2" disabled={busy} onClick={compile}>
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Create Architecture
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {activeEngine === "model"
                ? entitlements.ai.provider?.startsWith("in-browser")
                  ? `${entitlements.ai.textModel} runs inside your browser with Transformers.js (WebGPU when available). The first run downloads the open-weight model from this site, then it loads from cache. The proposal is validated, normalised and laid out deterministically, and you review it before it animates; if the model fails, the rule engine takes over.`
                  : `The description is sent to ${entitlements.ai.provider} (your own OpenAI-compatible endpoint) where the model proposes components and flows. The proposal is validated, normalised and laid out deterministically, and you review it before it animates.`
                : 'The rule engine reads arrows, verbs (sends, queries, streams to, publishes, subscribes to, returns to), containment ("platform with A, B and C") and fronting ("app behind a WAF"), classifies components by keyword and assigns connector semantics, protocols and motion grammars. Deterministic, instant, and the same result every time.'}
            </p>

            {activeEngine === "model" && <ModelStatus />}

            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}
          </Card>
        )}

        {mode === "describe" && result && (
          <GraphReview
            graph={result.graph}
            warnings={result.warnings}
            engine={result.engine}
            onAccept={accept}
          />
        )}

        {mode === "image" && (
          <Card className="space-y-3 p-5 text-sm">
            <p className="font-medium">Image / sketch reconstruction</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Upload a diagram (PNG, JPG, WebP) with optional instructions. An open-weight vision
              model — running in your browser or on your own endpoint — proposes a candidate graph
              that passes deterministic normalisation and a review before any animation is allowed.
              The image never leaves your device with the in-browser engine.
            </p>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/import" })}>
              Open Import & Review
            </Button>
          </Card>
        )}
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Validated reference patterns
      </h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {PATTERNS.map((p) => (
          <Card key={p.id} className="flex flex-col justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {p.graph.nodes.length} components · {p.graph.edges.length} connectors
              </p>
            </div>
            <Button size="sm" onClick={() => startFromPattern(p.id)}>
              Open in Studio
            </Button>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
