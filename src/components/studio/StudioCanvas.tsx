import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  reconnectEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { ArchNode } from "./ArchNode";
import { FlowEdge } from "./FlowEdge";
import { Palette } from "./Palette";
import { Inspector } from "./Inspector";
import { Toolbar } from "./Toolbar";
import { useStudio } from "@/lib/studio/store";
import {
  armAutosaveLifecycle,
  discardAutosave,
  flushAutosave,
  recoverableDraft,
} from "@/lib/studio/autosave";
import { getProject, SHARED_DRAFT_ID } from "@/lib/studio/projects";
import type { PaletteItem } from "@/lib/studio/palette";
import { PALETTE } from "@/lib/studio/palette";
import { Route } from "@/routes/studio";
import { DEFAULT_GRAPH } from "@/lib/studio/samples";
import { decodeShareGraph } from "@/lib/studio/share";
import { loadPrefs, DEFAULT_PREFS } from "@/routes/settings";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CATEGORY_LABEL, type NodeCategory } from "@/lib/studio/types";

const nodeTypes: NodeTypes = { arch: ArchNode };
const edgeTypes: EdgeTypes = { flow: FlowEdge };

/** True when the event target is a text-entry element (inputs keep their own shortcuts). */
function inTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

type MenuTarget =
  | { kind: "pane"; x: number; y: number }
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string };

function Canvas() {
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, select } = useStudio();
  const { project, d } = Route.useSearch();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [menuTarget, setMenuTarget] = useState<MenuTarget>({ kind: "pane", x: 0, y: 0 });

  useEffect(() => {
    setPrefs(loadPrefs());
    armAutosaveLifecycle();
    // The previous project's debounced edits must land in ITS draft before this
    // effect replaces the canvas, or an in-flight burst is silently lost.
    flushAutosave();
    const store = useStudio.getState();

    // Shared graph in the URL wins over everything else.
    if (d) {
      let cancelled = false;
      void decodeShareGraph(d).then((shared) => {
        if (cancelled) return;
        if (shared) {
          useStudio.getState().loadGraph(shared.graph, {
            projectId: null,
            name: shared.title ?? "Shared architecture",
            sourceType: "blank",
            dirty: true,
            draftSlot: SHARED_DRAFT_ID, // never clobber the user's unsaved-work draft
          });
          toast.info("Opened a shared architecture. Save it to keep a copy in this browser.");
        } else {
          toast.error("That share link could not be decoded.");
        }
        setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 60);
      });
      return () => {
        cancelled = true;
      };
    }
    if (project) {
      const saved = getProject(project);
      if (!store.openProject(project)) {
        toast.error("That project could not be found in this browser.");
        store.loadGraph(DEFAULT_GRAPH, {
          projectId: null,
          name: "Reference architecture",
          sourceType: "blank",
        });
      } else {
        const draft = recoverableDraft(project, saved?.graph_hash ?? null, saved?.name ?? null);
        if (draft) {
          store.loadGraph(draft.graph, {
            projectId: project,
            name: draft.name,
            sourceType: draft.source_type,
            graphVersion: saved?.graph_version ?? 1,
            dirty: true,
          });
          toast("Recovered unsaved changes", {
            description: "Your last edits were restored from the browser draft.",
            action: {
              label: "Discard",
              onClick: () => {
                discardAutosave(project);
                useStudio.getState().openProject(project);
              },
            },
          });
        }
      }
    } else if (store.nodes.length === 0) {
      const draft = recoverableDraft(null, null, null);
      if (draft) {
        store.loadGraph(draft.graph, {
          projectId: null,
          name: draft.name,
          sourceType: draft.source_type,
          dirty: true,
        });
        toast("Recovered unsaved work", {
          description: "The canvas was restored from the browser draft.",
          action: {
            label: "Discard",
            onClick: () => {
              discardAutosave(null);
              useStudio.getState().loadGraph(DEFAULT_GRAPH, {
                projectId: null,
                name: "Reference architecture",
                sourceType: "blank",
              });
            },
          },
        });
      } else {
        store.loadGraph(DEFAULT_GRAPH, {
          projectId: null,
          name: "Reference architecture",
          sourceType: "blank",
        });
      }
    }
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 60);
    return undefined;
  }, [project, d, fitView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const store = useStudio.getState();
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (inTextField(e.target)) {
        // Only manual save is allowed to fire from inside a text field.
        if (mod && key === "s") {
          e.preventDefault();
          flushAutosave();
          if (store.saveProject()) toast.success("New graph version saved");
          else toast.error("Saving failed — browser storage may be full.");
        }
        return;
      }
      if (!mod) return;
      // A live text selection on the page keeps its native clipboard behaviour.
      const textSelection = !(window.getSelection()?.isCollapsed ?? true);
      if (textSelection && (key === "c" || key === "x" || key === "a")) return;
      switch (key) {
        case "z":
          e.preventDefault();
          if (e.shiftKey) store.redo();
          else store.undo();
          break;
        case "s":
          e.preventDefault();
          flushAutosave();
          if (store.saveProject()) toast.success("New graph version saved");
          else toast.error("Saving failed — browser storage may be full.");
          break;
        case "c":
          e.preventDefault();
          store.copySelection();
          break;
        case "x": {
          e.preventDefault();
          if (store.copySelection()) store.deleteSelected();
          break;
        }
        case "v":
          e.preventDefault();
          store.pasteClipboard();
          break;
        case "d":
          e.preventDefault();
          store.duplicateSelection();
          break;
        case "a":
          e.preventDefault();
          store.selectAll();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData("application/studio-node");
      if (!raw) return;
      const item = JSON.parse(raw) as PaletteItem;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(
        {
          label: item.label,
          subtitle: item.subtitle,
          category: item.category,
          icon: item.icon,
          componentType: item.type,
        },
        position,
      );
    },
    [addNode, screenToFlowPosition],
  );

  const onBeforeDelete = useCallback(
    async ({ nodes: delNodes, edges: delEdges }: { nodes: Node[]; edges: Edge[] }) => {
      // Route React Flow's Delete/Backspace through one store action so a
      // node + its connectors are a single undo step.
      useStudio.getState().deleteElements(
        delNodes.map((n) => n.id),
        delEdges.map((e) => e.id),
      );
      return false; // we already applied it
    },
    [],
  );

  const onReconnect = useCallback((oldEdge: Edge, connection: Connection) => {
    const store = useStudio.getState();
    // reconnectEdge keeps the edge id and data; the store commits the change.
    const next = reconnectEdge(oldEdge, connection, store.edges);
    if (next !== store.edges) store.reconnect(oldEdge.id, connection);
  }, []);

  const insertAt = useCallback(
    (item: PaletteItem, x: number, y: number) => {
      addNode(
        {
          label: item.label,
          subtitle: item.subtitle,
          category: item.category,
          icon: item.icon,
          componentType: item.type,
        },
        screenToFlowPosition({ x, y }),
      );
    },
    [addNode, screenToFlowPosition],
  );

  const menuAction = (fn: () => void) => () => fn();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={wrapper} className="relative min-h-0 flex-1">
          <svg className="pointer-events-none absolute h-0 w-0">
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity="0.6" />
              </marker>
            </defs>
          </svg>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onBeforeDelete={onBeforeDelete}
            onNodeClick={(_, n) => select(n.id, null)}
            onEdgeClick={(_, e) => select(null, e.id)}
            onPaneClick={() => select(null, null)}
            onNodeContextMenu={(_, n: Node) => {
              setMenuTarget({ kind: "node", id: n.id });
              select(n.id, null);
            }}
            onEdgeContextMenu={(_, e: Edge) => {
              setMenuTarget({ kind: "edge", id: e.id });
              select(null, e.id);
            }}
            onPaneContextMenu={(e) => {
              const ev = e as React.MouseEvent;
              setMenuTarget({ kind: "pane", x: ev.clientX, y: ev.clientY });
            }}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            deleteKeyCode={["Backspace", "Delete"]}
            selectionMode={SelectionMode.Partial}
            zoomOnDoubleClick={false}
            snapToGrid={prefs.snapToGrid}
            snapGrid={[14, 14]}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: "flow" }}
            className="studio-flow"
          >
            {prefs.showGrid && (
              <Background
                variant={BackgroundVariant.Dots}
                gap={28}
                size={1}
                className="studio-bg"
              />
            )}
            {prefs.showMiniMap && <MiniMap pannable zoomable className="studio-minimap" />}
            <Controls showInteractive={false} className="studio-controls" />
          </ReactFlow>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {menuTarget.kind !== "pane" ? (
          <>
            <ContextMenuItem onClick={menuAction(() => useStudio.getState().duplicateSelection())}>
              Duplicate <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={menuAction(() => useStudio.getState().copySelection())}>
              Copy <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onClick={menuAction(() => useStudio.getState().deleteSelected())}
            >
              Delete <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Insert component</ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-h-80 w-64 overflow-y-auto">
                {(Object.keys(CATEGORY_LABEL) as NodeCategory[]).map((cat) => (
                  <ContextMenuSub key={cat}>
                    <ContextMenuSubTrigger>{CATEGORY_LABEL[cat]}</ContextMenuSubTrigger>
                    <ContextMenuSubContent className="max-h-80 w-56 overflow-y-auto">
                      {PALETTE.filter((p) => p.category === cat).map((item) => (
                        <ContextMenuItem
                          key={item.type}
                          onClick={() =>
                            insertAt(
                              item,
                              menuTarget.kind === "pane" ? menuTarget.x : 0,
                              menuTarget.kind === "pane" ? menuTarget.y : 0,
                            )
                          }
                        >
                          {item.label}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem onClick={menuAction(() => useStudio.getState().pasteClipboard())}>
              Paste <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={menuAction(() => useStudio.getState().selectAll())}>
              Select all <ContextMenuShortcut>⌘A</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={menuAction(() => useStudio.getState().applyAutoLayout())}>
              Auto-layout
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function StudioCanvas() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <Palette />
          <Canvas />
          <Inspector />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
