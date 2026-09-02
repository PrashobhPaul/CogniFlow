import { Cpu, Loader2 } from "lucide-react";
import { formatBytes, useLocalModel } from "@/lib/studio/ai/local";

/** Compact download / inference status for the in-browser model. Renders nothing when idle. */
export function ModelStatus() {
  const m = useLocalModel();
  if (m.status === "idle") return null;
  const files = Object.values(m.files).filter(
    (f) => f.file && f.progress !== null && (f.progress ?? 0) < 100,
  );
  const pct = Math.round(m.overall * 100);
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-[11px]">
      <div className="flex items-center gap-2">
        {m.status === "loading" || m.status === "generating" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <Cpu className="h-3.5 w-3.5 text-primary" />
        )}
        <span className="font-medium">
          {m.status === "loading" && `Loading ${m.modelId ?? "model"} in your browser · ${pct}%`}
          {m.status === "generating" &&
            `Generating with ${m.modelId ?? "model"} (${m.device ?? "…"})`}
          {m.status === "ready" && `${m.modelId ?? "Model"} ready on ${m.device ?? "…"}`}
          {m.status === "error" && `Model error: ${m.error}`}
        </span>
      </div>
      {m.status === "loading" && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          {files.slice(0, 3).map((f) => (
            <p key={f.file} className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              {f.file} · {Math.round(f.progress ?? 0)}%
              {f.total ? ` of ${formatBytes(f.total)}` : ""}
            </p>
          ))}
          <p className="mt-1 text-muted-foreground">
            First use downloads the weights once (a few hundred MB); afterwards they load from the
            browser cache.
          </p>
        </>
      )}
      {m.note && <p className="mt-1 text-muted-foreground">{m.note}</p>}
      {m.status === "generating" && m.partial && (
        <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
          {m.partial.slice(-600)}
        </pre>
      )}
    </div>
  );
}
