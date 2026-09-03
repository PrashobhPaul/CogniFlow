import type { NodeCategory } from "./types";

export interface PaletteItem {
  type: string;
  label: string;
  subtitle: string;
  category: NodeCategory;
  icon: string;
}

/**
 * Component library. Covers the building blocks of agentic AI, RAG / advanced
 * RAG, GraphRAG and knowledge-graph systems, plus the SDLC / STLC tooling
 * those systems plug into (work trackers, test management, repos, IDE agents)
 * and the platform layer around them. `type` is the stable id the classifier,
 * compiler and model prompts all agree on.
 */
const p = (
  type: string,
  label: string,
  subtitle: string,
  category: NodeCategory,
  icon: string,
): PaletteItem => ({ type, label, subtitle, category, icon });

/**
 * Named products, protocols and runtime controls. `brand:<slug>` icons are
 * drawn as brand medallions (see render/brands.ts); the rest use lucide glyphs
 * on the 3D base of their tier.
 */
const EXTENDED: PaletteItem[] = [
  // Foundation models & providers
  p("slm", "Small Language Model", "Phi · SmolLM · Qwen", "ai", "Cpu"),
  p("openai", "OpenAI", "GPT models", "ai", "brand:openai"),
  p("claude", "Claude", "Anthropic models", "ai", "brand:claude"),
  p("gemini", "Gemini", "Google models", "ai", "brand:gemini"),
  p("vertex", "Vertex AI", "Google Cloud models", "ai", "brand:vertex"),
  p("llama", "Llama", "Meta open weights", "ai", "brand:llama"),
  p("deepseek", "DeepSeek", "Open weights", "ai", "brand:deepseek"),
  p("mistral", "Mistral", "Open weights", "ai", "brand:mistral"),
  p("ollama", "Ollama", "Local model server", "ai", "brand:ollama"),
  p("huggingface", "Hugging Face", "Hub · router", "ai", "brand:huggingface"),
  p("bedrock", "Amazon Bedrock", "Managed models", "ai", "brand:bedrock"),
  p("azureopenai", "Azure OpenAI", "Managed models", "ai", "brand:azureopenai"),
  p("groq", "Groq", "LPU inference", "ai", "brand:groq"),
  p("cohere", "Cohere", "Command · Embed · Rerank", "ai", "brand:cohere"),
  // Frameworks & orchestration
  p("langgraph", "LangGraph", "Stateful agent graphs", "ai", "brand:langgraph"),
  p("langchain", "LangChain", "Chains & tools", "ai", "brand:langchain"),
  p("llamaindex", "LlamaIndex", "Indexing & retrieval", "ai", "brand:llamaindex"),
  p("autogen", "AutoGen", "Multi-agent chat", "ai", "brand:autogen"),
  p("crewai", "CrewAI", "Role-based crews", "ai", "brand:crewai"),
  p("semantickernel", "Semantic Kernel", "Microsoft SDK", "ai", "brand:semantickernel"),
  p("agentframework", "MS Agent Framework", ".NET · Python", "ai", "brand:agentframework"),
  p("kiro", "Kiro", "Spec-driven IDE agent", "ai", "brand:kiro"),
  p("copilot", "GitHub Copilot", "IDE assistant", "ai", "brand:copilot"),
  p("statemachine", "State Machine", "Explicit states", "ai", "GitFork"),
  p("dag", "DAG / Workflow Node", "Ordered steps", "ai", "Network"),
  p("parallel", "Parallel Executor", "Fan-out · fan-in", "ai", "Split"),
  // Vector search, caching & data
  p("pinecone", "Pinecone", "Managed vectors", "data", "brand:pinecone"),
  p("chroma", "Chroma", "Open-source vectors", "data", "brand:chroma"),
  p("faiss", "FAISS", "In-process ANN", "data", "brand:faiss"),
  p("qdrant", "Qdrant", "Vector search", "data", "brand:qdrant"),
  p("milvus", "Milvus", "Vector database", "data", "brand:milvus"),
  p("weaviate", "Weaviate", "Vector + hybrid", "data", "brand:weaviate"),
  p("redis", "Redis", "Cache · vectors", "data", "brand:redis"),
  p("semanticcache", "Semantic Cache", "Embedding-keyed hits", "data", "Zap"),
  p("postgres", "PostgreSQL", "pgvector", "data", "brand:postgres"),
  p("neo4j", "Neo4j", "Graph database", "data", "brand:neo4j"),
  p("s3", "Amazon S3", "Object store", "data", "brand:s3"),
  // Data inputs
  p("audio", "Audio Input", "Voice · calls · podcasts", "data", "Mic"),
  p("video", "Video / Media", "Recordings · captures", "data", "Film"),
  // Gateways, connectivity & protocols
  p("a2a", "A2A Protocol", "Agent-to-agent", "integration", "brand:a2a"),
  p("grpc", "gRPC", "Binary RPC", "integration", "brand:grpc"),
  p("websocket", "WebSocket", "Bidirectional", "integration", "brand:websocket"),
  p("llmgateway", "LLM Gateway", "Keys · routing · cost", "integration", "DoorOpen"),
  p("aigateway", "AI Gateway", "Policies · guardrails", "integration", "Aperture"),
  p("pubsub", "Pub/Sub · Event Bus", "Fan-out events", "integration", "RadioTower"),
  p("rabbitmq", "RabbitMQ", "AMQP broker", "integration", "brand:rabbitmq"),
  p("sqs", "Amazon SQS", "Managed queue", "integration", "brand:sqs"),
  p("gcppubsub", "Google Pub/Sub", "Managed fan-out", "integration", "brand:gcppubsub"),
  p("loadbalancer", "Load Balancer", "Traffic spread", "integration", "ArrowLeftRight"),
  // Agent mechanics & runtime controls
  p("steering", "Steering File", "System directives", "ai", "ScrollText"),
  p("sandbox", "Code Sandbox", "Isolated interpreter", "application", "FlaskConical"),
  p("cli", "CLI Terminal", "Shell access", "application", "Terminal"),
  // Safety, observability & routing
  p("tracing", "Tracing & Telemetry", "OTel · LangSmith · Arize", "devops", "Radar"),
  p("langsmith", "LangSmith", "Traces · evals", "devops", "brand:langsmith"),
  p("arize", "Arize Phoenix", "LLM observability", "devops", "brand:arize"),
  p("langfuse", "Langfuse", "Traces · evals · costs", "devops", "brand:langfuse"),
  p("cloudwatch", "Amazon CloudWatch", "Metrics · alarms", "devops", "brand:cloudwatch"),
  p("datadog", "Datadog", "APM · LLM observability", "devops", "brand:datadog"),
  p("ratelimiter", "Rate Limiter", "Quotas · budgets", "security", "Gauge"),
  // Interfaces & endpoints
  p("extension", "Browser Extension", "In-page assistant", "application", "AppWindow"),
  p("sdk", "Embedded SDK", "Client library", "application", "PackageOpen"),
  // Tooling & platforms
  p("jira", "Jira", "Work tracking", "integration", "brand:jira"),
  p("xray", "Xray", "Test management", "integration", "brand:xray"),
  p("github", "GitHub", "Repos · Actions", "devops", "brand:github"),
  p("confluence", "Confluence", "Docs & specs", "integration", "brand:confluence"),
  p("selenium", "Selenium", "Browser automation", "devops", "brand:selenium"),
  p("playwright", "Playwright", "Browser automation", "devops", "brand:playwright"),
  p("docker", "Docker", "Containers", "devops", "brand:docker"),
  p("aws", "AWS", "Cloud platform", "cloud", "brand:aws"),
  p("azure", "Azure", "Cloud platform", "cloud", "brand:azure"),
  p("gcp", "Google Cloud", "Cloud platform", "cloud", "brand:gcp"),
];

export const PALETTE: PaletteItem[] = [
  // ── AI / ML ────────────────────────────────────────────────────────────────
  { type: "llm", label: "LLM", subtitle: "Chat / completion", category: "ai", icon: "Brain" },
  { type: "vlm", label: "Vision Model", subtitle: "Image + text", category: "ai", icon: "Image" },
  { type: "agent", label: "Agent", subtitle: "Tool-using loop", category: "ai", icon: "Bot" },
  {
    type: "planner",
    label: "Planner Agent",
    subtitle: "Master plan & state",
    category: "ai",
    icon: "ListTodo",
  },
  {
    type: "orchestrator",
    label: "Orchestrator",
    subtitle: "Plan & route",
    category: "ai",
    icon: "Workflow",
  },
  {
    type: "router",
    label: "Model Router",
    subtitle: "Prompt / model routing",
    category: "ai",
    icon: "Route",
  },
  {
    type: "subagent",
    label: "Sub-agent",
    subtitle: "Specialised worker",
    category: "ai",
    icon: "Users",
  },
  {
    type: "embedder",
    label: "Embedding Model",
    subtitle: "Vectorize",
    category: "ai",
    icon: "Sparkles",
  },
  {
    type: "reranker",
    label: "Reranker",
    subtitle: "Cross-encoder",
    category: "ai",
    icon: "ArrowDownWideNarrow",
  },
  {
    type: "evaluator",
    label: "Evaluator / Judge",
    subtitle: "Scoring · grounding",
    category: "ai",
    icon: "Gauge",
  },
  {
    type: "extractor",
    label: "Entity Extractor",
    subtitle: "Entities & relations",
    category: "ai",
    icon: "Scan",
  },
  {
    type: "translator",
    label: "Translator",
    subtitle: "Language handling",
    category: "ai",
    icon: "Languages",
  },
  {
    type: "clarifier",
    label: "Clarify-back",
    subtitle: "Ask, don't refuse",
    category: "ai",
    icon: "MessageCircleQuestion",
  },
  {
    type: "skills",
    label: "Agent Skills",
    subtitle: "Encoded expertise",
    category: "ai",
    icon: "Puzzle",
  },
  {
    type: "prompts",
    label: "Prompt Store",
    subtitle: "Templates & versions",
    category: "ai",
    icon: "FileCode2",
  },

  // ── Knowledge & data ───────────────────────────────────────────────────────
  {
    type: "vectordb",
    label: "Vector DB",
    subtitle: "Similarity search",
    category: "data",
    icon: "Boxes",
  },
  {
    type: "kg",
    label: "Knowledge Graph",
    subtitle: "Entities & links",
    category: "data",
    icon: "Network",
  },
  {
    type: "graphdb",
    label: "Graph DB",
    subtitle: "Neo4j / Neptune",
    category: "data",
    icon: "Share2",
  },
  {
    type: "kb",
    label: "Knowledge Base",
    subtitle: "Curated markdown / docs",
    category: "data",
    icon: "BookOpen",
  },
  {
    type: "search",
    label: "Search Index",
    subtitle: "Hybrid / BM25",
    category: "data",
    icon: "Search",
  },
  {
    type: "documents",
    label: "Documents",
    subtitle: "PDF · SOP · policies",
    category: "data",
    icon: "FileText",
  },
  {
    type: "parser",
    label: "Parser / OCR",
    subtitle: "Extract text & tables",
    category: "data",
    icon: "ScanText",
  },
  {
    type: "chunker",
    label: "Chunker",
    subtitle: "Split · enrich · version",
    category: "data",
    icon: "Scissors",
  },
  {
    type: "sql",
    label: "Relational DB",
    subtitle: "PostgreSQL",
    category: "data",
    icon: "Database",
  },
  {
    type: "nosql",
    label: "Document DB",
    subtitle: "MongoDB / DynamoDB",
    category: "data",
    icon: "Database",
  },
  { type: "cache", label: "Cache", subtitle: "Redis", category: "data", icon: "Zap" },
  {
    type: "objectstore",
    label: "Object Store",
    subtitle: "S3 / Blob",
    category: "data",
    icon: "HardDrive",
  },
  {
    type: "memory",
    label: "Memory Store",
    subtitle: "Session · agentic state",
    category: "data",
    icon: "Layers",
  },
  {
    type: "warehouse",
    label: "Warehouse / Lake",
    subtitle: "Athena · Snowflake",
    category: "data",
    icon: "Warehouse",
  },
  {
    type: "enterprise",
    label: "Enterprise System",
    subtitle: "SAP · Salesforce · QMS",
    category: "data",
    icon: "Building2",
  },

  // ── Integration ────────────────────────────────────────────────────────────
  {
    type: "api",
    label: "API Gateway",
    subtitle: "REST / GraphQL",
    category: "integration",
    icon: "Globe",
  },
  {
    type: "mcp",
    label: "MCP Server",
    subtitle: "Tool protocol",
    category: "integration",
    icon: "brand:mcp",
  },
  {
    type: "tools",
    label: "Tools / Functions",
    subtitle: "Function calling",
    category: "integration",
    icon: "Wrench",
  },
  {
    type: "queue",
    label: "Queue",
    subtitle: "SQS / AMQP",
    category: "integration",
    icon: "ListOrdered",
  },
  {
    type: "kafka",
    label: "Event Stream",
    subtitle: "Kafka · EventBridge",
    category: "integration",
    icon: "brand:kafka",
  },
  {
    type: "workflow",
    label: "Workflow Engine",
    subtitle: "Step Functions · Temporal",
    category: "integration",
    icon: "GitFork",
  },
  {
    type: "webhook",
    label: "Webhook",
    subtitle: "Callback",
    category: "integration",
    icon: "Webhook",
  },
  {
    type: "tracker",
    label: "Work Tracker",
    subtitle: "Jira · Azure DevOps",
    category: "integration",
    icon: "ClipboardList",
  },
  {
    type: "testmgmt",
    label: "Test Management",
    subtitle: "Xray · TestRail",
    category: "integration",
    icon: "ClipboardCheck",
  },
  {
    type: "repo",
    label: "Repository",
    subtitle: "GitHub · GitLab",
    category: "integration",
    icon: "GitPullRequest",
  },
  {
    type: "browser",
    label: "Browser Automation",
    subtitle: "Playwright",
    category: "integration",
    icon: "AppWindow",
  },

  // ── Security & governance ──────────────────────────────────────────────────
  {
    type: "guardrail",
    label: "Guardrail",
    subtitle: "Policy · grounding",
    category: "security",
    icon: "ShieldCheck",
  },
  {
    type: "hitl",
    label: "Human Approval",
    subtitle: "HITL gate",
    category: "security",
    icon: "UserCheck",
  },
  {
    type: "hooks",
    label: "Lifecycle Hooks",
    subtitle: "pre/post tool checks",
    category: "security",
    icon: "Anchor",
  },
  {
    type: "iam",
    label: "IAM / SSO",
    subtitle: "OIDC · RBAC",
    category: "security",
    icon: "KeyRound",
  },
  {
    type: "secrets",
    label: "Secrets",
    subtitle: "KMS / vault",
    category: "security",
    icon: "Lock",
  },
  {
    type: "waf",
    label: "WAF / CDN",
    subtitle: "Edge protection",
    category: "security",
    icon: "Shield",
  },
  {
    type: "audit",
    label: "Audit Log",
    subtitle: "Immutable records",
    category: "security",
    icon: "ScrollText",
  },

  // ── Application ────────────────────────────────────────────────────────────
  { type: "user", label: "User", subtitle: "Human actor", category: "application", icon: "User" },
  {
    type: "web",
    label: "Web App",
    subtitle: "Browser client",
    category: "application",
    icon: "MonitorSmartphone",
  },
  {
    type: "chat",
    label: "Chat UI",
    subtitle: "Slack · Teams · web",
    category: "application",
    icon: "MessageSquare",
  },
  {
    type: "ide",
    label: "Developer IDE",
    subtitle: "VS Code · Kiro · CLI",
    category: "application",
    icon: "Terminal",
  },
  {
    type: "mobile",
    label: "Mobile App",
    subtitle: "iOS / Android",
    category: "application",
    icon: "Smartphone",
  },
  {
    type: "service",
    label: "Microservice",
    subtitle: "Container",
    category: "application",
    icon: "Server",
  },
  {
    type: "worker",
    label: "Worker",
    subtitle: "Background job",
    category: "application",
    icon: "Cog",
  },
  {
    type: "codegen",
    label: "Generated Code",
    subtitle: "POM · tests · docs",
    category: "application",
    icon: "Code2",
  },

  // ── Cloud & DevOps ─────────────────────────────────────────────────────────
  {
    type: "serverless",
    label: "Function",
    subtitle: "Lambda · Cloud Run",
    category: "cloud",
    icon: "FunctionSquare",
  },
  {
    type: "k8s",
    label: "Kubernetes",
    subtitle: "Cluster",
    category: "devops",
    icon: "brand:kubernetes",
  },
  {
    type: "cicd",
    label: "CI/CD",
    subtitle: "Actions · pipelines",
    category: "devops",
    icon: "GitBranch",
  },
  {
    type: "iac",
    label: "Infrastructure as Code",
    subtitle: "Terraform · CDK",
    category: "devops",
    icon: "Blocks",
  },
  {
    type: "observability",
    label: "Observability",
    subtitle: "OTel · traces · metrics",
    category: "devops",
    icon: "Activity",
  },
  {
    type: "dashboard",
    label: "Dashboards",
    subtitle: "Usage · cost · quality",
    category: "devops",
    icon: "BarChart3",
  },
  {
    type: "alerts",
    label: "Alerts & Budgets",
    subtitle: "Limits · alarms",
    category: "devops",
    icon: "Bell",
  },
  ...EXTENDED,
];

export const PALETTE_TYPES = PALETTE.map((p) => p.type);
