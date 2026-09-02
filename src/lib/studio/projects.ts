import { graphHash, MOTION_ENGINE_VERSION, RENDERER_VERSION, type AirGraph } from "./air";

/**
 * Prototype persistence layer. LocalStorage is explicitly a prototype-only store —
 * the production project model (owner_id / organization_id / server-side authorization)
 * requires the Cloud backend.
 */

export type SourceType = "blank" | "prompt" | "image" | "drawio";

export interface ProjectVersion {
  graph_version: number;
  graph_hash: string;
  created_at: string;
  note: string;
  graph: AirGraph;
}

export interface Project {
  project_id: string;
  name: string;
  source_type: SourceType;
  source_file_reference: string | null;
  graph: AirGraph;
  graph_version: number;
  graph_hash: string;
  renderer_version: string;
  motion_engine_version: string;
  created_at: string;
  updated_at: string;
  versions: ProjectVersion[];
}

const KEY = "aims.projects.v1";
const isBrowser = () => typeof window !== "undefined";

export function listProjects(): Project[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      : [];
  } catch {
    return [];
  }
}

function persist(projects: Project[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(projects));
}

export function getProject(id: string): Project | undefined {
  return listProjects().find((p) => p.project_id === id);
}

export function createProject(
  name: string,
  sourceType: SourceType,
  graph: AirGraph,
  sourceRef: string | null = null,
): Project {
  const now = new Date().toISOString();
  const hash = graphHash(graph);
  const project: Project = {
    project_id: `prj_${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim() || "Untitled architecture",
    source_type: sourceType,
    source_file_reference: sourceRef,
    graph,
    graph_version: 1,
    graph_hash: hash,
    renderer_version: RENDERER_VERSION,
    motion_engine_version: MOTION_ENGINE_VERSION,
    created_at: now,
    updated_at: now,
    versions: [{ graph_version: 1, graph_hash: hash, created_at: now, note: "created", graph }],
  };
  persist([project, ...listProjects()]);
  return project;
}

export function saveVersion(
  id: string,
  graph: AirGraph,
  note = "manual save",
): Project | undefined {
  const projects = listProjects();
  const index = projects.findIndex((p) => p.project_id === id);
  if (index === -1) return undefined;
  const existing = projects[index]!;
  const hash = graphHash(graph);
  const now = new Date().toISOString();
  const version = existing.graph_version + 1;
  const updated: Project = {
    ...existing,
    graph,
    graph_version: version,
    graph_hash: hash,
    updated_at: now,
    versions: [
      ...existing.versions.slice(-24),
      { graph_version: version, graph_hash: hash, created_at: now, note, graph },
    ],
  };
  projects[index] = updated;
  persist(projects);
  return updated;
}

export function renameProject(id: string, name: string) {
  const projects = listProjects().map((p) =>
    p.project_id === id
      ? { ...p, name: name.trim() || p.name, updated_at: new Date().toISOString() }
      : p,
  );
  persist(projects);
}

export function deleteProject(id: string) {
  persist(listProjects().filter((p) => p.project_id !== id));
}
