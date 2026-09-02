#!/usr/bin/env node
/**
 * Vendors open-weight models into public/models so GitHub Pages serves them
 * from the same origin as the app — no third-party CDN at runtime.
 *
 * Files larger than CHUNK_BYTES are split into `.partNNN` pieces (GitHub
 * refuses single files over 100 MB and Pages has a 1 GB site limit), and a
 * manifest.json per model tells the in-browser loader how to reassemble them.
 *
 * Usage:
 *   bun run vendor-model                 # all models in MODELS
 *   bun run vendor-model -- --only text  # one role
 *   HF_TOKEN=hf_xxx bun run vendor-model # optional (public models need none)
 *
 * Commit public/models if you want the weights to live in git; otherwise the
 * GitHub Actions deploy runs this script and ships them with the site.
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export const MODELS = [
  {
    role: "text",
    id: "HuggingFaceTB/SmolLM2-360M-Instruct",
    license: "Apache-2.0",
    // Transformers.js dtype → file name suffix.
    files: ["onnx/model_q4f16.onnx"],
  },
  {
    role: "vision",
    id: "HuggingFaceTB/SmolVLM-500M-Instruct",
    license: "Apache-2.0",
    files: [
      "onnx/embed_tokens_fp16.onnx",
      "onnx/vision_encoder_q4f16.onnx",
      "onnx/decoder_model_merged_q4f16.onnx",
    ],
  },
];

// Small config / tokenizer files every model needs (fetched when present).
const COMMON = [
  "config.json",
  "generation_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "special_tokens_map.json",
  "added_tokens.json",
  "vocab.json",
  "merges.txt",
  "preprocessor_config.json",
  "processor_config.json",
  "chat_template.json",
];

const CHUNK_BYTES = 45 * 1024 * 1024;
const OUT_ROOT = join(process.cwd(), "public", "models");
const HF = process.env.HF_ENDPOINT?.replace(/\/+$/, "") || "https://huggingface.co";
const headers = process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {};

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

async function listRepo(id) {
  const res = await fetch(`${HF}/api/models/${id}/tree/main?recursive=true`, { headers });
  if (!res.ok) throw new Error(`Cannot list ${id}: HTTP ${res.status}`);
  const entries = await res.json();
  return new Map(
    entries.filter((e) => e.type === "file").map((e) => [e.path, e.size ?? e.lfs?.size ?? 0]),
  );
}

async function download(id, file, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(`${HF}/${id}/resolve/main/${file}`, { headers, redirect: "follow" });
  if (!res.ok || !res.body)
    throw new Error(`Download failed for ${id}/${file}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function chunk(dest) {
  const size = statSync(dest).size;
  if (size <= CHUNK_BYTES) return null;
  const buf = readFileSync(dest);
  const parts = [];
  for (let i = 0, n = 0; i < size; i += CHUNK_BYTES, n++) {
    const part = `${dest}.part${String(n).padStart(3, "0")}`;
    writeFileSync(part, buf.subarray(i, Math.min(size, i + CHUNK_BYTES)));
    parts.push(part);
  }
  rmSync(dest);
  return parts;
}

async function vendor(model) {
  const outDir = join(OUT_ROOT, model.id);
  const manifestPath = join(outDir, "manifest.json");
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : { id: model.id, files: {} };
  const tree = await listRepo(model.id);
  const wanted = [...COMMON.filter((f) => tree.has(f)), ...model.files];
  for (const file of wanted) {
    if (!tree.has(file))
      throw new Error(
        `${model.id} has no ${file} — pick another dtype in scripts/vendor-model.mjs`,
      );
    const expected = tree.get(file);
    const existing = manifest.files[file];
    if (
      existing &&
      existing.size === expected &&
      existing.chunks.every((c) => existsSync(join(outDir, c)))
    ) {
      console.log(`  = ${file} (cached)`);
      continue;
    }
    process.stdout.write(`  ↓ ${file} (${(expected / 1e6).toFixed(1)} MB) `);
    const dest = join(outDir, file);
    await download(model.id, file, dest);
    const parts = chunk(dest);
    manifest.files[file] = {
      size: expected,
      chunks: parts ? parts.map((p) => p.slice(outDir.length + 1)) : [file],
    };
    console.log(parts ? `→ ${parts.length} chunks` : "→ single file");
  }
  manifest.license = model.license;
  manifest.role = model.role;
  manifest.vendored_at = new Date().toISOString();
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

for (const model of MODELS) {
  if (only && model.role !== only) continue;
  console.log(`\n${model.role}: ${model.id}`);
  await vendor(model);
}
writeFileSync(
  join(OUT_ROOT, "index.json"),
  JSON.stringify(
    {
      models: MODELS.map((m) => ({ role: m.role, id: m.id, license: m.license })),
      generated_at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  "\nDone. Weights live under public/models (commit them or let CI vendor them at deploy time).",
);
