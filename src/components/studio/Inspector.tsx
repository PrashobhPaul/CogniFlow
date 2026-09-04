import { Fragment } from "react";
import { ArrowLeftRight, ArrowRight, Trash2 } from "lucide-react";
import { useStudio } from "@/lib/studio/store";
import {
  EDGE_PATH_TYPES,
  EXECUTION_MODES,
  GRAMMAR_PRESETS,
  NODE_STATUSES,
  SEMANTIC_COLORS,
  SEMANTIC_TYPES,
  type Direction,
  type ExecutionMode,
  type FlowEdgeData,
  type Grammar,
  type NodeStatus,
} from "@/lib/studio/types";
import { SHAPE_LABEL, shapeFor } from "@/lib/studio/render/icons3d";
import {
  NODE_MOTION_LABEL,
  STATUS_LABEL,
  motionForShape,
  resolveStatus,
} from "@/lib/studio/render/motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const PROTOCOLS = [
  "REST",
  "GraphQL",
  "gRPC",
  "WebSocket",
  "SSE",
  "Kafka",
  "AMQP",
  "SQL",
  "MCP",
  "S3",
];
const GRAMMARS: Grammar[] = ["packet", "stream", "dense", "pulse", "batch"];
const DIRECTIONS: Direction[] = ["forward", "reverse", "bidirectional"];

const STATUS_COLOR: Record<Exclude<NodeStatus, "auto">, string> = {
  idle: "var(--muted-foreground)",
  executing: "var(--primary)",
  success: "var(--flow-response)",
  retry: "var(--flow-retry)",
  error: "var(--flow-error)",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="panel-subhead !mb-0">{label}</Label>
      {children}
    </div>
  );
}

export function Inspector() {
  const {
    nodes,
    edges,
    selectedEdgeId,
    selectedNodeId,
    updateEdgeData,
    updateNodeData,
    deleteById,
  } = useStudio();
  const edge = edges.find((e) => e.id === selectedEdgeId);
  const node = nodes.find((n) => n.id === selectedNodeId);
  const nodeShape = node ? shapeFor(node.data.componentType, node.data.category) : null;
  const nodeMotion = nodeShape ? motionForShape(nodeShape) : null;
  const resolved = node
    ? resolveStatus(
        node.data.status,
        edges
          .filter((e) => e.source === node.id || e.target === node.id)
          .map((e) => {
            const d = e.data as FlowEdgeData | undefined;
            return { semantic: d?.semanticType ?? "request", enabled: d?.enabled ?? true };
          }),
      )
    : null;

  return (
    <aside className="studio-panel flex w-[300px] shrink-0 flex-col">
      <div className="panel-header">
        <span>{edge ? "Connector & motion" : node ? "Component" : "Inspector"}</span>
        {(edge || node) && (
          <button
            onClick={() => deleteById(node?.id ?? null, edge?.id ?? null)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6">
        {!edge && !node && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Select a connector to edit its semantics and motion grammar, or a component to rename
            it. Drag from a component's right handle to another node to declare a new flow — motion
            only ever follows a declared edge.
          </p>
        )}

        {node && (
          <Fragment>
            <Row label="Label">
              <Input
                value={node.data.label}
                onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
                className="h-8 bg-input/60 text-xs"
              />
            </Row>
            <Row label="Subtitle">
              <Input
                value={node.data.subtitle ?? ""}
                onChange={(e) => updateNodeData(node.id, { subtitle: e.target.value })}
                className="h-8 bg-input/60 text-xs"
              />
            </Row>
            <Row label="Status badge">
              <div className="grid grid-cols-3 gap-1.5">
                {NODE_STATUSES.map((st) => (
                  <button
                    key={st}
                    onClick={() => updateNodeData(node.id, { status: st })}
                    className={`chip ${(node.data.status ?? "auto") === st ? "chip-active" : ""}`}
                    style={st === "auto" ? undefined : { color: STATUS_COLOR[st] }}
                    title={
                      st === "auto"
                        ? "Derived from the connectors: error and retry flows win, any active flow means executing, none means idle."
                        : STATUS_LABEL[st]
                    }
                  >
                    {st}
                  </button>
                ))}
              </div>
              {resolved && (
                <p className="text-[11px] text-muted-foreground">
                  Showing{" "}
                  <span style={{ color: STATUS_COLOR[resolved] }}>{STATUS_LABEL[resolved]}</span>
                  {(node.data.status ?? "auto") === "auto" ? " (derived from connectors)" : ""}.
                </p>
              )}
            </Row>
            {nodeShape && nodeMotion && (
              <Row label="Symbol & motion">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="text-foreground">{SHAPE_LABEL[nodeShape]}</span> ·{" "}
                  {NODE_MOTION_LABEL[nodeMotion].label}
                  <span className="block text-[11px]">{NODE_MOTION_LABEL[nodeMotion].hint}</span>
                </p>
              </Row>
            )}
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              node_id · {node.id} · {node.data.componentType ?? "generic"}
            </p>
          </Fragment>
        )}

        {edge && (
          <Fragment>
            <Row label="Semantic type">
              <div className="grid grid-cols-3 gap-1.5">
                {SEMANTIC_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => updateEdgeData(edge.id, { semanticType: t })}
                    className={`chip ${(edge.data as FlowEdgeData).semanticType === t ? "chip-active" : ""}`}
                    style={{ color: SEMANTIC_COLORS[t] }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Protocol">
              <div className="flex flex-wrap gap-1.5">
                {PROTOCOLS.map((p) => (
                  <button
                    key={p}
                    onClick={() => updateEdgeData(edge.id, { protocol: p })}
                    className={`chip ${(edge.data as FlowEdgeData).protocol === p ? "chip-active" : ""}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Direction">
              <div className="grid grid-cols-3 gap-1.5">
                {DIRECTIONS.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => updateEdgeData(edge.id, { direction: dir })}
                    className={`chip flex items-center justify-center gap-1 ${
                      (edge.data as FlowEdgeData).direction === dir ? "chip-active" : ""
                    }`}
                  >
                    {dir === "bidirectional" ? (
                      <ArrowLeftRight className="h-3 w-3" />
                    ) : (
                      <ArrowRight className={`h-3 w-3 ${dir === "reverse" ? "rotate-180" : ""}`} />
                    )}
                    {dir === "bidirectional" ? "both" : dir}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Execution mode">
              <div className="grid grid-cols-2 gap-1.5">
                {EXECUTION_MODES.map((m: ExecutionMode) => (
                  <button
                    key={m}
                    onClick={() => updateEdgeData(edge.id, { executionMode: m })}
                    className={`chip ${(edge.data as FlowEdgeData).executionMode === m ? "chip-active" : ""}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Connector path">
              <div className="grid grid-cols-3 gap-1.5">
                {EDGE_PATH_TYPES.map((pt) => (
                  <button
                    key={pt}
                    onClick={() => updateEdgeData(edge.id, { pathType: pt })}
                    className={`chip ${((edge.data as FlowEdgeData).pathType ?? "smoothstep") === pt ? "chip-active" : ""}`}
                  >
                    {pt === "smoothstep" ? "step" : pt}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Payload type">
              <Input
                value={(edge.data as FlowEdgeData).payloadType ?? ""}
                onChange={(e) => updateEdgeData(edge.id, { payloadType: e.target.value })}
                placeholder="e.g. json, tokens, vector[1536]"
                className="h-8 bg-input/60 text-xs"
              />
            </Row>

            <Row label="Motion grammar">
              <div className="grid grid-cols-3 gap-1.5">
                {GRAMMARS.map((g) => (
                  <button
                    key={g}
                    onClick={() => updateEdgeData(edge.id, { grammar: g, ...GRAMMAR_PRESETS[g] })}
                    className={`chip ${(edge.data as FlowEdgeData).grammar === g ? "chip-active" : ""}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </Row>

            <Row label={`Traversal time · ${(edge.data as FlowEdgeData).speed.toFixed(1)}s`}>
              <Slider
                min={0.4}
                max={6}
                step={0.1}
                value={[(edge.data as FlowEdgeData).speed]}
                onValueChange={([v]) => updateEdgeData(edge.id, { speed: v ?? 1 })}
              />
            </Row>
            <Row label={`Density · ${(edge.data as FlowEdgeData).density} in flight`}>
              <Slider
                min={1}
                max={24}
                step={1}
                value={[(edge.data as FlowEdgeData).density]}
                onValueChange={([v]) => updateEdgeData(edge.id, { density: v ?? 1 })}
              />
            </Row>
            <Row label={`Particle size · ${(edge.data as FlowEdgeData).size.toFixed(1)}px`}>
              <Slider
                min={1}
                max={10}
                step={0.5}
                value={[(edge.data as FlowEdgeData).size]}
                onValueChange={([v]) => updateEdgeData(edge.id, { size: v ?? 3 })}
              />
            </Row>

            <Row label="Label">
              <Input
                value={(edge.data as FlowEdgeData).label ?? ""}
                onChange={(e) => updateEdgeData(edge.id, { label: e.target.value })}
                className="h-8 bg-input/60 text-xs"
              />
            </Row>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-3 py-2">
              <span className="text-xs">Flow active</span>
              <Switch
                checked={(edge.data as FlowEdgeData).enabled}
                onCheckedChange={(v) => updateEdgeData(edge.id, { enabled: v })}
              />
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              edge_id · {edge.id} · {edge.source} → {edge.target}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => deleteById(null, edge.id)}
            >
              Delete connector
            </Button>
          </Fragment>
        )}
      </div>
    </aside>
  );
}
