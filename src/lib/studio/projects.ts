import { graphHash, MOTION_ENGINE_VERSION, RENDERER_VERSION, type AirGraph } from "./air";

/**
 * Prototype persistence layer. LocalStorage is explicitly a prototype-only store —
 * the production project model (owner_id / organization_id / server-side authorization)
 * requires the Cloud backend.
 */

export type SourceType = "blank" | "prompt" | "image" | "drawio" | "mermaid";

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
const DRAFT_KEY = "aims.drafts.v1";
/** Draft slot for work that has no project yet (blank canvas, default graph). */
export const UNSAVED_DRAFT_ID = "unsaved";
const isBrowser = () => typeof window !== "undefined";

/** Thrown when localStorage rejects a write even after trimming history. */
export class StorageFullError extends Error {
  constructor() {
    super("Browser storage is full. Export your work, then delete old projects or versions.");
    this.name = "StorageFullError";
  }
}

const isQuotaError = (e: unknown): boolean =>
  e instanceof DOMException &&
  (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);

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
  try {
    window.localStorage.setItem(KEY, JSON.stringify(projects));
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    // Trim each project's version history and retry once before giving up.
    const trimmed = projects.map((p) => ({ ...p, versions: p.versions.slice(-5) }));
    try {
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      throw new StorageFullError();
    }
  }
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
  clearDraft(id);
}

// ── Drafts: crash / refresh recovery ─────────────────────────────────────────
// Unsaved edits are mirrored into a separate key (debounced by the store) so a
// refresh, tab crash or accidental navigation never loses work. Drafts never
// touch the projects array or its version history.

export interface Draft {
  /** Project the draft belongs to, or null for the unsaved slot. */
  project_id: string | null;
  name: string;
  source_type: SourceType;
  /** graph_version the draft diverged from (0 for unsaved work). */
  base_graph_version: number;
  graph_hash: string;
  graph: AirGraph;
  updated_at: string;
}

function readDrafts(): Record<string, Draft> {
  if (!isBrowser()) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<
      string,
      Draft
    >;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDrafts(drafts: Record<string, Draft>) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    // Keep only the draft being written; stale drafts are worth less than this one.
    const latest = Object.entries(drafts).sort(([, a], [, b]) =>
      b.updated_at.localeCompare(a.updated_at),
    )[0];
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify(latest ? { [latest[0]]: latest[1] } : {}),
      );
    } catch {
      throw new StorageFullError();
    }
  }
}

export function getDraft(projectId: string | null): Draft | undefined {
  return readDrafts()[projectId ?? UNSAVED_DRAFT_ID];
}

export function saveDraft(draft: Draft) {
  const drafts = readDrafts();
  drafts[draft.project_id ?? UNSAVED_DRAFT_ID] = draft;
  writeDrafts(drafts);
}

export function clearDraft(projectId: string | null) {
  const drafts = readDrafts();
  const key = projectId ?? UNSAVED_DRAFT_ID;
  if (!(key in drafts)) return;
  delete drafts[key];
  writeDrafts(drafts);
}

/** Project ids that currently have unsaved drafts (for the projects page badge). */
export function draftProjectIds(): Set<string> {
  return new Set(Object.keys(readDrafts()).filter((k) => k !== UNSAVED_DRAFT_ID));
}
