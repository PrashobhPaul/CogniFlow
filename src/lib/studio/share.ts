import { airGraphSchema, type AirGraph } from "./air";

/**
 * Share links: the whole AIR graph, deflate-compressed and base64url-encoded
 * in the `d` search param, so a diagram opens anywhere with no backend (the
 * same idea as the mermaid.live and PlantUML encoders).
 */

const b64url = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromB64url = (text: string): Uint8Array => {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface SharedGraph {
  graph: AirGraph;
  title?: string | undefined;
}

export async function encodeShareGraph(graph: AirGraph, title?: string): Promise<string> {
  const payload = JSON.stringify({ t: title, g: graph });
  return b64url(await deflate(new TextEncoder().encode(payload)));
}

/** Longest URL we are willing to produce; browsers and chat apps degrade beyond this. */
export const SHARE_URL_LIMIT = 8000;

export async function decodeShareGraph(param: string): Promise<SharedGraph | null> {
  let raw: string;
  try {
    const bytes = fromB64url(param);
    // Uncompressed links (hand-written or from the MCP server's plain mode) start with '{'.
    raw =
      bytes[0] === 0x7b
        ? new TextDecoder().decode(bytes)
        : new TextDecoder().decode(await inflate(bytes));
  } catch {
    return null;
  }
  try {
    const obj = JSON.parse(raw) as { t?: string; g?: unknown };
    const parsed = airGraphSchema.safeParse(obj.g);
    if (!parsed.success) return null;
    return { graph: parsed.data, ...(obj.t ? { title: obj.t } : {}) };
  } catch {
    return null;
  }
}
