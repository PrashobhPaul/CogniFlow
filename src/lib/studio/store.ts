import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type { AirGraph, ValidationIssue } from "./air";
import { validateGraph } from "./air";
import { fromAir, toAir } from "./adapter";
import { autoLayout } from "./layout";
import type { ArchNode, FlowEdge } from "./store-types";
import { createProject, getProject, renameProject, saveVersion, type SourceType } from "./projects";
import {
  configureAutosave,
  discardAutosave,
  flushAutosave,
  scheduleAutosave,
  type AutosaveState,
} from "./autosave";
import { GRAMMAR_PRESETS } from "./types";
import type { ArchNodeData, FlowEdgeData } from "./types";

export type { ArchNode, FlowEdge };

let idCounter = 100;
export const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

const HISTORY_LIMIT = 60;

interface Snapshot {
  nodes: ArchNode[];
  edges: FlowEdge[];
}

interface StudioState {
  projectId: string | null;
  projectName: string;
  sourceType: SourceType;
  graphVersion: number;
  dirty: boolean;
  nodes: ArchNode[];
  edges: FlowEdge[];
  past: Snapshot[];
  future: Snapshot[];
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  autosaveState: AutosaveState;
  lastAutosaveAt: string | null;
  playing: boolean;
  speedScale: number;
  showLabels: boolean;
  onNodesChange: (c: NodeChange<ArchNode>[]) => void;
  onEdgesChange: (c: EdgeChange<FlowEdge>[]) => void;
  onConnect: (c: Connection) => void;
  addNode: (data: ArchNodeData, position: { x: number; y: number }) => void;
  select: (nodeId: string | null, edgeId: string | null) => void;
  updateEdgeData: (id: string, patch: Partial<FlowEdgeData>) => void;
  updateNodeData: (id: string, patch: Partial<ArchNodeData>) => void;
  deleteSelected: () => void;
  copySelection: () => number;
  pasteClipboard: () => number;
  duplicateSelection: () => number;
  selectAll: () => void;
  reconnect: (edgeId: string, connection: Connection) => void;
  setPlaying: (p: boolean) => void;
  setSpeedScale: (s: number) => void;
  setShowLabels: (s: boolean) => void;
  undo: () => void;
  redo: () => void;
  currentGraph: () => AirGraph;
  issues: () => ValidationIssue[];
  applyAutoLayout: () => void;
  loadGraph: (
    graph: AirGraph,
    meta: {
      projectId: string | null;
      name: string;
      sourceType: SourceType;
      graphVersion?: number;
      /** true when restoring an unsaved draft, so the * marker stays honest. */
      dirty?: boolean;
    },
  ) => void;
  openProject: (projectId: string) => boolean;
  saveProject: (note?: string) => boolean;
  setProjectName: (name: string) => void;
}

// Selection flags are canvas state, not history: undo must not change what is selected.
const stripSelection = (snap: Snapshot): Snapshot => ({
  nodes: snap.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
  edges: snap.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
});

const commit = (
  set: (partial: Partial<StudioState>) => void,
  get: () => StudioState,
  next: Partial<Snapshot>,
) => {
  const { nodes, edges, past } = get();
  set({
    past: [...past.slice(-HISTORY_LIMIT), stripSelection({ nodes, edges })],
    future: [],
    dirty: true,
    ...next,
  });
  scheduleAutosave();
};

/** In-memory clipboard for copy/paste/duplicate (survives route changes, not refresh). */
let clipboard: Snapshot | null = null;

const selectedNodesOf = (s: StudioState): ArchNode[] => {
  const flagged = s.nodes.filter((n) => n.selected);
  if (flagged.length) return flagged;
  return s.nodes.filter((n) => n.id === s.selectedNodeId);
};

export const useStudio = create<StudioState>((set, get) => ({
  projectId: null,
  projectName: "Untitled architecture",
  sourceType: "blank",
  graphVersion: 1,
  dirty: false,
  nodes: [],
  edges: [],
  past: [],
  future: [],
  selectedEdgeId: null,
  selectedNodeId: null,
  autosaveState: "idle",
  lastAutosaveAt: null,
  playing: true,
  speedScale: 1,
  showLabels: true,

  onNodesChange: (changes) => {
    const structural = changes.some((c) => c.type === "remove" || c.type === "add");
    const dragEnd = changes.some((c) => c.type === "position" && c.dragging === false);
    const nodes = applyNodeChanges(changes, get().nodes);
    if (structural || dragEnd) commit(set, get, { nodes });
    else set({ nodes });
  },
  onEdgesChange: (changes) => {
    const structural = changes.some((c) => c.type === "remove" || c.type === "add");
    const edges = applyEdgeChanges(changes, get().edges);
    if (structural) commit(set, get, { edges });
    else set({ edges });
  },
  onConnect: (connection) => {
    const id = nextId("edge");
    const edges = addEdge(
      {
        ...connection,
        id,
        type: "flow",
        data: {
          semanticType: "request",
          protocol: "REST",
          direction: "forward",
          executionMode: "synchronous",
          grammar: "packet",
          enabled: true,
          label: "",
          ...GRAMMAR_PRESETS.packet,
        } as FlowEdgeData,
      },
      get().edges,
    ) as FlowEdge[];
    commit(set, get, { edges });
    set({ selectedEdgeId: id, selectedNodeId: null });
  },
  addNode: (data, position) => {
    const id = nextId("node");
    commit(set, get, { nodes: [...get().nodes, { id, type: "arch", position, data }] });
    set({ selectedNodeId: id, selectedEdgeId: null });
  },
  select: (nodeId, edgeId) => set({ selectedNodeId: nodeId, selectedEdgeId: edgeId }),
  updateEdgeData: (id, patch) =>
    commit(set, get, {
      edges: get().edges.map((e) =>
        e.id === id ? { ...e, data: { ...(e.data as FlowEdgeData), ...patch } } : e,
      ),
    }),
  updateNodeData: (id, patch) =>
    commit(set, get, {
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    }),
  deleteSelected: () => {
    const s = get();
    const nodeIds = new Set(selectedNodesOf(s).map((n) => n.id));
    const edgeIds = new Set(s.edges.filter((e) => e.selected).map((e) => e.id));
    if (s.selectedEdgeId) edgeIds.add(s.selectedEdgeId);
    if (!nodeIds.size && !edgeIds.size) return;
    commit(set, get, {
      nodes: s.nodes.filter((n) => !nodeIds.has(n.id)),
      edges: s.edges.filter(
        (e) => !edgeIds.has(e.id) && !nodeIds.has(e.source) && !nodeIds.has(e.target),
      ),
    });
    set({ selectedNodeId: null, selectedEdgeId: null });
  },
  copySelection: () => {
    const s = get();
    const nodes = selectedNodesOf(s);
    if (!nodes.length) return 0;
    const ids = new Set(nodes.map((n) => n.id));
    clipboard = {
      nodes: nodes.map((n) => ({ ...n, selected: false })),
      edges: s.edges
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e) => ({ ...e, selected: false })),
    };
    return nodes.length;
  },
  pasteClipboard: () => {
    if (!clipboard || !clipboard.nodes.length) return 0;
    const idMap = new Map<string, string>();
    const OFFSET = 28; // two snap-grid cells, so the paste is visibly offset
    const nodes = clipboard.nodes.map((n) => {
      const id = nextId("node");
      idMap.set(n.id, id);
      return {
        ...n,
        id,
        selected: true,
        position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET },
        data: { ...n.data },
      };
    });
    const edges = clipboard.edges.map((e) => ({
      ...e,
      id: nextId("edge"),
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
      data: { ...(e.data as FlowEdgeData) },
    }));
    commit(set, get, {
      nodes: [...get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...nodes],
      edges: [...get().edges, ...edges],
    });
    set({ selectedNodeId: nodes.length === 1 ? nodes[0]!.id : null, selectedEdgeId: null });
    return nodes.length;
  },
  duplicateSelection: () => {
    const copied = get().copySelection();
    return copied ? get().pasteClipboard() : 0;
  },
  selectAll: () => {
    set({
      nodes: get().nodes.map((n) => ({ ...n, selected: true })),
      edges: get().edges.map((e) => ({ ...e, selected: true })),
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },
  reconnect: (edgeId, connection) => {
    commit(set, get, {
      edges: get().edges.map((e) =>
        e.id === edgeId
          ? { ...e, source: connection.source ?? e.source, target: connection.target ?? e.target }
          : e,
      ),
    });
  },
  setPlaying: (playing) => set({ playing }),
  setSpeedScale: (speedScale) => set({ speedScale }),
  setShowLabels: (showLabels) => set({ showLabels }),

  undo: () => {
    const { past, future, nodes, edges } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set({
      past: past.slice(0, -1),
      future: [{ nodes, edges }, ...future].slice(0, HISTORY_LIMIT),
      nodes: prev.nodes,
      edges: prev.edges,
      dirty: true,
    });
    scheduleAutosave();
  },
  redo: () => {
    const { past, future, nodes, edges } = get();
    const next = future[0];
    if (!next) return;
    set({
      past: [...past, { nodes, edges }].slice(-HISTORY_LIMIT),
      future: future.slice(1),
      nodes: next.nodes,
      edges: next.edges,
      dirty: true,
    });
    scheduleAutosave();
  },

  currentGraph: () => toAir(get().nodes, get().edges),
  issues: () => validateGraph(toAir(get().nodes, get().edges)),
  applyAutoLayout: () => {
    const laid = autoLayout(toAir(get().nodes, get().edges));
    const { nodes } = fromAir(laid);
    const byId = new Map(nodes.map((n) => [n.id, n.position]));
    commit(set, get, {
      nodes: get().nodes.map((n) => ({ ...n, position: byId.get(n.id) ?? n.position })),
    });
  },

  loadGraph: (graph, meta) => {
    const { nodes, edges } = fromAir(graph);
    const maxId = [...nodes, ...edges].reduce((max, item) => {
      const n = Number(item.id.split("_").pop());
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, idCounter);
    idCounter = maxId + 1;
    set({
      nodes,
      edges,
      past: [],
      future: [],
      dirty: meta.dirty ?? false,
      projectId: meta.projectId,
      projectName: meta.name,
      sourceType: meta.sourceType,
      graphVersion: meta.graphVersion ?? 1,
      selectedNodeId: null,
      selectedEdgeId: edges[0]?.id ?? null,
    });
  },

  openProject: (projectId) => {
    const project = getProject(projectId);
    if (!project) return false;
    get().loadGraph(project.graph, {
      projectId: project.project_id,
      name: project.name,
      sourceType: project.source_type,
      graphVersion: project.graph_version,
    });
    return true;
  },

  saveProject: (note = "manual save") => {
    const { projectId, projectName, sourceType } = get();
    const graph = get().currentGraph();
    try {
      if (!projectId) {
        const created = createProject(projectName, sourceType, graph);
        set({ projectId: created.project_id, graphVersion: created.graph_version, dirty: false });
        discardAutosave(null);
        return true;
      }
      const updated = saveVersion(projectId, graph, note);
      if (!updated) {
        // Project deleted elsewhere (another tab): recreate rather than lose work.
        const created = createProject(projectName, sourceType, graph);
        set({ projectId: created.project_id, graphVersion: created.graph_version, dirty: false });
        discardAutosave(projectId);
        discardAutosave(null);
        return true;
      }
      renameProject(projectId, projectName);
      set({ graphVersion: updated.graph_version, dirty: false });
      discardAutosave(projectId);
      return true;
    } catch {
      return false;
    }
  },

  setProjectName: (projectName) => {
    set({ projectName, dirty: true });
    scheduleAutosave();
  },
}));

// Autosave reads its snapshot straight from the store, and reports its state
// back into it for the toolbar indicator.
configureAutosave(
  () => {
    const s = useStudio.getState();
    if (!s.dirty) return null;
    return {
      projectId: s.projectId,
      name: s.projectName,
      sourceType: s.sourceType,
      baseGraphVersion: s.projectId ? s.graphVersion : 0,
      graph: toAir(s.nodes, s.edges),
    };
  },
  (autosaveState, lastAutosaveAt) =>
    useStudio.setState(lastAutosaveAt ? { autosaveState, lastAutosaveAt } : { autosaveState }),
);

/** Flush any pending draft before a manual save so nothing races it. */
export { flushAutosave };
