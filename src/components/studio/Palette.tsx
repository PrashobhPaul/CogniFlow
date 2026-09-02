import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PALETTE } from "@/lib/studio/palette";
import { CATEGORY_LABEL, type NodeCategory } from "@/lib/studio/types";
import { Input } from "@/components/ui/input";
import { Icon3D } from "./Icon3D";

export function Palette() {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const filtered = PALETTE.filter((p) =>
      (p.label + p.subtitle + p.type).toLowerCase().includes(q.toLowerCase()),
    );
    const map = new Map<NodeCategory, typeof PALETTE>();
    filtered.forEach((item) => {
      map.set(item.category, [...(map.get(item.category) ?? []), item]);
    });
    return [...map.entries()];
  }, [q]);

  return (
    <aside className="studio-panel flex w-[248px] shrink-0 flex-col">
      <div className="panel-header">
        <span>Components</span>
        <Search className="h-3.5 w-3.5 opacity-60" />
      </div>
      <div className="px-3 pb-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search palette"
          className="h-8 bg-input/60 text-xs"
        />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map(([category, items]) => (
          <div key={category}>
            <p className="panel-subhead">{CATEGORY_LABEL[category]}</p>
            <div className="space-y-1.5">
              {items.map((item) => {
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/studio-node", JSON.stringify(item));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    data-category={item.category}
                    className="palette-item"
                  >
                    <Icon3D
                      icon={item.icon}
                      category={item.category}
                      type={item.type}
                      size={28}
                      className="shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{item.label}</span>
                      <span className="block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground">No components match.</p>
        )}
      </div>
    </aside>
  );
}
