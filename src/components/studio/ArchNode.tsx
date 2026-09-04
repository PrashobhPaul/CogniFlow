import { useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useStudio, type ArchNode as ArchNodeType } from "@/lib/studio/store";
import type { FlowEdgeData } from "@/lib/studio/types";
import { shapeFor } from "@/lib/studio/render/icons3d";
import { motionForShape, resolveStatus } from "@/lib/studio/render/motion";
import { Icon3D } from "./Icon3D";
import { NodeOverlay } from "./NodeOverlay";

export function ArchNode({ id, data, selected }: NodeProps<ArchNodeType>) {
  const playing = useStudio((s) => s.playing);
  const speedScale = useStudio((s) => s.speedScale);
  const edges = useStudio((s) => s.edges);
  const updateNodeData = useStudio((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitLabel = () => {
    setEditing(false);
    const next = draftLabel.trim();
    if (next && next !== data.label) updateNodeData(id, { label: next });
  };
  const type =
    typeof data["component_type"] === "string" ? data["component_type"] : data.componentType;

  const shape = shapeFor(type, data.category);
  const motion = motionForShape(shape);
  const status = useMemo(
    () =>
      resolveStatus(
        data.status,
        edges
          .filter((e) => e.source === id || e.target === id)
          .map((e) => {
            const d = e.data as FlowEdgeData | undefined;
            return { semantic: d?.semanticType ?? "request", enabled: d?.enabled ?? true };
          }),
      ),
    [data.status, edges, id],
  );

  return (
    <div
      data-category={data.category}
      data-status={status}
      className={`arch-node group ${selected ? "arch-node-selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="arch-handle" />
      <div className="flex items-center gap-3">
        <span className="relative h-8 w-8 shrink-0">
          <Icon3D
            icon={data.icon}
            category={data.category}
            type={type}
            shape={shape}
            size={32}
            className="arch-node-icon"
          />
          <NodeOverlay
            motion={motion}
            status={status}
            category={data.category}
            size={32}
            playing={playing}
            speedScale={speedScale}
          />
        </span>
        <span
          className="min-w-0"
          onDoubleClick={() => {
            setDraftLabel(data.label);
            setEditing(true);
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") setEditing(false);
              }}
              className="nodrag nopan block w-full min-w-24 rounded border border-ring/60 bg-input/80 px-1 text-sm font-semibold tracking-tight text-foreground outline-none"
            />
          ) : (
            <span
              className="block truncate text-sm font-semibold tracking-tight text-foreground"
              title="Double-click to rename"
            >
              {data.label}
            </span>
          )}
          {data.subtitle && (
            <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {data.subtitle}
            </span>
          )}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="arch-handle" />
    </div>
  );
}
