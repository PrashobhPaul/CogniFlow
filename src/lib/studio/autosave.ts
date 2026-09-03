import { graphHash, type AirGraph } from "./air";
import { clearDraft, getDraft, saveDraft, StorageFullError, type SourceType } from "./projects";

/**
 * Debounced draft writer. The store calls schedule() after every dirty change;
 * the draft lands in localStorage ~800 ms after the last edit, and flush() is
 * called synchronously on pagehide / tab-hide / manual save so a closing tab
 * never loses more than the keystroke in flight.
 */

export type AutosaveState = "idle" | "pending" | "saved" | "error";

export interface AutosaveSnapshot {
  projectId: string | null;
  name: string;
  sourceType: SourceType;
  baseGraphVersion: number;
  graph: AirGraph;
}

const DEBOUNCE_MS = 800;

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingSnapshot: (() => AutosaveSnapshot | null) | null = null;
let lastWrittenHash: string | null = null;
let lastWrittenName: string | null = null;
let onState: ((state: AutosaveState, at: string | null) => void) | null = null;

export function configureAutosave(
  snapshot: () => AutosaveSnapshot | null,
  stateListener: (state: AutosaveState, at: string | null) => void,
) {
  pendingSnapshot = snapshot;
  onState = stateListener;
}

export function scheduleAutosave() {
  if (!pendingSnapshot) return;
  if (timer) clearTimeout(timer);
  onState?.("pending", null);
  timer = setTimeout(flushAutosave, DEBOUNCE_MS);
}

/** Write the pending draft immediately. Safe to call when nothing is pending. */
export function flushAutosave() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const snap = pendingSnapshot?.();
  if (!snap) return;
  const hash = graphHash(snap.graph);
  if (hash === lastWrittenHash && snap.name === lastWrittenName) return;
  try {
    saveDraft({
      project_id: snap.projectId,
      name: snap.name,
      source_type: snap.sourceType,
      base_graph_version: snap.baseGraphVersion,
      graph_hash: hash,
      graph: snap.graph,
      updated_at: new Date().toISOString(),
    });
    lastWrittenHash = hash;
    lastWrittenName = snap.name;
    onState?.("saved", new Date().toISOString());
  } catch (e) {
    onState?.("error", null);
    if (!(e instanceof StorageFullError)) throw e;
  }
}

/** Drop the pending timer and the stored draft (called after a real save). */
export function discardAutosave(projectId: string | null) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  lastWrittenHash = null;
  lastWrittenName = null;
  try {
    clearDraft(projectId);
  } catch {
    // Clearing a draft failing (quota during delete is impossible) is ignorable.
  }
  onState?.("idle", null);
}

/**
 * Look up a draft that is newer than the saved project state. Returns the
 * draft only when it genuinely diverges, so undoing back to the saved graph
 * does not resurface a phantom recovery prompt.
 */
export function recoverableDraft(
  projectId: string | null,
  savedHash: string | null,
  savedName: string | null,
) {
  const draft = getDraft(projectId);
  if (!draft) return null;
  if (savedHash && draft.graph_hash === savedHash && (!savedName || draft.name === savedName))
    return null;
  return draft;
}

/** Register the lifecycle flush handlers once per page. */
let lifecycleArmed = false;
export function armAutosaveLifecycle() {
  if (lifecycleArmed || typeof window === "undefined") return;
  lifecycleArmed = true;
  window.addEventListener("pagehide", flushAutosave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAutosave();
  });
}
