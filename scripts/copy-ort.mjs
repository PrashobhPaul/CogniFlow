#!/usr/bin/env node
/**
 * Copies the onnxruntime-web WASM runtime next to the app so the in-browser
 * model runs entirely from this origin (no jsDelivr fallback at runtime).
 *
 * Transformers.js imports `onnxruntime-web/webgpu`; which loader/wasm pair
 * that bundle needs changes between ONNX Runtime releases (jsep → asyncify →
 * jspi …), so instead of guessing we read the bundle and copy exactly the
 * `ort-wasm-simd-threaded*.{mjs,wasm}` files it references.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// onnxruntime-web's "exports" hides package.json; resolve entries instead.
const ortDist = dirname(require.resolve("onnxruntime-web"));
const out = join(process.cwd(), "public", "ort");
mkdirSync(out, { recursive: true });

// The bundle Transformers.js uses in browsers (see @huggingface/transformers/src/backends/onnx.js).
const bundles = ["ort.webgpu.bundle.min.mjs", "ort.webgpu.min.mjs", "ort.bundle.min.mjs"].filter(
  (f) => {
    try {
      return statSync(join(ortDist, f)).isFile();
    } catch {
      return false;
    }
  },
);
const referenced = new Set();
for (const b of bundles.slice(0, 1)) {
  const src = readFileSync(join(ortDist, b), "utf8");
  for (const m of src.matchAll(/ort-wasm-simd-threaded[\w.-]*\.(?:mjs|wasm)/g))
    referenced.add(m[0]);
}
// Always keep the plain + asyncify pairs as a safety net for the WASM backend.
for (const f of readdirSync(ortDist)) {
  if (/^ort-wasm-simd-threaded(\.asyncify)?\.(mjs|wasm)$/.test(f)) referenced.add(f);
}

let copied = 0;
let bytes = 0;
for (const f of referenced) {
  const from = join(ortDist, f);
  try {
    copyFileSync(from, join(out, f));
    bytes += statSync(from).size;
    copied++;
  } catch {
    console.warn(`  (missing in package: ${f})`);
  }
}
if (!copied) throw new Error(`No ort-wasm files found in ${ortDist}`);
console.log(
  `Copied ${copied} onnxruntime-web files (${(bytes / 1e6).toFixed(1)} MB) to public/ort: ${[...referenced].join(", ")}`,
);
