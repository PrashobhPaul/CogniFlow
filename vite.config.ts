import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

/**
 * Static SPA build. `BASE_PATH` (e.g. "/CogniFlow/") is set by the GitHub
 * Pages workflow; local dev and root-domain hosting use "/".
 */
export default defineConfig({
  base: process.env["BASE_PATH"] ?? "/",
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: { host: "127.0.0.1", port: 8080 },
  worker: { format: "es" },
  optimizeDeps: {
    // onnxruntime-web ships its own WASM loaders; pre-bundling breaks their asset resolution.
    exclude: ["@huggingface/transformers", "onnxruntime-web"],
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("@xyflow")) return "xyflow";
          if (id.includes("pptxgenjs")) return "pptx";
          return undefined;
        },
      },
    },
  },
});
