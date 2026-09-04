import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createCogniflowServer } from "./tools";

/**
 * CogniFlow MCP server — remote streamable-HTTP transport.
 *
 * This is what a claude.ai / Claude Desktop **custom connector** talks to
 * (Settings → Connectors → Add custom connector needs a public HTTPS URL).
 * Host it anywhere that runs bun and terminates TLS (a small VM behind
 * Caddy/nginx, Render, Fly.io, Railway…), then add:
 *   https://<your-host>/mcp
 *
 * Run:
 *   bun run mcp/http-server.ts
 * Env:
 *   PORT                 listen port (default 8788)
 *   COGNIFLOW_MCP_TOKEN  optional bearer token; when set, requests must send
 *                        Authorization: Bearer <token>
 *   COGNIFLOW_SITE_URL   overrides the share-link origin (see tools.ts)
 *
 * Stateless mode: every POST gets a fresh McpServer + transport, so requests
 * are independent and the process needs no session affinity — safe to run
 * behind a load balancer or as multiple replicas. All tools are pure and
 * deterministic, so there is no per-session state to lose.
 */

const PORT = Number(process.env["PORT"] ?? 8788);
const TOKEN = process.env["COGNIFLOW_MCP_TOKEN"];

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 4 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function deny(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message },
      id: null,
    }),
  );
}

const httpServer = createServer((req, res) => {
  void handle(req, res);
});

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, server: "cogniflow-mcp-server" }));
    return;
  }

  const match = /^\/mcp(?:\/(.+))?$/.exec(url.pathname);
  if (!match) {
    deny(res, 404, "Not found. The MCP endpoint is POST /mcp.");
    return;
  }

  if (TOKEN) {
    // claude.ai custom connectors can't send custom headers, so the token may
    // ride in the path (/mcp/<token>) as well as in an Authorization header.
    const auth = req.headers.authorization ?? "";
    if (match[1] !== TOKEN && auth !== `Bearer ${TOKEN}`) {
      deny(res, 401, "Unauthorized: use /mcp/<token> or a bearer token.");
      return;
    }
  }

  if (req.method !== "POST") {
    // Stateless mode: no standalone SSE stream, no sessions to delete.
    res.writeHead(405, { "content-type": "application/json", allow: "POST" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed. Use POST." },
        id: null,
      }),
    );
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch (err) {
    deny(res, 400, err instanceof Error ? err.message : "Bad request");
    return;
  }

  // Fresh server + transport per request keeps requests fully independent.
  const server = createCogniflowServer();
  // No sessionIdGenerator → stateless mode; JSON responses keep curl/debug easy.
  const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    // Cast: the SDK's Transport interface predates exactOptionalPropertyTypes.
    await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error("MCP request failed:", err);
    if (!res.headersSent) deny(res, 500, "Internal server error");
  }
}

httpServer.listen(PORT, () => {
  console.error(
    `cogniflow-mcp-server ready (streamable HTTP) on http://localhost:${PORT}/mcp` +
      (TOKEN ? " [bearer auth enabled]" : " [no auth — set COGNIFLOW_MCP_TOKEN in production]"),
  );
});
