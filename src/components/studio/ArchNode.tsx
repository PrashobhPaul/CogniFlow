import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ArchNode as ArchNodeType } from "@/lib/studio/store";
import { Icon3D } from "./Icon3D";

export function ArchNode({ data, selected }: NodeProps<ArchNodeType>) {
  return (
    <div
      data-category={data.category}
      className={`arch-node group ${selected ? "arch-node-selected" : ""}`}
    >
      <Handle type="target" position={Position.Left} className="arch-handle" />
      <div className="flex items-center gap-3">
        <Icon3D
          icon={data.icon}
          category={data.category}
          type={typeof data["component_type"] === "string" ? data["component_type"] : undefined}
          size={32}
          className="arch-node-icon"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
            {data.label}
          </span>
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
