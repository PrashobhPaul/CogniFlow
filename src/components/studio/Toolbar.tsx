import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  FastForward,
  LayoutTemplate,
  Pause,
  Play,
  Redo2,
  Rewind,
  Save,
  Tags,
  Undo2,
} from "lucide-react";
import { BrandMark } from "@/components/Brand";
import { useMemo } from "react";
import { toast } from "sonner";
import { flushAutosave, useStudio } from "@/lib/studio/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExportCenter } from "./ExportCenter";

const SPEEDS = [0.5, 1, 2];

export function Toolbar() {
  const {
    playing,
    setPlaying,
    speedScale,
    setSpeedScale,
    showLabels,
    setShowLabels,
    edges,
    nodes,
    undo,
    redo,
    past,
    future,
    applyAutoLayout,
    saveProject,
    projectName,
    setProjectName,
    graphVersion,
    dirty,
    autosaveState,
    issues,
  } = useStudio();

  const activeFlows = edges.filter((e) => e.data?.enabled).length;
  const validation = useMemo(() => issues(), [issues, nodes, edges]);
  const errors = validation.filter((i) => i.level === "error");
  const warnings = validation.filter((i) => i.level === "warning");

  return (
    <header className="studio-topbar">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/" className="shrink-0" title="CogniFlow — home">
          <BrandMark className="h-8 w-8" />
        </Link>
        <div className="min-w-0">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="h-7 w-[220px] border-transparent bg-transparent px-1 text-sm font-semibold tracking-tight hover:border-border focus-visible:border-border"
          />
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            v{graphVersion}
            {dirty ? "*" : ""} · {nodes.length} components · {edges.length} connectors ·{" "}
            {activeFlows} flows
            {dirty
              ? autosaveState === "error"
                ? " · draft not saved (storage full)"
                : autosaveState === "saved"
                  ? " · draft kept"
                  : " · saving draft…"
              : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span
          title={
            validation.length === 0
              ? "Graph validates: every motion event is bound to a real connector."
              : validation.map((i) => i.message).join(" | ")
          }
          className={`chip ${errors.length ? "text-destructive" : warnings.length ? "text-[color:var(--flow-event)]" : "text-[color:var(--flow-response)]"}`}
        >
          {errors.length || warnings.length ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          {errors.length
            ? `${errors.length} errors`
            : warnings.length
              ? `${warnings.length} warnings`
              : "valid"}
        </span>

        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            disabled={!past.length}
            onClick={undo}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-xs" onClick={applyAutoLayout}>
          <LayoutTemplate className="h-3.5 w-3.5" /> Auto-layout
        </Button>

        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-1">
          <Button
            size="sm"
            variant={playing ? "default" : "ghost"}
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <span className="mx-1 h-4 w-px bg-border/70" />
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeedScale(s)}
              className={`chip ${speedScale === s ? "chip-active" : ""}`}
            >
              {s === 0.5 ? (
                <Rewind className="h-3 w-3" />
              ) : s === 2 ? (
                <FastForward className="h-3 w-3" />
              ) : null}
              {s}x
            </button>
          ))}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-9 gap-1.5 text-xs"
          onClick={() => setShowLabels(!showLabels)}
        >
          <Tags className="h-3.5 w-3.5" />
          {showLabels ? "Hide labels" : "Show labels"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-9 gap-1.5 text-xs"
          onClick={() => {
            flushAutosave();
            if (saveProject()) toast.success("New graph version saved");
            else toast.error("Saving failed — browser storage may be full.");
          }}
        >
          <Save className="h-3.5 w-3.5" /> Save
        </Button>

        <ExportCenter />

        <Link to="/">
          <Button size="sm" variant="outline" className="h-9 text-xs">
            New work
          </Button>
        </Link>
        <Link to="/import">
          <Button size="sm" variant="outline" className="h-9 text-xs">
            Import
          </Button>
        </Link>
      </div>
    </header>
  );
}
