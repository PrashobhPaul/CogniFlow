import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCogniflowServer } from "./tools";

/**
 * CogniFlow MCP server — stdio transport, for Claude Code / Claude Desktop.
 *
 * Run with bun (the repo uses extensionless TS imports bun resolves natively):
 *   bun run mcp/server.ts
 * Claude Desktop / Claude Code config:
 *   { "mcpServers": { "cogniflow": { "command": "bun", "args": ["run", "<repo>/mcp/server.ts"] } } }
 *
 * For the remote streamable-HTTP transport (claude.ai custom connectors),
 * see mcp/http-server.ts.
 */

const server = createCogniflowServer();
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("cogniflow-mcp-server ready (stdio)");
