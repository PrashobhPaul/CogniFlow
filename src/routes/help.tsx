import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & Concepts — ArchAnimate" },
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
    body: "Each connector carries direction, semantic type (request, response, data, event, stream, retrieval, embedding, message, file, control, error, retry), protocol, execution mode, payload type, label and metadata.",
  },
  {
    title: "Motion grammars",
    body: "packet (discrete calls), stream (continuous), dense (token streaming), pulse (events) and batch (bulk transfers). Grammar sets speed, density and particle size, all editable per connector.",
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
