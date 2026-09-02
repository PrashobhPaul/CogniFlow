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
import { createProject, getProject, saveVersion, type SourceType } from "./projects";
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
    meta: { projectId: string | null; name: string; sourceType: SourceType; graphVersion?: number },
  ) => void;
  openProject: (projectId: string) => boolean;
  saveProject: (note?: string) => void;
  setProjectName: (name: string) => void;
}

const commit = (
  set: (partial: Partial<StudioState>) => void,
  get: () => StudioState,
  next: Partial<Snapshot>,
) => {
  const { nodes, edges, past } = get();
  set({
    past: [...past.slice(-HISTORY_LIMIT), { nodes, edges }],
    future: [],
    dirty: true,
    ...next,
  });
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
    const { selectedNodeId, selectedEdgeId, nodes, edges } = get();
    if (selectedNodeId) {
      commit(set, get, {
        nodes: nodes.filter((n) => n.id !== selectedNodeId),
        edges: edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
      });
      set({ selectedNodeId: null });
    } else if (selectedEdgeId) {
      commit(set, get, { edges: edges.filter((e) => e.id !== selectedEdgeId) });
      set({ selectedEdgeId: null });
    }
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
      dirty: false,
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
    if (!projectId) {
      const created = createProject(projectName, sourceType, graph);
      set({ projectId: created.project_id, graphVersion: created.graph_version, dirty: false });
      return;
    }
    const updated = saveVersion(projectId, graph, note);
    set({ graphVersion: updated?.graph_version ?? get().graphVersion, dirty: false });
  },

  setProjectName: (projectName) => set({ projectName, dirty: true }),
}));
