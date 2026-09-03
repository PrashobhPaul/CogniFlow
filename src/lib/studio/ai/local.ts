import { useSyncExternalStore } from "react";
import { getAiSettings, type AiDevice } from "./settings";

/**
 * Main-thread client for the Transformers.js worker. Exposes a tiny observable
 * status (idle / downloading / ready / error, with per-file progress) that the
 * UI renders, and promise-based load / generate calls.
 */

export type ModelKind = "text" | "vision";

export interface ModelProgress {
  kind: ModelKind;
  modelId: string;
  file: string | null;
  progress: number | null;
  loaded: number | null;
  total: number | null;
}

export interface LocalModelState {
  status: "idle" | "loading" | "generating" | "ready" | "error";
  kind: ModelKind | null;
  modelId: string | null;
  device: "webgpu" | "wasm" | null;
  files: Record<string, ModelProgress>;
  overall: number; // 0..1 across files seen so far
  error: string | null;
  /** Non-fatal advice from the worker, e.g. WebGPU unavailable so WASM is used. */
  note: string | null;
  partial: string; // streamed tokens of the current generation
  supported: boolean;
}

const initial: LocalModelState = {
  status: "idle",
  kind: null,
  modelId: null,
  device: null,
  files: {},
  overall: 0,
  error: null,
  note: null,
  partial: "",
  supported: typeof Worker !== "undefined" && typeof WebAssembly !== "undefined",
};

let state = initial;
const listeners = new Set<() => void>();
const emit = (patch: Partial<LocalModelState>) => {
  state = { ...state, ...patch };
  for (const l of listeners) l();
};

export function useLocalModel(): LocalModelState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => initial,
  );
}

let worker: Worker | null = null;
let nextId = 1;
/** Set after a runtime failure: the next worker is told to load ONNX Runtime from the CDN instead. */
let runtimeSource: "site" | "cdn" | null = null;

const RUNTIME_FAILURE =
  /runtime could not start|no available backend|ONNX Runtime files|initializeWebAssembly|dynamically imported/i;

/**
 * ONNX Runtime can only initialise once per worker, so a runtime failure is
 * retried in a fresh worker that loads the runtime from the CDN fallback.
 */
async function withRuntimeRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (runtimeSource === "cdn" || !RUNTIME_FAILURE.test(message)) throw e;
    runtimeSource = "cdn";
    worker?.terminate();
    worker = null;
    emit({ note: "Retrying with the ONNX Runtime CDN fallback…" });
    return await run();
  }
}
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>();
const loadWaiters = new Map<string, { resolve: () => void; reject: (e: Error) => void }[]>();

function ensureWorker(): Worker {
  if (worker) return worker;
  if (!state.supported)
    throw new Error("This browser cannot run in-browser models (no Web Workers / WebAssembly).");
  worker = new Worker(new URL("./local.worker.ts", import.meta.url), { type: "module" });
  if (runtimeSource) worker.postMessage({ type: "configure", source: runtimeSource });
  worker.onmessage = (event: MessageEvent) => {
    const m = event.data;
    switch (m.type) {
      case "progress": {
        const key = `${m.kind}:${m.modelId}:${m.file ?? "?"}`;
        const files = { ...state.files, [key]: m as ModelProgress };
        const values = Object.values(files).filter((f) => f.progress !== null);
        // Byte-weighted where sizes are known, so a 200 MB decoder at 10% does
        // not read as "55% done" because tokenizer.json finished.
        const sized = values.filter((f) => f.total && f.total > 0);
        const overall =
          sized.length === values.length && sized.length > 0
            ? sized.reduce((s, f) => s + (f.loaded ?? 0), 0) /
              Math.max(
                1,
                sized.reduce((s, f) => s + (f.total ?? 0), 0),
              )
            : values.length
              ? values.reduce((s, f) => s + (f.progress ?? 0), 0) / (values.length * 100)
              : 0;
        emit({
          status: state.status === "generating" ? "generating" : "loading",
          files,
          overall,
          kind: m.kind,
          modelId: m.modelId,
        });
        break;
      }
      case "loaded": {
        emit({
          status: "ready",
          kind: m.kind,
          modelId: m.modelId,
          device: m.device,
          overall: 1,
          error: null,
        });
        for (const w of loadWaiters.get(`${m.kind}:${m.modelId}`) ?? []) w.resolve();
        loadWaiters.delete(`${m.kind}:${m.modelId}`);
        break;
      }
      case "token":
        emit({ partial: state.partial + m.text });
        break;
      case "result": {
        const p = pending.get(m.id);
        pending.delete(m.id);
        emit({ status: "ready", device: m.device, error: null });
        p?.resolve(m.text);
        break;
      }
      case "error": {
        const err = new Error(m.message);
        if (m.id && pending.has(m.id)) {
          pending.get(m.id)!.reject(err);
          pending.delete(m.id);
        }
        for (const [key, ws] of loadWaiters) {
          for (const w of ws) w.reject(err);
          loadWaiters.delete(key);
        }
        if (m.id && probes.has(m.id)) {
          probes.get(m.id)!.reject(err);
          probes.delete(m.id);
        }
        emit({ status: "error", error: m.message });
        break;
      }
      case "unloaded":
        emit({ ...initial, supported: state.supported });
        break;
      case "probe-result": {
        const p = probes.get(m.id);
        probes.delete(m.id);
        p?.resolve({
          results: m.results,
          source: m.source,
          files: m.files,
          ortVersion: m.ortVersion,
        });
        break;
      }
      case "note":
        emit({ note: m.message ?? null });
        break;
      default:
        break;
    }
  };
  worker.onerror = (e) => emit({ status: "error", error: e.message || "Model worker crashed." });
  return worker;
}

export function loadLocalModel(
  kind: ModelKind,
  modelId: string,
  device: AiDevice = getAiSettings().device,
): Promise<void> {
  return withRuntimeRetry(() => {
    const w = ensureWorker();
    emit({ status: "loading", kind, modelId, error: null, files: {}, overall: 0 });
    return new Promise<void>((resolve, reject) => {
      const key = `${kind}:${modelId}`;
      loadWaiters.set(key, [...(loadWaiters.get(key) ?? []), { resolve, reject }]);
      w.postMessage({ type: "load", kind, modelId, device });
    });
  });
}

export function generateLocal(opts: {
  kind: ModelKind;
  modelId: string;
  system: string;
  user: string;
  imageDataUrl?: string;
  maxNewTokens?: number;
  device?: AiDevice;
  signal?: AbortSignal | undefined;
}): Promise<string> {
  return withRuntimeRetry(() => {
    const w = ensureWorker();
    const id = nextId++;
    emit({
      status: state.status === "ready" ? "generating" : "loading",
      kind: opts.kind,
      modelId: opts.modelId,
      partial: "",
      error: null,
    });
    return new Promise<string>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      if (opts.signal) {
        opts.signal.addEventListener(
          "abort",
          () => {
            worker?.postMessage({ type: "cancel" });
            pending.delete(id);
            emit({ status: "ready", partial: "" });
            reject(new DOMException("Generation cancelled.", "AbortError"));
          },
          { once: true },
        );
      }
      w.postMessage({
        type: "generate",
        id,
        kind: opts.kind,
        modelId: opts.modelId,
        device: opts.device ?? getAiSettings().device,
        system: opts.system,
        user: opts.user,
        imageDataUrl: opts.imageDataUrl,
        maxNewTokens: opts.maxNewTokens ?? 1024,
      });
    });
  });
}

/**
 * Fire-and-forget warm-up: runtime pre-flight, model download and shader
 * compilation happen while the user is still typing, so the first compile
 * responds in seconds instead of minutes. Safe to call repeatedly.
 */
export function preloadLocalModel(kind: ModelKind): void {
  const settings = getAiSettings();
  if (settings.engine !== "local") return;
  const modelId = kind === "vision" ? settings.visionModel : settings.textModel;
  if (!modelId || !state.supported) return;
  if (state.status === "loading" || state.status === "generating") return;
  loadLocalModel(kind, modelId).catch(() => {
    /* surfaced via the status store; the rule engine still works */
  });
}

export interface RuntimeProbe {
  results: { device: "webgpu" | "wasm"; ok: boolean; detail: string; ms: number }[];
  /** Where the runtime files were loaded from: this site, or the jsDelivr fallback. */
  source: "site" | "cdn";
  files: { mjs: string; wasm: string };
  ortVersion: string | null;
}

const probes = new Map<
  number,
  { resolve: (r: RuntimeProbe) => void; reject: (e: Error) => void }
>();

/**
 * Runs a 1-op ONNX graph on WebGPU and WASM inside the model worker. Proves
 * the runtime files served from this site load and execute, without
 * downloading any model weights.
 */
export function probeLocalRuntime(): Promise<RuntimeProbe> {
  return withRuntimeRetry(() => {
    const w = ensureWorker();
    const id = nextId++;
    return new Promise<RuntimeProbe>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (probes.delete(id)) reject(new Error("The runtime self-test timed out after 60 s."));
      }, 60_000);
      probes.set(id, {
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      w.postMessage({ type: "probe", id });
    });
  });
}

export function unloadLocalModels() {
  worker?.postMessage({ type: "unload" });
}

/** Removes downloaded weights from the browser Cache API (vendored site files are not affected). */
export async function clearModelCache(): Promise<boolean> {
  try {
    return await caches.delete("archanimate-models-v1");
  } catch {
    return false;
  }
}

export function formatBytes(n: number | null): string {
  if (n === null) return "";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
