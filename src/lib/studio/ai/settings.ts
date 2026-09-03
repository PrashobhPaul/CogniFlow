import { useSyncExternalStore } from "react";
import type { AiStatus } from "../entitlements";

/**
 * AI engine settings, stored in this browser only. Two engines:
 *   • local    — open-weight models run in-browser with Transformers.js. The
 *                weights are served from this site (public/models, vendored
 *                by scripts/vendor-model.mjs) with the Hugging Face Hub as a
 *                fallback. Nothing leaves the browser.
 *   • endpoint — any OpenAI-compatible chat endpoint the user controls
 *                (Ollama, vLLM, LM Studio, Hugging Face router, Groq …).
 *                The key is kept in localStorage and sent only to that host.
 */

export type AiEngine = "local" | "endpoint";
export type AiDevice = "auto" | "webgpu" | "wasm";

export interface AiSettings {
  engine: AiEngine;
  device: AiDevice;
  textModel: string;
  visionModel: string;
  endpoint: {
    baseUrl: string;
    apiKey: string;
    textModel: string;
    visionModel: string;
    jsonMode: boolean;
  };
}

/** Must match scripts/vendor-model.mjs so the vendored weights are what the loader asks for. */
export const DEFAULT_TEXT_MODEL = "HuggingFaceTB/SmolLM2-360M-Instruct";
export const DEFAULT_VISION_MODEL = "HuggingFaceTB/SmolVLM-500M-Instruct";

export interface ModelPreset {
  id: string;
  label: string;
  size: string;
  note: string;
  /** Served from this site when vendored; everything else streams from the Hugging Face Hub. */
  vendored?: boolean;
}

export const TEXT_MODEL_PRESETS: ModelPreset[] = [
  {
    id: DEFAULT_TEXT_MODEL,
    label: "SmolLM2-360M",
    size: "~270 MB",
    note: "Ships with the site · fastest",
    vendored: true,
  },
  {
    id: "onnx-community/Qwen2.5-0.5B-Instruct",
    label: "Qwen2.5-0.5B",
    size: "~480 MB",
    note: "Better JSON adherence · Hugging Face Hub",
  },
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    label: "Qwen3-0.6B",
    size: "~570 MB",
    note: "Strongest small text model · Hugging Face Hub",
  },
];

export const VISION_MODEL_PRESETS: ModelPreset[] = [
  {
    id: DEFAULT_VISION_MODEL,
    label: "SmolVLM-500M",
    size: "~360 MB",
    note: "Ships with the site · reads dense diagrams best",
    vendored: true,
  },
  {
    id: "HuggingFaceTB/SmolVLM-256M-Instruct",
    label: "SmolVLM-256M",
    size: "~190 MB",
    note: "Smallest · for low-memory devices · Hugging Face Hub",
  },
];

export interface EndpointPreset {
  id: string;
  label: string;
  baseUrl: string;
  textModel: string;
  visionModel: string;
  jsonMode: boolean;
  note: string;
}

/** Open-weight models on endpoints you control or pay for directly; strongest option for dense diagrams. */
export const ENDPOINT_PRESETS: EndpointPreset[] = [
  {
    id: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    textModel: "qwen2.5:7b-instruct",
    visionModel: "qwen2.5vl:7b",
    jsonMode: true,
    note: "Start with OLLAMA_ORIGINS=* so the browser may call it",
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    baseUrl: "http://localhost:1234/v1",
    textModel: "qwen2.5-7b-instruct",
    visionModel: "qwen2.5-vl-7b-instruct",
    jsonMode: false,
    note: "Enable CORS in the LM Studio server settings",
  },
  {
    id: "hf-router",
    label: "Hugging Face router",
    baseUrl: "https://router.huggingface.co/v1",
    textModel: "Qwen/Qwen2.5-72B-Instruct",
    visionModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    jsonMode: false,
    note: "Needs your HF token · best quality for complex diagrams",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    textModel: "llama-3.3-70b-versatile",
    visionModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    jsonMode: true,
    note: "Needs a Groq API key",
  },
];

export const DEFAULT_AI_SETTINGS: AiSettings = {
  engine: "local",
  device: "auto",
  textModel: DEFAULT_TEXT_MODEL,
  visionModel: DEFAULT_VISION_MODEL,
  endpoint: {
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    textModel: "qwen2.5:7b-instruct",
    visionModel: "qwen2.5vl:7b",
    jsonMode: false,
  },
};

// Historical key kept stable across the CogniFlow rename so saved settings survive.
const KEY = "archanimate.ai.v1";
const listeners = new Set<() => void>();
let cached: AiSettings | null = null;

function read(): AiSettings {
  if (cached) return cached;
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<AiSettings>;
    cached = {
      ...DEFAULT_AI_SETTINGS,
      ...raw,
      endpoint: { ...DEFAULT_AI_SETTINGS.endpoint, ...(raw.endpoint ?? {}) },
    };
  } catch {
    cached = DEFAULT_AI_SETTINGS;
  }
  return cached;
}

export function getAiSettings(): AiSettings {
  return read();
}

export function updateAiSettings(patch: Partial<AiSettings>) {
  const next: AiSettings = {
    ...read(),
    ...patch,
    endpoint: { ...read().endpoint, ...(patch.endpoint ?? {}) },
  };
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode etc. */
  }
  for (const l of listeners) l();
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT_AI_SETTINGS,
  );
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "custom endpoint";
  }
}

export function aiStatusFor(s: AiSettings): AiStatus {
  if (s.engine === "endpoint") {
    const ok = !!s.endpoint.baseUrl.trim() && !!s.endpoint.textModel.trim();
    return {
      configured: ok,
      provider: ok ? hostLabel(s.endpoint.baseUrl) : null,
      textModel: ok ? s.endpoint.textModel : null,
      visionModel: ok && s.endpoint.visionModel.trim() ? s.endpoint.visionModel : null,
      openSource: true,
    };
  }
  return {
    configured: true,
    provider: "in-browser · Transformers.js",
    textModel: s.textModel,
    visionModel: s.visionModel || null,
    openSource: true,
  };
}
