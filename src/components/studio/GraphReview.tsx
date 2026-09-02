import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { validateGraph, type AirGraph } from "@/lib/studio/air";
import { buildScene } from "@/lib/studio/scene";
import { sceneToSvg } from "@/lib/studio/render/svg";

/**
 * Review step shared by every entry path (rules, model, image, draw.io).
 * Shows the candidate exactly as the studio will animate it, lists what was
 * detected plus warnings, and blocks acceptance on validation errors.
 */
export function GraphReview({
  graph,
  warnings,
  engine,
  onAccept,
  acceptLabel = "Accept & open in Studio",
}: {
  graph: AirGraph;
  warnings: string[];
  engine: string;
  onAccept: () => void;
  acceptLabel?: string;
}) {
  const issues = useMemo(() => validateGraph(graph), [graph]);
  const errors = issues.filter((i) => i.level === "error");
  const graphWarnings = issues.filter((i) => i.level === "warning");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (errors.length) {
      setPreview(null);
      return;
    }
    try {
      const scene = buildScene(graph, {
        theme: "studio",
        legend: true,
        stepNumbers: true,
        grid: true,
        padding: 32,
      });
      const svg = sceneToSvg(scene, { animated: true, loopSeconds: 6 });
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setPreview(null);
      return;
    }
  }, [graph, errors.length]);

  const all = [...warnings, ...graphWarnings.map((i) => i.message)];

  return (
    <Card className="mt-4 space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Reconstruction review</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {engine} · {graph.nodes.length} components · {graph.edges.length} connectors ·{" "}
            {errors.length} errors · {all.length} warnings
          </p>
        </div>
        <Button size="sm" onClick={onAccept} disabled={errors.length > 0}>
          {errors.length > 0 ? "Blocked by validation errors" : acceptLabel}
        </Button>
      </div>

      {preview && (
        <div className="grid place-items-center overflow-hidden rounded-xl border border-border/60 bg-background/60 p-2">
          <img
            src={preview}
            alt="Animated preview of the compiled architecture"
            className="max-h-[420px] w-auto max-w-full rounded-md"
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="panel-subhead">Components detected</p>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {graph.nodes.map((n) => (
              <li key={n.id} className="flex justify-between gap-3">
                <span className="truncate text-foreground">{n.label}</span>
                <span className="font-mono text-[10px]">{n.component_type}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="panel-subhead">Connectors detected (semantics inferred)</p>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {graph.edges.map((e) => {
              const s =
                graph.nodes.find((n) => n.id === e.source_node_id)?.label ?? e.source_node_id;
              const t =
                graph.nodes.find((n) => n.id === e.target_node_id)?.label ?? e.target_node_id;
              return (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {s} {e.direction === "bidirectional" ? "⇄" : "→"} {t}
                    {e.label ? ` · ${e.label}` : ""}
                  </span>
                  <span className="shrink-0 font-mono text-[10px]">
                    {e.semantic_type} · {e.protocol}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {all.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
          {all.map((w, i) => (
            <li key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--flow-event)]" />
              {w}
            </li>
          ))}
        </ul>
      )}

      {errors.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-[color:var(--flow-response)]">
          <CheckCircle2 className="h-3.5 w-3.5" /> Graph validates — motion can be bound to every
          connector.
        </p>
      ) : (
        errors.map((e, i) => (
          <p key={i} className="text-xs text-destructive">
            {e.message}
          </p>
        ))
      )}
    </Card>
  );
}
