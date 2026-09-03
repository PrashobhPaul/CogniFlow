import {
  siAnthropic,
  siApacheairflow,
  siApachekafka,
  siClaude,
  siCloudflare,
  siConfluence,
  siCrewai,
  siCypress,
  siDatabricks,
  siDatadog,
  siDeepseek,
  siDocker,
  siDotnet,
  siElasticsearch,
  siFastapi,
  siFirebase,
  siGithub,
  siGooglecloud,
  siGooglepubsub,
  siGooglegemini,
  siGrafana,
  siGraphql,
  siHuggingface,
  siJira,
  siKubernetes,
  siLangchain,
  siLanggraph,
  siLmstudio,
  siMeta,
  siMilvus,
  siMistralai,
  siMlflow,
  siModelcontextprotocol,
  siMongodb,
  siN8n,
  siNeo4j,
  siNotion,
  siNvidia,
  siOllama,
  siOpentelemetry,
  siPerplexity,
  siPostgresql,
  siPrometheus,
  siPython,
  siQdrant,
  siRabbitmq,
  siRedis,
  siSelenium,
  siSnowflake,
  siSocketdotio,
  siSupabase,
  siTerraform,
  siWeightsandbiases,
} from "simple-icons";

/**
 * Brand marks used inside the 3D medallions. Logo paths come from the CC0
 * simple-icons set (24×24 viewBox); brands it does not carry get a monogram
 * in a brand-like colour. Logos remain trademarks of their owners and are used
 * only to denote the product in an architecture diagram.
 */
export interface Brand {
  slug: string;
  title: string;
  hex: string;
  /** simple-icons path in a 24×24 viewBox. */
  path?: string;
  /** Fallback letters when no logo path is available. */
  mono?: string;
}

type SimpleIcon = { title: string; hex: string; path: string };

const si = (slug: string, icon: SimpleIcon, title?: string): Brand => ({
  slug,
  title: title ?? icon.title,
  hex: `#${icon.hex}`,
  path: icon.path,
});
const mono = (slug: string, title: string, hex: string, letters: string): Brand => ({
  slug,
  title,
  hex,
  mono: letters,
});

export const BRANDS: Record<string, Brand> = {
  // Foundation models & providers
  openai: mono("openai", "OpenAI", "#10A37F", "O"),
  claude: si("claude", siClaude),
  anthropic: si("anthropic", siAnthropic),
  gemini: si("gemini", siGooglegemini, "Gemini"),
  llama: si("llama", siMeta, "Llama"),
  deepseek: si("deepseek", siDeepseek),
  mistral: si("mistral", siMistralai, "Mistral"),
  ollama: si("ollama", siOllama),
  huggingface: si("huggingface", siHuggingface, "Hugging Face"),
  perplexity: si("perplexity", siPerplexity),
  lmstudio: si("lmstudio", siLmstudio, "LM Studio"),
  nvidia: si("nvidia", siNvidia),
  groq: mono("groq", "Groq", "#F55036", "Gq"),
  cohere: mono("cohere", "Cohere", "#39594D", "Co"),
  bedrock: mono("bedrock", "Amazon Bedrock", "#FF9900", "Br"),
  azureopenai: mono("azureopenai", "Azure OpenAI", "#0078D4", "Az"),
  vertex: mono("vertex", "Vertex AI", "#4285F4", "Vx"),

  // Frameworks & orchestration
  langgraph: si("langgraph", siLanggraph),
  langchain: si("langchain", siLangchain),
  llamaindex: mono("llamaindex", "LlamaIndex", "#7C3AED", "Li"),
  autogen: mono("autogen", "AutoGen", "#0078D4", "Ag"),
  crewai: si("crewai", siCrewai),
  semantickernel: mono("semantickernel", "Semantic Kernel", "#5C2D91", "SK"),
  agentframework: mono("agentframework", "Microsoft Agent Framework", "#0078D4", "AF"),
  kiro: mono("kiro", "Kiro", "#8B5CF6", "Ki"),
  copilot: mono("copilot", "GitHub Copilot", "#24292E", "Cp"),
  n8n: si("n8n", siN8n),
  airflow: si("airflow", siApacheairflow, "Airflow"),
  mlflow: si("mlflow", siMlflow),
  wandb: si("wandb", siWeightsandbiases, "Weights & Biases"),

  // Vector search, caching & data
  pinecone: mono("pinecone", "Pinecone", "#1C17FF", "Pc"),
  chroma: mono("chroma", "Chroma", "#FF6A3D", "Ch"),
  faiss: mono("faiss", "FAISS", "#0467DF", "Fa"),
  qdrant: si("qdrant", siQdrant),
  milvus: si("milvus", siMilvus),
  weaviate: mono("weaviate", "Weaviate", "#3DBD8B", "Wv"),
  redis: si("redis", siRedis),
  postgres: si("postgres", siPostgresql, "PostgreSQL"),
  neo4j: si("neo4j", siNeo4j),
  s3: mono("s3", "Amazon S3", "#569A31", "S3"),
  minio: mono("minio", "MinIO", "#C72E49", "Mn"),
  mongodb: si("mongodb", siMongodb),
  elasticsearch: si("elasticsearch", siElasticsearch),
  snowflake: si("snowflake", siSnowflake),
  databricks: si("databricks", siDatabricks),
  supabase: si("supabase", siSupabase),
  firebase: si("firebase", siFirebase),
  kafka: si("kafka", siApachekafka, "Kafka"),

  // Queues & messaging
  rabbitmq: si("rabbitmq", siRabbitmq),
  sqs: mono("sqs", "Amazon SQS", "#FF4F8B", "SQS"),
  gcppubsub: si("gcppubsub", siGooglepubsub, "Google Pub/Sub"),

  // Gateways, connectivity & protocols
  mcp: si("mcp", siModelcontextprotocol, "MCP"),
  a2a: mono("a2a", "Agent-to-Agent", "#4285F4", "A2A"),
  grpc: mono("grpc", "gRPC", "#244C5A", "RPC"),
  websocket: si("websocket", siSocketdotio, "WebSocket"),
  graphql: si("graphql", siGraphql),
  fastapi: si("fastapi", siFastapi),
  cloudflare: si("cloudflare", siCloudflare),

  // Safety, observability & tooling
  langsmith: mono("langsmith", "LangSmith", "#1C3C3C", "Ls"),
  arize: mono("arize", "Arize", "#4B3AFF", "Ar"),
  langfuse: mono("langfuse", "Langfuse", "#0A60B5", "Lf"),
  cloudwatch: mono("cloudwatch", "Amazon CloudWatch", "#E7157B", "CW"),
  datadog: si("datadog", siDatadog),
  otel: si("otel", siOpentelemetry, "OpenTelemetry"),
  grafana: si("grafana", siGrafana),
  prometheus: si("prometheus", siPrometheus),
  github: si("github", siGithub),
  jira: si("jira", siJira),
  xray: mono("xray", "Xray", "#00A3BF", "Xr"),
  confluence: si("confluence", siConfluence),
  notion: si("notion", siNotion),
  selenium: si("selenium", siSelenium),
  playwright: mono("playwright", "Playwright", "#2EAD33", "Pw"),
  cypress: si("cypress", siCypress),
  terraform: si("terraform", siTerraform),
  kubernetes: si("kubernetes", siKubernetes),
  docker: si("docker", siDocker),
  gcp: si("gcp", siGooglecloud, "Google Cloud"),
  aws: mono("aws", "AWS", "#FF9900", "aws"),
  azure: mono("azure", "Azure", "#0078D4", "Az"),
  python: si("python", siPython),
  dotnet: si("dotnet", siDotnet, ".NET"),
};

export function brandFor(icon: string): Brand | null {
  if (!icon.startsWith("brand:")) return null;
  return BRANDS[icon.slice(6)] ?? null;
}
