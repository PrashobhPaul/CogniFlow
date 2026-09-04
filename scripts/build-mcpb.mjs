import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Package the MCP server as a Claude Desktop Extension (.mcpb): a one-file,
 * double-click install — Claude Desktop runs it on its own bundled Node, so
 * users need no bun, no config editing, no hosting.
 *   bun run scripts/build-mcpb.mjs   → dist-mcpb/cogniflow.mcpb
 */

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "dist-mcpb");
const stage = resolve(out, "stage");

rmSync(out, { recursive: true, force: true });
mkdirSync(resolve(stage, "server"), { recursive: true });

// Bundle the stdio server (and every dependency) into one Node-runnable file.
execSync(`bun build mcp/server.ts --target=node --outfile=${resolve(stage, "server/index.js")}`, {
  cwd: root,
  stdio: "inherit",
});

cpSync(resolve(root, "public/brand/icon-512.png"), resolve(stage, "icon.png"));

const manifest = {
  manifest_version: "0.2",
  name: "cogniflow",
  display_name: "CogniFlow",
  version: "1.0.0",
  description:
    "Turn plain-language architecture descriptions into animated, editable diagrams with share links.",
  long_description:
    "CogniFlow gives Claude a token-cheap way to draw software architecture: describe a system in a sentence (or paste Mermaid) and get a validated, animated diagram plus a share link that opens in the CogniFlow studio. Includes reference patterns (RAG, GraphRAG, agent fleets) and exports to Mermaid, draw.io and SVG.",
  author: { name: "Prashobh Paul" },
  homepage: "https://cogniflow.prashobhpaul.com",
  repository: { type: "git", url: "https://github.com/PrashobhPaul/CogniFlow" },
  icon: "icon.png",
  server: {
    type: "node",
    entry_point: "server/index.js",
    mcp_config: { command: "node", args: ["${__dirname}/server/index.js"] },
  },
  tools: [
    { name: "cogniflow_compile_architecture" },
    { name: "cogniflow_render_graph" },
    { name: "cogniflow_list_patterns" },
    { name: "cogniflow_get_pattern" },
    { name: "cogniflow_list_components" },
  ],
  keywords: ["architecture", "diagram", "mermaid", "drawio", "visualization"],
  license: "MIT",
  compatibility: { platforms: ["darwin", "win32", "linux"], runtimes: { node: ">=18.0.0" } },
};
writeFileSync(resolve(stage, "manifest.json"), JSON.stringify(manifest, null, 2));

execSync(`cd ${stage} && zip -qr ../cogniflow.mcpb .`, { stdio: "inherit" });
execSync(`ls -la ${out}/cogniflow.mcpb`, { stdio: "inherit" });
console.log("Done: dist-mcpb/cogniflow.mcpb — double-click to install in Claude Desktop.");
