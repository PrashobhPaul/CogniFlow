import { AIR_VERSION, type AirEdge, type AirGraph, type AirNode } from "./air";
import { autoLayout } from "./layout";
import { categoryForType, iconForType } from "./classify";
import { GRAMMAR_PRESETS, type Grammar } from "./types";

/**
 * Reference patterns: validated, ready-to-animate graphs for the architectures
 * that come up again and again in GenAI delivery — RAG and advanced RAG,
 * GraphRAG / knowledge graphs, multi-agent pipelines with human gates, and
 * agentic SDLC / STLC tooling. Each one is a starting point: open it, rename,
 * add or remove components, export.
 */

const n = (
  id: string,
  x: number,
  y: number,
  label: string,
  subtitle: string,
  category: AirNode["category"],
  icon: string,
  component_type: string,
): AirNode => ({
  id,
  label,
  subtitle,
  category,
  icon,
  component_type,
  position: { x, y },
  group_id: null,
});

/** Compact node helper: type drives category + icon, position comes from auto-layout. */
const c = (id: string, type: string, label: string, subtitle: string): AirNode =>
  n(id, 0, 0, label, subtitle, categoryForType(type), iconForType(type), type);

const e = (
  id: string,
  source: string,
  target: string,
  semantic_type: AirEdge["semantic_type"],
  protocol: string,
  label: string,
  extra: Partial<AirEdge> = {},
): AirEdge => ({
  id,
  source_node_id: source,
  target_node_id: target,
  direction: "forward",
  semantic_type,
  protocol,
  execution_mode:
    semantic_type === "stream"
      ? "streaming"
      : semantic_type === "event"
        ? "asynchronous"
        : "synchronous",
  label,
  ...extra,
});

const motion = (edges: AirEdge[], grammars: Record<string, Grammar> = {}): AirGraph["motion"] =>
  edges.map((edge) => {
    const grammar =
      grammars[edge.id] ??
      (edge.semantic_type === "stream"
        ? "dense"
        : edge.semantic_type === "event"
          ? "pulse"
          : edge.semantic_type === "control"
            ? "pulse"
            : edge.semantic_type === "data" || edge.semantic_type === "retrieval"
              ? "stream"
              : "packet");
    return { edge_id: edge.id, grammar, enabled: true, ...GRAMMAR_PRESETS[grammar] };
  });

function graph(nodes: AirNode[], edges: AirEdge[], grammars?: Record<string, Grammar>): AirGraph {
  return { air_version: AIR_VERSION, nodes, edges, motion: motion(edges, grammars) };
}

/** Same as graph() but lets the deterministic layered layout place the nodes. */
function laid(nodes: AirNode[], edges: AirEdge[], grammars?: Record<string, Grammar>): AirGraph {
  return autoLayout(graph(nodes, edges, grammars));
}

export const BLANK_GRAPH: AirGraph = { air_version: AIR_VERSION, nodes: [], edges: [], motion: [] };

// ── 1. RAG pipeline with reranker ─────────────────────────────────────────────
const ragNodes = [
  n("client", 0, 180, "Web App", "Browser client", "application", "MonitorSmartphone", "web"),
  n("gateway", 300, 180, "API Gateway", "REST / auth", "integration", "Globe", "api"),
  n("guard", 300, 20, "Guardrail", "Policy filter", "security", "ShieldCheck", "guardrail"),
  n("orch", 600, 180, "Orchestrator", "Plan & route", "ai", "Workflow", "orchestrator"),
  n("embed", 600, 380, "Embedding Model", "Vectorize query", "ai", "Sparkles", "embedder"),
  n("vector", 900, 380, "Vector DB", "Similarity search", "data", "Boxes", "vectordb"),
  n("rerank", 900, 260, "Reranker", "Cross-encoder", "ai", "ArrowDownWideNarrow", "reranker"),
  n("llm", 1200, 180, "LLM", "Streaming tokens", "ai", "Brain", "llm"),
  n("tools", 1200, 20, "MCP Tools", "Tool protocol", "integration", "Plug", "mcp"),
  n("bus", 600, 560, "Event Stream", "Kafka topic", "integration", "Radio", "kafka"),
  n("obs", 900, 560, "Observability", "Traces & metrics", "devops", "Activity", "observability"),
];

const ragEdges = [
  e("e1", "client", "gateway", "request", "REST", "user prompt"),
  e("e2", "gateway", "guard", "control", "gRPC", "policy check"),
  e("e3", "gateway", "orch", "request", "gRPC", "validated request"),
  e("e4", "orch", "embed", "embedding", "gRPC", "embed query"),
  e("e5", "embed", "vector", "retrieval", "gRPC", "kNN search"),
  e("e6", "vector", "rerank", "data", "gRPC", "candidates"),
  e("e7", "rerank", "orch", "data", "gRPC", "top-k chunks"),
  e("e8", "orch", "llm", "stream", "WebSocket", "prompt + context"),
  e("e9", "llm", "tools", "message", "MCP", "tool call", { direction: "bidirectional" }),
  e("e10", "llm", "client", "response", "SSE", "token stream"),
  e("e11", "orch", "bus", "event", "Kafka", "trace event"),
  e("e12", "bus", "obs", "data", "Kafka", "spans", { execution_mode: "batch" }),
];

// ── 2. Agentic tool-calling system ────────────────────────────────────────────
const agentNodes = [
  n("user", 0, 160, "Chat Client", "Browser", "application", "MonitorSmartphone", "web"),
  n("api", 300, 160, "Agent API", "Auth + quota", "integration", "Globe", "api"),
  n("agent", 600, 160, "Agent Loop", "Plan / act / reflect", "ai", "Bot", "agent"),
  n("memory", 600, 350, "Memory Store", "Session state", "data", "Layers", "memory"),
  n("mcp", 900, 40, "MCP Server", "Tools", "integration", "Plug", "mcp"),
  n("llm", 900, 250, "Reasoning LLM", "Tool calling", "ai", "Brain", "llm"),
  n("queue", 300, 350, "Task Queue", "Async jobs", "integration", "ListOrdered", "queue"),
  n("worker", 300, 520, "Worker", "Long tasks", "application", "Cog", "worker"),
];

const agentEdges = [
  e("a1", "user", "api", "request", "REST", "goal"),
  e("a2", "api", "agent", "request", "gRPC", "task"),
  e("a3", "agent", "llm", "stream", "WebSocket", "reasoning"),
  e("a4", "agent", "mcp", "message", "MCP", "tool invoke", { direction: "bidirectional" }),
  e("a5", "agent", "memory", "data", "SQL", "state", { direction: "bidirectional" }),
  e("a6", "api", "queue", "event", "AMQP", "enqueue"),
  e("a7", "queue", "worker", "event", "AMQP", "dequeue"),
  e("a8", "agent", "user", "response", "SSE", "answer stream"),
];

// ── 3. Cloud microservices platform ───────────────────────────────────────────
const microNodes = [
  n("mobile", 0, 120, "Mobile App", "iOS / Android", "application", "Smartphone", "mobile"),
  n("edge", 300, 120, "WAF / CDN", "Edge protection", "security", "Shield", "waf"),
  n("gw", 600, 120, "API Gateway", "Routing", "integration", "Globe", "api"),
  n("auth", 600, -40, "IAM", "OAuth / OIDC", "security", "KeyRound", "iam"),
  n("orders", 900, 40, "Orders Service", "Container", "application", "Server", "service"),
  n("payments", 900, 220, "Payments Service", "Container", "application", "Server", "service"),
  n("db", 1200, 40, "PostgreSQL", "Primary store", "data", "Database", "sql"),
  n("cache", 1200, 220, "Cache", "Redis", "data", "Zap", "cache"),
  n("bus", 900, 400, "Event Bus", "Kafka", "integration", "Radio", "kafka"),
  n("obs", 1200, 400, "Monitoring", "Metrics & logs", "devops", "Activity", "observability"),
];

const microEdges = [
  e("m1", "mobile", "edge", "request", "REST", "https"),
  e("m2", "edge", "gw", "request", "REST", "filtered"),
  e("m3", "gw", "auth", "control", "REST", "token introspect"),
  e("m4", "gw", "orders", "request", "gRPC", "create order"),
  e("m5", "orders", "payments", "request", "gRPC", "charge"),
  e("m6", "orders", "db", "data", "SQL", "write"),
  e("m7", "payments", "cache", "data", "REST", "idempotency"),
  e("m8", "orders", "bus", "event", "Kafka", "order.created"),
  e("m9", "bus", "obs", "data", "Kafka", "telemetry", { execution_mode: "batch" }),
  e("m10", "payments", "orders", "error", "gRPC", "declined"),
];

// ── 4. Advanced RAG · grounded answering with guardrails & clarify-back ───────
const advNodes = [
  c("user", "user", "User", "Curator · admin roles"),
  c("web", "chat", "Chat Web App", "Citations · language"),
  c("sso", "iam", "SSO / RBAC", "OIDC · role claims"),
  c("api", "api", "RAG API", "Orchestrates answer flow"),
  c("retrieve", "search", "Retrieve", "Hybrid search · filters · rerank"),
  c("kb", "kb", "Knowledge Base", "Curated · versioned"),
  c("ground", "guardrail", "Grounding Check", "Score vs threshold"),
  c("router", "router", "Prompt Router", "Model routing · language"),
  c("llm", "llm", "Generator LLM", "Answer + citations"),
  c("clarify", "clarifier", "Clarify-back", "Ask, don't refuse"),
  c("docs", "enterprise", "QMS", "SOPs · process docs"),
  c("intake", "kafka", "Intake Events", "S3 · EventBridge · SQS"),
  c("pipeline", "workflow", "Ingestion Workflow", "Extract · metadata · version"),
  c("curate", "hitl", "Curator Queue", "Conflicts → review"),
  c("sync", "embedder", "KB Sync", "Embeddings · incremental"),
  c("otel", "observability", "OpenTelemetry", "Span per answer"),
  c("dash", "dashboard", "Usage & Quality", "Cost · clarify · refusal rates"),
  c("audit", "audit", "Audit Export", "S3 + Athena"),
];

const advEdges = [
  e("v1", "user", "web", "request", "REST", "question"),
  e("v2", "web", "sso", "control", "REST", "login · role claims"),
  e("v3", "web", "api", "request", "REST", "query · role · language"),
  e("v4", "api", "retrieve", "retrieval", "gRPC", "hybrid search"),
  e("v5", "retrieve", "kb", "retrieval", "gRPC", "filters · top-k"),
  e("v6", "retrieve", "ground", "data", "gRPC", "sources"),
  e("v7", "ground", "router", "control", "gRPC", "pass → generate"),
  e("v8", "router", "llm", "request", "REST", "prompt + context"),
  e("v9", "llm", "web", "stream", "SSE", "answer + citations"),
  e("v10", "ground", "clarify", "control", "gRPC", "below threshold"),
  e("v11", "clarify", "web", "response", "SSE", "one targeted question"),
  e("v12", "clarify", "retrieve", "retry", "gRPC", "refined query"),
  e("v13", "docs", "intake", "file", "S3", "export"),
  e("v14", "intake", "pipeline", "event", "SQS", "new document"),
  e("v15", "pipeline", "curate", "control", "REST", "conflicts"),
  e("v16", "pipeline", "sync", "data", "S3", "curated docs"),
  e("v17", "sync", "kb", "embedding", "gRPC", "vectors"),
  e("v18", "api", "otel", "event", "OTLP", "answer span"),
  e("v19", "otel", "dash", "data", "SQL", "metrics"),
  e("v20", "otel", "audit", "file", "S3", "immutable logs", { execution_mode: "batch" }),
];

// ── 5. GraphRAG · knowledge graph + vector retrieval ──────────────────────────
const graphNodes = [
  c("user", "chat", "Chat UI", "Question · answer"),
  c("api", "api", "Query API", "Auth · rate limit"),
  c("router", "router", "Query Router", "Local vs global · entity"),
  c("embed", "embedder", "Embedding Model", "Query & chunks"),
  c("vector", "vectordb", "Vector DB", "Chunk similarity"),
  c("graph", "graphdb", "Graph DB", "Entities · relations · communities"),
  c("assembler", "orchestrator", "Context Assembler", "Merge · dedupe · rank"),
  c("rerank", "reranker", "Reranker", "Cross-encoder"),
  c("llm", "llm", "Generator LLM", "Grounded answer"),
  c("judge", "evaluator", "Judge", "Faithfulness · coverage"),
  c("docs", "documents", "Documents", "PDF · wiki · tickets"),
  c("parse", "parser", "Parser / OCR", "Text · tables"),
  c("chunk", "chunker", "Chunker", "Semantic chunks"),
  c("extract", "extractor", "Entity Extractor", "LLM → triples"),
  c("obs", "observability", "Observability", "Traces · evals"),
];

const graphEdges = [
  e("g1", "user", "api", "request", "REST", "question"),
  e("g2", "api", "router", "request", "gRPC", "query"),
  e("g3", "router", "embed", "embedding", "gRPC", "embed query"),
  e("g4", "embed", "vector", "retrieval", "gRPC", "kNN chunks"),
  e("g5", "router", "graph", "retrieval", "Cypher", "entity traversal"),
  e("g6", "vector", "assembler", "data", "gRPC", "chunks"),
  e("g7", "graph", "assembler", "data", "gRPC", "subgraph · summaries"),
  e("g8", "assembler", "rerank", "data", "gRPC", "candidates"),
  e("g9", "rerank", "llm", "request", "REST", "context window"),
  e("g10", "llm", "judge", "data", "REST", "draft answer"),
  e("g11", "judge", "user", "stream", "SSE", "answer + citations"),
  e("g12", "judge", "router", "retry", "gRPC", "low faithfulness → retry"),
  e("g13", "docs", "parse", "file", "S3", "ingest"),
  e("g14", "parse", "chunk", "data", "gRPC", "text"),
  e("g15", "chunk", "embed", "data", "gRPC", "chunks"),
  e("g16", "chunk", "extract", "data", "gRPC", "chunks"),
  e("g17", "extract", "graph", "data", "Cypher", "entities · relations"),
  e("g18", "embed", "vector", "embedding", "gRPC", "chunk vectors", { execution_mode: "batch" }),
  e("g19", "llm", "obs", "event", "OTLP", "span · tokens"),
];

// ── 6. Multi-agent test-case pipeline · HITL + Xray ───────────────────────────
const stlcNodes = [
  c("jira", "tracker", "Jira Cloud", "Stories · acceptance criteria"),
  c("mcpjira", "mcp", "Atlassian MCP", "getJiraIssue · JQL"),
  c("intake", "agent", "Intake Agent", "Normalise · flag gaps"),
  c("builder", "agent", "Test-Step Builder", "Manual · Gherkin · automation"),
  c("kbase", "kb", "Knowledge Base", "Pages · flows · locators"),
  c("skills", "skills", "QA Skills", "Step standards · locator ladder"),
  c("askback", "clarifier", "Question-back Gate", "3–5 targeted questions"),
  c("approve", "hitl", "Approval Console", "Approve · reject · edit"),
  c("hooks", "hooks", "Guardrail Hooks", "Deny-first · sandbox writes"),
  c("writer", "agent", "Xray Writer", "Cloud GraphQL · DC REST"),
  c("xray", "testmgmt", "Xray", "Tests · steps · sets"),
  c("otel", "observability", "OpenTelemetry", "Tokens · cost per agent"),
  c("audit", "audit", "Audit Log", "One line per tool call"),
];

const stlcEdges = [
  e("t1", "jira", "mcpjira", "data", "REST", "story + ACs"),
  e("t2", "mcpjira", "intake", "message", "MCP", "getJiraIssue"),
  e("t3", "intake", "builder", "data", "JSON", "story.json"),
  e("t4", "kbase", "builder", "retrieval", "FS", "index-first grounding"),
  e("t5", "skills", "builder", "control", "FS", "encoded expertise"),
  e("t6", "builder", "askback", "control", "REST", "ambiguity"),
  e("t7", "askback", "builder", "response", "REST", "tester answers"),
  e("t8", "builder", "approve", "data", "JSON", "draft · 3 formats"),
  e("t9", "approve", "builder", "retry", "JSON", "rejection reason"),
  e("t10", "approve", "writer", "control", "REST", "approved payload"),
  e("t11", "hooks", "writer", "control", "Hook", "pre-tool deny-first"),
  e("t12", "writer", "xray", "data", "GraphQL", "write-back"),
  e("t13", "xray", "jira", "data", "REST", "linked to story"),
  e("t14", "builder", "otel", "event", "OTLP", "tokens · cost"),
  e("t15", "writer", "audit", "data", "JSON", "tool call log"),
];

// ── 7. Agentic SDLC · spec-driven construction agents ─────────────────────────
const sdlcNodes = [
  c("dev", "ide", "Developer @ IDE", "Spec authoring · approvals"),
  c("spec", "documents", "Spec Chain", "inception → handoff → review"),
  c("steer", "kb", "Steering Files", "Always · auto · manual"),
  c("fb", "agent", "Feature Builder", "Scope · stories · units"),
  c("devagent", "agent", "Developer Agent", "Code across stack"),
  c("te", "agent", "Test Engineer", "Parallel · self-correct"),
  c("cr", "agent", "Code Reviewer", "Wraps MR review"),
  c("docagent", "agent", "Documentation", "API · changelog"),
  c("gates", "hitl", "HITL Gates", "G1–G9 literal tokens"),
  c("hooks", "hooks", "Hook Layer", "preToolUse · postTool · pre-merge"),
  c("mcp", "mcp", "GitLab MCP", "Read-only · write deny"),
  c("gitlab", "repo", "GitLab", "MR · pipeline"),
  c("llm", "llm", "Bedrock LLM", "Sonnet · Opus routing"),
  c("valid", "evaluator", "ValidAIte", "8-dim score per turn"),
  c("otel", "observability", "OTel → CloudWatch", "Span per agent turn"),
  c("sec", "guardrail", "Security Scans", "Secrets · PII · allowlists"),
];

const sdlcEdges = [
  e("s1", "dev", "spec", "data", "Git", "inception.md"),
  e("s2", "spec", "fb", "data", "FS", "spec"),
  e("s3", "steer", "fb", "control", "FS", "steering"),
  e("s4", "fb", "gates", "control", "REST", "G2 approve"),
  e("s5", "gates", "devagent", "control", "REST", "handoff-1.md"),
  e("s6", "devagent", "te", "data", "FS", "handoff-2.md"),
  e("s7", "te", "devagent", "retry", "FS", "test-fail → self-correct"),
  e("s8", "te", "cr", "data", "FS", "test-findings.md"),
  e("s9", "cr", "docagent", "data", "FS", "review-report.md"),
  e("s10", "docagent", "gitlab", "data", "REST", "MR ready"),
  e("s11", "devagent", "llm", "stream", "REST", "code generation"),
  e("s12", "devagent", "hooks", "control", "Hook", "every tool call"),
  e("s13", "hooks", "sec", "control", "Hook", "scan on fs_write"),
  e("s14", "devagent", "mcp", "message", "MCP", "read repo"),
  e("s15", "mcp", "gitlab", "data", "REST", "read-only"),
  e("s16", "te", "valid", "data", "JSON", "turn record"),
  e("s17", "valid", "otel", "event", "OTLP", "8-dim score"),
  e("s18", "gates", "dev", "response", "IDE", "gate prompts"),
];

// ── 8. Agentic test automation · POM generation (multi-agent) ─────────────────
const pomNodes = [
  c("ado", "tracker", "Azure DevOps", "Iterations · work items"),
  c("adoagent", "agent", "ADO Agent", "Backlog sync"),
  c("planner", "planner", "Planner Agent", "Master plan · AgenticState"),
  c("wf", "orchestrator", "Workflow Agent", "Agent orchestrator"),
  c("ui", "browser", "UI Explorer Agent", "Playwright · DOM scan"),
  c("app", "web", "Application Under Test", "Browser"),
  c("analysis", "agent", "Analysis Agent", "Parser · embeddings"),
  c("llm", "llm", "Azure OpenAI", "Reasoning · codegen"),
  c("vector", "nosql", "MongoDB Vector Store", "Docs + vectors"),
  c("codegen", "agent", "CodeGen Agent", "POM classes & tests"),
  c("pom", "codegen", "POM Release", "TypeScript · Playwright"),
  c("framework", "workflow", "Agent Framework", "Microsoft Agent Framework"),
];

const pomEdges = [
  e("p1", "ado", "adoagent", "data", "REST", "work items"),
  e("p2", "adoagent", "planner", "request", "REST", "iteration scope"),
  e("p3", "planner", "wf", "message", "MCP", "invocation requests", { direction: "bidirectional" }),
  e("p4", "wf", "ui", "message", "MCP", "invoke UI scan"),
  e("p5", "ui", "app", "control", "CDP", "scan · screenshots", { direction: "bidirectional" }),
  e("p6", "ui", "analysis", "data", "JSON", "locators · DOM"),
  e("p7", "analysis", "llm", "request", "REST", "semantic analysis"),
  e("p8", "analysis", "vector", "embedding", "REST", "embeddings", { direction: "bidirectional" }),
  e("p9", "wf", "codegen", "message", "MCP", "invoke code analysis"),
  e("p10", "analysis", "codegen", "data", "JSON", "search results"),
  e("p11", "codegen", "pom", "file", "Git", "POM classes & tests"),
  e("p12", "codegen", "wf", "event", "REST", "update AgenticState"),
  e("p13", "framework", "wf", "control", "SDK", "runtime · state"),
];

// ── 9. AIDLC agent crew · AI development lifecycle run by agents ──────────────
const aidlcNodes = [
  c("jira", "tracker", "Jira", "Epics · AI use cases"),
  c("intake", "agent", "Intake Agent", "Use case · success metrics"),
  c("spec", "documents", "Requirements Spec", "Use cases · acceptance · risks"),
  c("planner", "planner", "Lifecycle Planner", "Stage plan · agent routing"),
  c("data", "agent", "Data Agent", "Sourcing · quality · PII check"),
  c("lake", "objectstore", "Data Lake", "Curated datasets · versions"),
  c("registry", "prompts", "Prompt & Model Registry", "Prompts · adapters · versions"),
  c("exp", "agent", "Experiment Agent", "Model select · fine-tune · RAG design"),
  c("llm", "llm", "Foundation LLM", "Candidate models"),
  c("evalagent", "evaluator", "Evaluation Agent", "Benchmarks · LLM-as-judge"),
  c("review", "hitl", "Human Review Gate", "Approve · reject · edit"),
  c("deploy", "agent", "Deployment Agent", "CI/CD · IaC · release"),
  c("cicd", "cicd", "CI/CD Pipeline", "Build · test · promote"),
  c("gateway", "guardrail", "AI Gateway", "Guardrails · rate limits"),
  c("otel", "observability", "Tracing", "Spans · prod evals"),
  c("monitor", "agent", "Monitoring Agent", "Drift · quality · cost"),
  c("alerts", "alerts", "Quality Alerts", "Drift · regressions"),
  c("audit", "audit", "Audit Log", "Every gate decision"),
];

const aidlcEdges = [
  e("d1", "jira", "intake", "data", "REST", "epics · use cases"),
  e("d2", "intake", "spec", "data", "JSON", "requirements spec"),
  e("d3", "spec", "planner", "data", "FS", "spec handoff"),
  e("d4", "planner", "data", "control", "REST", "stage: data"),
  e("d5", "data", "lake", "data", "S3", "curated datasets"),
  e("d6", "lake", "exp", "data", "S3", "train · eval sets"),
  e("d7", "planner", "exp", "control", "REST", "stage: experiment"),
  e("d8", "exp", "registry", "data", "REST", "prompt · adapter versions", {
    direction: "bidirectional",
  }),
  e("d9", "exp", "llm", "stream", "REST", "candidate runs"),
  e("d10", "exp", "evalagent", "data", "JSON", "candidate bundle"),
  e("d11", "evalagent", "llm", "request", "REST", "LLM-as-judge"),
  e("d12", "evalagent", "exp", "retry", "JSON", "below threshold"),
  e("d13", "evalagent", "review", "control", "REST", "scorecard"),
  e("d14", "review", "exp", "retry", "REST", "rejection reason"),
  e("d15", "review", "deploy", "control", "REST", "approved release"),
  e("d16", "deploy", "cicd", "control", "Git", "release PR · IaC"),
  e("d17", "cicd", "gateway", "control", "Helm", "promote to prod"),
  e("d18", "gateway", "otel", "event", "OTLP", "prod spans"),
  e("d19", "otel", "monitor", "data", "OTLP", "traces · quality signals"),
  e("d20", "monitor", "alerts", "event", "Webhook", "drift · regression"),
  e("d21", "alerts", "planner", "event", "Webhook", "re-plan stage"),
  e("d22", "monitor", "intake", "event", "REST", "feedback · new use cases"),
  e("d23", "review", "audit", "data", "JSON", "gate decisions"),
  e("d24", "deploy", "audit", "data", "JSON", "release record"),
];

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  family: "rag" | "agentic" | "platform";
  /** Lower-case intent words that let a free-text prompt pick this pattern (see matchPattern). */
  keywords: string[];
  graph: AirGraph;
}

export const PATTERNS: PatternTemplate[] = [
  {
    id: "rag",
    name: "RAG pipeline with reranker",
    description:
      "Retrieval-augmented generation: guardrails, embeddings, vector search, reranking, streaming response.",
    family: "rag",
    keywords: ["rag", "retrieval", "retrieval augmented", "chatbot", "vector"],
    graph: graph(ragNodes, ragEdges),
  },
  {
    id: "advanced-rag",
    name: "Advanced RAG · grounded answering",
    description:
      "SSO-scoped queries, hybrid retrieval, grounding check, model routing, clarify-back instead of refusals, event-driven content pipeline with curator review, OpenTelemetry and audit export.",
    family: "rag",
    keywords: ["advanced rag", "guardrail", "reranker", "hybrid search", "clarify"],
    graph: laid(advNodes, advEdges),
  },
  {
    id: "graphrag",
    name: "GraphRAG · knowledge graph + vectors",
    description:
      "Ingestion into both a vector index and an entity graph, a query router that blends chunk similarity with graph traversal, reranking, a faithfulness judge and retry loop.",
    family: "rag",
    keywords: ["graphrag", "graph rag", "knowledge graph", "kg", "neo4j", "ontology"],
    graph: laid(graphNodes, graphEdges),
  },
  {
    id: "agent",
    name: "Agentic tool-calling system",
    description: "Agent loop with MCP tools, memory, async workers and a streamed answer.",
    family: "agentic",
    keywords: ["agent", "agentic", "assistant", "mcp", "tools"],
    graph: graph(agentNodes, agentEdges),
  },
  {
    id: "stlc-agents",
    name: "Multi-agent test-case pipeline · HITL + Xray",
    description:
      "Jira story → intake agent → grounded test-step builder with question-back gate → human approval with rejection loop → guardrailed Xray write-back, all under telemetry and audit.",
    family: "agentic",
    keywords: ["stlc", "test case", "testing lifecycle", "xray", "qa agents"],
    graph: laid(stlcNodes, stlcEdges),
  },
  {
    id: "sdlc-agents",
    name: "Agentic SDLC · spec-driven construction agents",
    description:
      "Feature builder, developer, test engineer, reviewer and documentation agents chained through spec files, HITL gates, lifecycle hooks, security scans and a quality scorer.",
    family: "agentic",
    keywords: ["sdlc", "software development lifecycle", "kiro", "construction", "code generation"],
    graph: laid(sdlcNodes, sdlcEdges),
  },
  {
    id: "pom-agents",
    name: "Agentic test automation · POM generation",
    description:
      "Planner and workflow agents drive UI exploration with Playwright, semantic analysis with embeddings and a vector store, and code generation of page objects and tests.",
    family: "agentic",
    keywords: ["pom", "page object", "selenium", "playwright", "automation framework"],
    graph: laid(pomNodes, pomEdges),
  },
  {
    id: "aidlc-agents",
    name: "AIDLC agent crew · AI development lifecycle",
    description:
      "Intake, data, experiment, evaluation, deployment and monitoring agents run the AI development lifecycle end to end: requirements spec, PII-checked datasets, prompt/model registry, LLM-as-judge evals, a human review gate, guardrailed release and drift alerts feeding back into planning.",
    family: "agentic",
    keywords: [
      "aidlc",
      "ai development lifecycle",
      "ai lifecycle",
      "mlops",
      "llmops",
      "model lifecycle",
    ],
    graph: laid(aidlcNodes, aidlcEdges),
  },
  {
    id: "micro",
    name: "Cloud microservices platform",
    description: "Edge protection, gateway, services, datastores, event bus and observability.",
    family: "platform",
    keywords: ["microservices", "commerce", "e-commerce", "kafka", "waf"],
    graph: graph(microNodes, microEdges),
  },
];

export const DEFAULT_GRAPH = PATTERNS[0]!.graph;

/** Broad family words that should not outweigh a specific pattern name. */
const GENERIC_KEYWORDS = new Set(["agent", "agentic", "assistant", "tools", "chatbot", "vector"]);

/** Lower-case, strip punctuation to spaces so "graph-rag" and "CI/CD" match plain-word keywords. */
const normalizeIntent = (text: string): string =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

/** Longer / multi-word keywords are more specific, so they count for more. */
function keywordWeight(keyword: string): number {
  if (GENERIC_KEYWORDS.has(keyword)) return 1;
  const words = keyword.split(" ").length;
  return 2 + (words - 1) + (keyword.length >= 8 ? 1 : 0);
}

/**
 * Pick the reference pattern a free-text prompt is asking for ("agents that do a full
 * aidlc lifecycle", "graphrag over a knowledge graph"). Whole-word matching only, so
 * "rag" never fires on "storage" or "drag"; a trailing plural "s" is tolerated.
 */
export function matchPattern(text: string): { pattern: PatternTemplate; score: number } | null {
  const haystack = normalizeIntent(text);
  if (!haystack.trim()) return null;
  let best: { pattern: PatternTemplate; score: number } | null = null;
  for (const pattern of PATTERNS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      const needle = normalizeIntent(keyword).trim();
      if (!needle) continue;
      const re = new RegExp(` ${needle}(?:s|es)? `);
      if (re.test(haystack)) score += keywordWeight(needle);
    }
    if (score > 0 && (!best || score > best.score)) best = { pattern, score };
  }
  return best;
}
