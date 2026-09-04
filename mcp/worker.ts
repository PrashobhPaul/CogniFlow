import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createCogniflowServer, setSiteUrl } from "./tools";

/**
 * CogniFlow MCP server — Cloudflare Workers entry, the one-command way to get
 * a public HTTPS MCP endpoint for a claude.ai / Claude mobile custom
 * connector (free tier is plenty: the tools are pure CPU, no storage).
 *
 * Deploy (from mcp/, with a free Cloudflare account):
 *   bun install
 *   bunx wrangler deploy
 *   bunx wrangler secret put COGNIFLOW_MCP_KEY     # optional but recommended
 * then add the connector in claude.ai → Settings → Connectors:
 *   https://cogniflow-mcp.<your-subdomain>.workers.dev/mcp/<your key>
 *
 * Auth: claude.ai custom connectors can't send custom headers (OAuth or
 * nothing), so when COGNIFLOW_MCP_KEY is set the key can ride in the path
 * (`/mcp/<key>`, an unguessable capability URL) or, for API/SDK clients that
 * can set headers, as `Authorization: Bearer <key>`. Unset = open endpoint.
 */

interface Env {
  COGNIFLOW_MCP_KEY?: string;
  COGNIFLOW_SITE_URL?: string;
}

const rpcError = (status: number, message: string): Response =>
  Response.json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.COGNIFLOW_SITE_URL) setSiteUrl(env.COGNIFLOW_SITE_URL);
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/healthz")
      return Response.json({ ok: true, server: "cogniflow-mcp-server" });

    const match = /^\/mcp(?:\/(.+))?$/.exec(url.pathname);
    if (!match) return rpcError(404, "Not found. The MCP endpoint is POST /mcp.");

    const key = env.COGNIFLOW_MCP_KEY;
    if (key) {
      const pathKey = match[1];
      const bearer = request.headers.get("authorization");
      if (pathKey !== key && bearer !== `Bearer ${key}`)
        return rpcError(401, "Unauthorized: use /mcp/<key> or a bearer token.");
    }

    if (request.method !== "POST") return rpcError(405, "Method not allowed. Use POST.");

    const server = createCogniflowServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    // Cast: the SDK's Transport interface predates exactOptionalPropertyTypes.
    await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
    return transport.handleRequest(request);
  },
};
