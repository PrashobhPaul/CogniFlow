import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { pageTitle } from "@/lib/brand";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: pageTitle("Help & Concepts") },
      {
        name: "description",
        content:
          "How the architecture graph, semantic connectors, motion grammars, validation rules, AI engines and exports fit together, plus keyboard shortcuts for the studio.",
      },
    ],
  }),
  component: Help,
});

const SECTIONS = [
  {
    title: "Architecture is data, not an image",
    body: "The canonical source of truth is the architecture graph plus its visual, motion and story models. Beautification and layout change appearance only — never topology.",
  },
  {
    title: "No graph edge → no animated flow",
    body: "Every particle references a validated edge id. A response arrow is never inferred just because a request exists, and export fails if any motion event points at an edge that does not exist.",
  },
  {
    title: "Semantic connectors",
    body: "Each connector carries direction, semantic type (request, response, data, event, stream, retrieval, embedding, message, file, control, error, retry), protocol, execution mode, payload type, label and metadata. Colour encodes the type: blue for raw data and files, purple for embeddings, teal for retrieval, green for responses, cyan for requests, amber for events, magenta for streams, red for errors and orange for retries.",
  },
  {
    title: "Motion grammars",
    body: "packet (discrete calls), stream (continuous), dense (token streaming), pulse (events) and batch (bulk transfers). Grammar sets speed, density and particle size, all editable per connector.",
  },
  {
    title: "Symbol library",
    body: "Every component is a functional silhouette, not a generic box: neural crystals for hosted models and lattices for open weights, a funnel for embedding, point clouds for vector stores and stacked cylinders for relational data, a dispatch hub for orchestrators and a state ring for agent frameworks, conveyor belts for queues, fan-out for pub/sub, portals for gateways, checkpoint gates for guardrails, radar dishes for telemetry and a heartbeat monitor for alerts. Brand marks sit on the same bases, so Pinecone and a generic vector DB read as the same kind of thing.",
  },
  {
    title: "Component motion & status badges",
    body: "Each silhouette carries its own processing animation: a pulsing perimeter for models, a thinking ring for agents and hubs, a radar sweep for vector stores and observability, a scanning laser for gateways, gates and chunkers, ripples for fan-out, a marching belt for queues and sequential lights for neural lattices. Motion plays only while the component has an active flow. The micro-badge on every icon is idle (grey dot), executing (spinning ring), success (green check), fallback / retry (amber) or error (red) — derived from the connectors by default, or declared per component in the inspector. Canvas, animated SVG and every GIF / video frame draw it from the same keyframes.",
  },
  {
    title: "Two compilers, both open",
    body: "The rule engine turns arrows, verbs, containment and fronting into a graph instantly and deterministically. The AI engine — an open-weight model running in your browser, or your own OpenAI-compatible endpoint — proposes a candidate graph that is validated, normalised, laid out and reviewed before it animates. No generated code is ever executed.",
  },
  {
    title: "Exports",
    body: "PNG, JPEG, SVG (static or animated), animated GIF, MP4 / WebM (WebCodecs), PPTX storyboard, draw.io XML and the AIR JSON graph all render in the browser from one scene model that mirrors the canvas — same node metrics, same smoothstep connectors, same particle timing — so every file matches what you see.",
  },
  {
    title: "In-browser models",
    body: "Weights are served from this site (chunked under GitHub's file limits) with the Hugging Face Hub as fallback, then cached by your browser. WebGPU is used when available; otherwise WASM, which is slower but works everywhere. Small models sometimes drift off-schema: retry, simplify, or fall back to the rule engine.",
  },
];

const SHORTCUTS = [
  ["Drag from a node handle", "Declare a connector"],
  ["Click a connector", "Edit semantics and motion"],
  ["Ctrl / Cmd + Z", "Undo"],
  ["Ctrl / Cmd + Shift + Z", "Redo"],
  ["Ctrl / Cmd + S", "Save a new graph version"],
  ["Delete / Backspace", "Remove the selection"],
];

function Help() {
  return (
    <AppShell
      title="Help & Concepts"
      subtitle="The studio is an architecture compiler with a deterministic motion renderer. These are the rules it enforces."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="p-5">
            <h2 className="text-sm font-medium">{s.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-medium">Studio shortcuts</h2>
        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          {SHORTCUTS.map(([k, v]) => (
            <li key={k} className="flex flex-wrap justify-between gap-3">
              <span className="font-mono text-foreground">{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
