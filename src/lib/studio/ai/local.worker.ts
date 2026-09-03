/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  env,
  AutoTokenizer,
  AutoModelForCausalLM,
  AutoProcessor,
  AutoModelForVision2Seq,
  InterruptableStoppingCriteria,
  RawImage,
  TextStreamer,
} from "@huggingface/transformers";
// Same specifier Transformers.js imports, so this is the very module instance (and env) it runs on.
import * as ort from "onnxruntime-web/webgpu";

/**
 * Web Worker that runs open-weight models with Transformers.js (ONNX Runtime
 * Web, WebGPU when available, WASM otherwise). Model files are resolved in
 * this order:
 *   1. this site's /models/<id>/ (vendored, possibly split into .partNNN
 *      chunks that the custom cache below stitches back together);
 *   2. the browser Cache API (previous downloads);
 *   3. the Hugging Face Hub (public models, no token).
 * Everything stays in the browser — no prompt or image leaves the device.
 */

type LoadMsg = {
  type: "load";
  kind: "text" | "vision";
  modelId: string;
  device: "auto" | "webgpu" | "wasm";
};
type GenerateMsg = {
  type: "generate";
  id: number;
  kind: "text" | "vision";
  modelId: string;
  device: "auto" | "webgpu" | "wasm";
  system: string;
  user: string;
  imageDataUrl?: string;
  maxNewTokens: number;
};
type ProbeMsg = { type: "probe"; id: number };
type ConfigureMsg = { type: "configure"; source: "site" | "cdn" | null };
type InMsg =
  LoadMsg | GenerateMsg | ProbeMsg | ConfigureMsg | { type: "unload" } | { type: "cancel" };

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
const ORIGIN = self.location.origin;
const LOCAL_ROOT = `${ORIGIN}${BASE}models/`;
// Historical name kept stable across the CogniFlow rename so cached weights survive.
const CACHE_NAME = "archanimate-models-v1";

// ── Transformers.js environment ──────────────────────────────────────────────
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.localModelPath = LOCAL_ROOT;
env.useBrowserCache = false;
env.useCustomCache = true;

// ── ONNX Runtime files ──────────────────────────────────────────────────────
// The runtime's loader (.mjs) and WebAssembly binary are served from this site
// (scripts/copy-ort.mjs) with jsDelivr as fallback. A pre-flight request picks
// the first location that answers, so a stale cache, an ad-blocker or a
// missing file never leaves the model engine without a backend. The version
// query defeats stale copies of the unhashed site files after an upgrade.
const ORT_VERSION: string = (ort.env as any).versions?.web ?? "";
const SITE_ORT = `${ORIGIN}${BASE}ort/`;
const CDN_ORT = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

function ortFiles(prefix: string): { mjs: string; wasm: string } {
  const name = IS_SAFARI ? "ort-wasm-simd-threaded" : "ort-wasm-simd-threaded.asyncify";
  const bust = prefix === SITE_ORT && ORT_VERSION ? `?v=${encodeURIComponent(ORT_VERSION)}` : "";
  return { mjs: `${prefix}${name}.mjs${bust}`, wasm: `${prefix}${name}.wasm${bust}` };
}

async function reachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-cache" });
    return r.ok;
  } catch {
    return false;
  }
}

interface Runtime {
  source: "site" | "cdn";
  files: { mjs: string; wasm: string };
  webgpu: boolean;
  note: string | null;
}
let runtime: Promise<Runtime> | null = null;
let forcedSource: "site" | "cdn" | null = null;

function ensureRuntime(): Promise<Runtime> {
  if (!runtime) {
    runtime = (async () => {
      const order =
        forcedSource === "cdn"
          ? [CDN_ORT]
          : forcedSource === "site"
            ? [SITE_ORT]
            : [SITE_ORT, CDN_ORT];
      let chosen: string | null = null;
      const tried: string[] = [];
      for (const prefix of order) {
        const f = ortFiles(prefix);
        if ((await reachable(f.mjs)) && (await reachable(f.wasm))) {
          chosen = prefix;
          break;
        }
        tried.push(f.mjs);
      }
      if (!chosen) {
        throw new Error(
          `The ONNX Runtime files could not be reached (tried ${tried.join(" and ")}). Check your network or ad-blocker, then retry.`,
        );
      }
      const files = ortFiles(chosen);
      if (env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = files;
      const hasGpu = "gpu" in navigator && !!(navigator as any).gpu;
      const gpu = hasGpu ? await probeProvider("webgpu") : null;
      const note = !hasGpu
        ? "WebGPU is not available in this browser; using WASM."
        : gpu && !gpu.ok
          ? `WebGPU failed (${gpu.detail.slice(0, 140)}); using WASM.`
          : null;
      return { source: chosen === SITE_ORT ? "site" : "cdn", files, webgpu: !!gpu?.ok, note };
    })();
    runtime.catch(() => {
      runtime = null;
    });
  }
  return runtime;
}

/** Honours the preference when the runtime can, and says so when it cannot. */
async function resolveDevice(pref: "auto" | "webgpu" | "wasm"): Promise<"webgpu" | "wasm"> {
  const rt = await ensureRuntime();
  if (pref === "wasm") return "wasm";
  if (rt.webgpu) return "webgpu";
  if (pref === "webgpu") self.postMessage({ type: "note", message: rt.note });
  return "wasm";
}

interface Manifest {
  files: Record<string, { size: number; chunks: string[] }>;
}
const manifests = new Map<string, Promise<Manifest | null>>();

function manifestFor(modelId: string): Promise<Manifest | null> {
  let p = manifests.get(modelId);
  if (!p) {
    p = fetch(`${LOCAL_ROOT}${modelId}/manifest.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .catch(() => null);
    manifests.set(modelId, p);
  }
  return p;
}

async function openCache(): Promise<Cache | null> {
  try {
    return "caches" in self ? await caches.open(CACHE_NAME) : null;
  } catch {
    return null;
  }
}

/**
 * Assemble a chunked vendored file once per worker. The metadata prefetch and
 * the real load both hit customCache.match for the same URL, so memoising the
 * Blob halves the work and the peak memory of a model load. The assembled
 * bytes are also written into Cache Storage so revisits skip the network even
 * after GitHub Pages' short HTTP cache expires.
 */
const assembled = new Map<string, Promise<Blob | null>>();

function assembleChunked(modelId: string, file: string): Promise<Blob | null> {
  const key = `${modelId}/${file}`;
  let p = assembled.get(key);
  if (!p) {
    p = (async () => {
      const manifest = await manifestFor(modelId);
      const entry = manifest?.files[file];
      if (!entry) return null; // not vendored → let the library fetch (404 → HF fallback)
      if (entry.chunks.length === 1 && entry.chunks[0] === file) return null; // plain file
      const url = `${LOCAL_ROOT}${modelId}/${file}`;
      const cache = await openCache();
      const cached = await cache?.match(url);
      if (cached) return await cached.blob();
      // Bounded-parallel chunk fetch: ~3× faster than sequential on HTTP/2.
      const CONCURRENCY = 4;
      const buffers: ArrayBuffer[] = new Array(entry.chunks.length);
      let next = 0;
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, entry.chunks.length) },
        async () => {
          while (next < entry.chunks.length) {
            const i = next++;
            const chunk = entry.chunks[i]!;
            const res = await fetch(`${LOCAL_ROOT}${modelId}/${chunk}`);
            if (!res.ok) throw new Error(`Missing model chunk ${chunk} (${res.status})`);
            buffers[i] = await res.arrayBuffer();
          }
        },
      );
      await Promise.all(workers);
      const blob = new Blob(buffers);
      if (cache) {
        try {
          await cache.put(
            url,
            new Response(blob, {
              headers: {
                "Content-Length": String(entry.size),
                "Content-Type": "application/octet-stream",
              },
            }),
          );
        } catch {
          /* quota exceeded — serve from memory this session */
        }
      }
      return blob;
    })();
    p.catch(() => assembled.delete(key));
    assembled.set(key, p);
  }
  return p;
}

/** Reassembles chunked local files; otherwise defers to the Cache API. */
env.customCache = {
  async match(request: string) {
    if (request.startsWith(LOCAL_ROOT)) {
      const rel = request.slice(LOCAL_ROOT.length);
      // rel = "<org>/<name>/<file path>"
      const parts = rel.split("/");
      if (parts.length < 3) return undefined;
      const modelId = `${parts[0]}/${parts[1]}`;
      const file = parts.slice(2).join("/");
      const blob = await assembleChunked(modelId, file);
      if (!blob) return undefined;
      return new Response(blob, {
        headers: {
          "Content-Length": String(blob.size),
          "Content-Type": "application/octet-stream",
        },
      });
    }
    const cache = await openCache();
    if (!cache) return undefined;
    const hit = await cache.match(request);
    return hit ?? undefined;
  },
  async put(request: string, response: Response) {
    if (request.startsWith(LOCAL_ROOT)) return; // assembleChunked persists these itself
    const cache = await openCache();
    if (!cache) return;
    try {
      await cache.put(request, response);
    } catch {
      /* quota exceeded etc. — keep going without caching */
    }
  },
};

// ── Model registry ──────────────────────────────────────────────────────────
const loaded = new Map<string, Promise<any>>();

function progress(kind: string, modelId: string) {
  return (data: any) => {
    if (!data || typeof data !== "object") return;
    if (
      data.status === "progress" ||
      data.status === "done" ||
      data.status === "initiate" ||
      data.status === "ready"
    ) {
      self.postMessage({
        type: "progress",
        kind,
        modelId,
        file: data.file ?? null,
        status: data.status,
        progress: typeof data.progress === "number" ? data.progress : null,
        loaded: data.loaded ?? null,
        total: data.total ?? null,
      });
    }
  };
}

function loadText(modelId: string, device: "webgpu" | "wasm") {
  const key = `text:${modelId}:${device}`;
  let p = loaded.get(key);
  if (!p) {
    p = (async () => {
      const cb = progress("text", modelId);
      const tokenizer = await AutoTokenizer.from_pretrained(modelId, { progress_callback: cb });
      const model = await AutoModelForCausalLM.from_pretrained(modelId, {
        dtype: "q4f16",
        device,
        progress_callback: cb,
      });
      return { tokenizer, model };
    })();
    p.catch(() => loaded.delete(key));
    loaded.set(key, p);
  }
  return p;
}

function loadVision(modelId: string, device: "webgpu" | "wasm") {
  const key = `vision:${modelId}:${device}`;
  let p = loaded.get(key);
  if (!p) {
    p = (async () => {
      const cb = progress("vision", modelId);
      const processor = await AutoProcessor.from_pretrained(modelId, { progress_callback: cb });
      const model = await AutoModelForVision2Seq.from_pretrained(modelId, {
        dtype: { embed_tokens: "fp16", vision_encoder: "q4f16", decoder_model_merged: "q4f16" },
        device,
        progress_callback: cb,
      });
      return { processor, model };
    })();
    p.catch(() => loaded.delete(key));
    loaded.set(key, p);
  }
  return p;
}

/** Lets a 'cancel' message stop the current generation at the next step. */
const interrupter = new InterruptableStoppingCriteria();

async function generateText(msg: GenerateMsg): Promise<string> {
  const device = await resolveDevice(msg.device);
  const { tokenizer, model } = await loadText(msg.modelId, device);
  const messages = [
    { role: "system", content: msg.system },
    { role: "user", content: msg.user },
  ];
  const inputs: any = tokenizer.apply_chat_template(messages, {
    add_generation_prompt: true,
    return_dict: true,
    // Qwen3-style templates default to a <think> preamble that would burn the
    // whole token budget before any graph appears.
    enable_thinking: false,
  } as any);
  const streamer = new TextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (t: string) => self.postMessage({ type: "token", id: msg.id, text: t }),
  } as any);
  interrupter.reset();
  const output: any = await model.generate({
    ...inputs,
    max_new_tokens: msg.maxNewTokens,
    do_sample: false,
    repetition_penalty: 1.05,
    no_repeat_ngram_size: 6,
    streamer,
    stopping_criteria: interrupter,
  });
  const promptLen = inputs.input_ids.dims.at(-1);
  const decoded = tokenizer.batch_decode(output.slice(null, [promptLen, null]), {
    skip_special_tokens: true,
  });
  return decoded[0] ?? "";
}

async function generateVision(msg: GenerateMsg): Promise<string> {
  const device = await resolveDevice(msg.device);
  const { processor, model } = await loadVision(msg.modelId, device);
  const image = await RawImage.fromURL(msg.imageDataUrl!);
  // SmolVLM's chat template iterates message content, so every part must be a
  // typed content object — a bare string throws inside the jinja render.
  const messages = [
    { role: "system", content: [{ type: "text", text: msg.system }] },
    { role: "user", content: [{ type: "image" }, { type: "text", text: msg.user }] },
  ];
  const text = processor.apply_chat_template(
    messages as any,
    { add_generation_prompt: true } as any,
  );
  // Dense diagrams need the tiled encoding; small images stay single-pass.
  const split = Math.max(image.width, image.height) > 768;
  const inputs: any = await processor(text, [image], { do_image_splitting: split } as any);
  const output: any = await model.generate({
    ...inputs,
    max_new_tokens: msg.maxNewTokens,
    do_sample: false,
  });
  const promptLen = inputs.input_ids.dims.at(-1);
  const decoded = processor.batch_decode(output.slice(null, [promptLen, null]), {
    skip_special_tokens: true,
  });
  return decoded[0] ?? "";
}

// ── Runtime self-test ───────────────────────────────────────────────────────
// A 1-op Identity graph (X → Y, float32[1]); running it proves the ONNX
// Runtime loader, the WASM files served from this site and the execution
// provider all work — independently of any model download.
const TINY_ONNX =
  "CAcSC2FyY2hhbmltYXRlOjsKFAoBWBIBWRoCaWQiCElkZW50aXR5EgFnWg8KAVgSCgoICAESBAoCCAFiDwoBWRIKCggIARIECgIIAUIECgAQDQ==";

export interface ProbeResult {
  device: "webgpu" | "wasm";
  ok: boolean;
  detail: string;
  ms: number;
}

async function probeProvider(device: "webgpu" | "wasm"): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    if (device === "webgpu" && !("gpu" in navigator && (navigator as any).gpu)) {
      return { device, ok: false, detail: "WebGPU is not available in this browser.", ms: 0 };
    }
    const bytes = Uint8Array.from(atob(TINY_ONNX), (ch) => ch.charCodeAt(0));
    const session = await ort.InferenceSession.create(bytes, { executionProviders: [device] });
    const out = await session.run({ X: new ort.Tensor("float32", new Float32Array([42]), [1]) });
    const y = Array.from(out["Y"]!.data as Float32Array);
    await session.release();
    return {
      device,
      ok: y[0] === 42,
      detail: y[0] === 42 ? "ok" : `unexpected output ${y.join(",")}`,
      ms: Math.round(performance.now() - t0),
    };
  } catch (e) {
    return {
      device,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      ms: Math.round(performance.now() - t0),
    };
  }
}

self.onmessage = async (event: MessageEvent<InMsg>) => {
  const msg = event.data;
  try {
    if (msg.type === "configure") {
      forcedSource = msg.source;
      runtime = null;
    } else if (msg.type === "probe") {
      const rt = await ensureRuntime();
      const results = [await probeProvider("webgpu"), await probeProvider("wasm")];
      self.postMessage({
        type: "probe-result",
        id: msg.id,
        results,
        source: rt.source,
        files: rt.files,
        ortVersion: ORT_VERSION || null,
      });
    } else if (msg.type === "load") {
      const device = await resolveDevice(msg.device);
      if (msg.kind === "text") {
        const { tokenizer, model } = await loadText(msg.modelId, device);
        // 1-token warm generate so WebGPU shader compilation is paid here,
        // not on the user's first real compile.
        try {
          const warm: any = tokenizer.apply_chat_template([{ role: "user", content: "hi" }], {
            add_generation_prompt: true,
            return_dict: true,
          } as any);
          await model.generate({ ...warm, max_new_tokens: 1, do_sample: false });
        } catch {
          /* warm-up is best-effort */
        }
      } else await loadVision(msg.modelId, device);
      self.postMessage({ type: "loaded", kind: msg.kind, modelId: msg.modelId, device });
    } else if (msg.type === "cancel") {
      interrupter.interrupt();
    } else if (msg.type === "generate") {
      const device = await resolveDevice(msg.device);
      const text = msg.kind === "vision" ? await generateVision(msg) : await generateText(msg);
      self.postMessage({ type: "result", id: msg.id, text, device });
    } else if (msg.type === "unload") {
      for (const p of loaded.values()) {
        p.then((m: any) => m.model?.dispose?.()).catch(() => undefined);
      }
      loaded.clear();
      self.postMessage({ type: "unloaded" });
    }
  } catch (e) {
    self.postMessage({
      type: "error",
      id: (msg as GenerateMsg).id ?? null,
      message: explain(e),
    });
  }
};

/** Turn library internals into something a user can act on. */
function explain(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (
    /no available backend|ONNX Runtime files|initializeWebAssembly|dynamically imported/i.test(raw)
  ) {
    return `The in-browser AI runtime could not start (${raw.slice(0, 200)}). Open Settings → AI engine → "Test runtime" for details, or switch Compute to "wasm".`;
  }
  if (
    /tokenizer_class|Unable to load|Could not locate|Failed to fetch|NetworkError|404|load failed/i.test(
      raw,
    )
  ) {
    const why = /tokenizer_class|model_type/i.test(raw)
      ? "config/tokenizer files not found on this site or the Hugging Face Hub"
      : raw.slice(0, 120);
    return `Could not download the model files (${why}). Either vendor the weights into this site (bun run vendor-model) or make sure huggingface.co is reachable, then retry. The rule-based engine keeps working meanwhile.`;
  }
  if (/WebGPU|GPUAdapter|gpu/i.test(raw)) {
    return `WebGPU failed (${raw.slice(0, 80)}). Switch Compute to "wasm" in Settings and retry.`;
  }
  if (/memory|allocation|OOM/i.test(raw)) {
    return `The browser ran out of memory loading the model (${raw.slice(0, 80)}). Close other tabs or pick a smaller model in Settings.`;
  }
  return raw;
}

self.postMessage({ type: "ready" });
