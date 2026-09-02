import { useCallback, useEffect, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import type { PaletteItem } from "@/lib/studio/palette";
import { Route } from "@/routes/studio";
import { DEFAULT_GRAPH } from "@/lib/studio/samples";
import { loadPrefs, DEFAULT_PREFS } from "@/routes/settings";

const nodeTypes: NodeTypes = { arch: ArchNode };
const edgeTypes: EdgeTypes = { flow: FlowEdge };

function Canvas() {
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, select } = useStudio();
  const { project } = Route.useSearch();
  const prefs = useRef(DEFAULT_PREFS);

  useEffect(() => {
    prefs.current = loadPrefs();
    const store = useStudio.getState();
    if (project) {
      if (!store.openProject(project)) {
        toast.error("That project could not be found in this browser.");
        store.loadGraph(DEFAULT_GRAPH, {
          projectId: null,
          name: "Reference architecture",
          sourceType: "blank",
        });
      }
    } else if (store.nodes.length === 0) {
      store.loadGraph(DEFAULT_GRAPH, {
        projectId: null,
        name: "Reference architecture",
        sourceType: "blank",
      });
    }
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 60);
  }, [project, fitView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) useStudio.getState().redo();
        else useStudio.getState().undo();
      } else if (key === "s") {
        e.preventDefault();
        useStudio.getState().saveProject();
        toast.success("New graph version saved");
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

  return (
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
        onNodeClick={(_, n) => select(n.id, null)}
        onEdgeClick={(_, e) => select(null, e.id)}
        onPaneClick={() => select(null, null)}
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        snapToGrid={prefs.current.snapToGrid}
        snapGrid={[14, 14]}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "flow" }}
        className="studio-flow"
      >
        {prefs.current.showGrid && (
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} className="studio-bg" />
        )}
        {prefs.current.showMiniMap && <MiniMap pannable zoomable className="studio-minimap" />}
        <Controls showInteractive={false} className="studio-controls" />
      </ReactFlow>
    </div>
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
