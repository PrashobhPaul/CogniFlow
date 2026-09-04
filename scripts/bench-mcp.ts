/**
 * MCP streamable-HTTP load test. Start the server first:
 *   COGNIFLOW_MCP_TOKEN=testtoken bun run mcp/http-server.ts
 * then:
 *   NO_PROXY=localhost bun run scripts/bench-mcp.ts
 */

const URL_ = process.env["MCP_URL"] ?? "http://localhost:8788/mcp";
const TOKEN = process.env["COGNIFLOW_MCP_TOKEN"] ?? "testtoken";

const HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  authorization: `Bearer ${TOKEN}`,
};

const CALL = {
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "cogniflow_compile_architecture",
    arguments: {
      description:
        "web app -> api gateway -> orchestrator; orchestrator retrieves from pinecone; orchestrator calls claude; claude streams tokens to web app over sse; orchestrator publishes traces to kafka; a guardrail fronts claude",
    },
  },
};

async function call(id: number): Promise<number> {
  const t0 = performance.now();
  const res = await fetch(URL_, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ ...CALL, id }),
  });
  const body = (await res.json()) as { result?: unknown; error?: unknown };
  if (!res.ok || body.error) throw new Error(`call ${id} failed: ${res.status}`);
  return performance.now() - t0;
}

function stats(times: number[]) {
  const s = [...times].sort((a, b) => a - b);
  const pick = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
  return {
    n: s.length,
    p50: pick(50).toFixed(1),
    p95: pick(95).toFixed(1),
    p99: pick(99).toFixed(1),
    max: s[s.length - 1]!.toFixed(1),
  };
}

// warm-up
await Promise.all([call(0), call(0)]);

// sequential
const seq: number[] = [];
for (let i = 1; i <= 100; i++) seq.push(await call(i));
console.log("sequential x100 (ms):", stats(seq));

// concurrent batches
for (const conc of [10, 25, 50]) {
  const times: number[] = [];
  const t0 = performance.now();
  for (let batch = 0; batch < Math.ceil(300 / conc); batch++) {
    const results = await Promise.all(
      Array.from({ length: conc }, (_, i) => call(batch * conc + i + 1000)),
    );
    times.push(...results);
  }
  const wall = performance.now() - t0;
  console.log(
    `concurrency ${conc}, 300 calls (ms):`,
    stats(times),
    `throughput ${(300 / (wall / 1000)).toFixed(0)} req/s`,
  );
}
