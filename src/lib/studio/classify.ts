import { PALETTE } from "./palette";
import type { NodeCategory, SemanticType, ExecutionMode, Grammar } from "./types";

/**
 * Shared rule-based classifiers. Used by the draw.io importer, the description
 * compiler and the post-processor for model output, so every entry path lands
 * on the same component types, icons and connector defaults. Rules are ordered
 * from most to least specific; the first match wins.
 */

export interface ComponentGuess {
  category: NodeCategory;
  icon: string;
  type: string;
}

const g = (type: string): ComponentGuess => {
  const p = PALETTE.find((x) => x.type === type);
  return p
    ? { category: p.category, icon: p.icon, type }
    : { category: "application", icon: "Server", type };
};

const RULES: [RegExp, ComponentGuess][] = [
  // Brands, providers & protocols — named products beat generic roles
  [/\b(openai|chatgpt|gpt-?[3-5][\w.-]*|o[1-4](-mini|-pro)?)\b/, g("openai")],
  [/\b(claude|anthropic|sonnet|opus|haiku)\b/, g("claude")],
  [/\b(gemini)\b/, g("gemini")],
  [/\b(vertex ai|vertex)\b/, g("vertex")],
  [/\b(llama ?\d?[\w.-]*|meta ai)\b(?! ?index)/, g("llama")],
  [/\b(deepseek)\b/, g("deepseek")],
  [/\b(mistral|mixtral|codestral)\b/, g("mistral")],
  [/\b(ollama)\b/, g("ollama")],
  [/\b(hugging ?face|hf hub|hf router)\b/, g("huggingface")],
  [/\b(bedrock)\b/, g("bedrock")],
  [/\b(azure openai|aoai|azure ai foundry|foundry)\b/, g("azureopenai")],
  [/\b(groq)\b/, g("groq")],
  [/\b(cohere|command r)\b/, g("cohere")],
  [/\b(slm|small language model|phi-?[34][\w.-]*|smollm2?|gemma|qwen[\w.-]*)\b/, g("slm")],
  [/\b(langgraph)\b/, g("langgraph")],
  [/\b(langchain)\b/, g("langchain")],
  [/\b(llama ?index)\b/, g("llamaindex")],
  [/\b(autogen|ag2)\b/, g("autogen")],
  [/\b(crew ?ai)\b/, g("crewai")],
  [/\b(semantic kernel)\b/, g("semantickernel")],
  [/\b(microsoft agent framework|agent framework|maf)\b/, g("agentframework")],
  [/\b(kiro)\b/, g("kiro")],
  [/\b(copilot)\b/, g("copilot")],
  [/\b(langsmith)\b/, g("langsmith")],
  [/\b(arize|phoenix)\b/, g("arize")],
  [/\b(langfuse)\b/, g("langfuse")],
  [/\b(cloudwatch)\b/, g("cloudwatch")],
  [/\b(datadog)\b/, g("datadog")],
  [/\b(opentelemetry|otel|tracing|traces|trace collector|telemetry)\b/, g("tracing")],
  [/\b(pinecone)\b/, g("pinecone")],
  [/\b(chroma|chromadb)\b/, g("chroma")],
  [/\b(faiss)\b/, g("faiss")],
  [/\b(qdrant)\b/, g("qdrant")],
  [/\b(milvus|zilliz)\b/, g("milvus")],
  [/\b(weaviate)\b/, g("weaviate")],
  [/\b(redis|elasticache|valkey)\b/, g("redis")],
  [/\b(semantic cache|prompt cache|response cache)\b/, g("semanticcache")],
  [/\b(pgvector|postgres|postgresql|aurora)\b/, g("postgres")],
  [/\b(neo4j|cypher)\b/, g("neo4j")],
  [/\b(s3|amazon s3)\b/, g("s3")],
  [/\b(a2a|agent[- ]to[- ]agent)\b/, g("a2a")],
  [/\b(grpc)\b/, g("grpc")],
  [/\b(websocket|websockets|socket\.io|realtime channel)\b/, g("websocket")],
  [/\b(llm gateway|model gateway|litellm|portkey)\b/, g("llmgateway")],
  [/\b(ai gateway)\b/, g("aigateway")],
  [/\b(rabbit ?mq)\b/, g("rabbitmq")],
  [/\b(sqs|amazon sqs)\b/, g("sqs")],
  [/\b(google pub\/?sub|cloud pub\/?sub|gcp pub\/?sub)\b/, g("gcppubsub")],
  [/\b(pub\/?sub|event bus|eventbridge|sns|message bus|event grid)\b/, g("pubsub")],
  [/\b(load balancer|alb|nlb|elb|ingress)\b/, g("loadbalancer")],
  [
    /\b(steering|steering file|system prompt|system directive|directives|constitution|agents\.md|claude\.md)\b/,
    g("steering"),
  ],
  [/\b(sandbox|code interpreter|code execution|isolated runtime|e2b)\b/, g("sandbox")],
  [/\b(cli|terminal|shell|command line)\b/, g("cli")],
  [/\b(rate limit|rate limiter|rate limiting|throttl\w*|quota)\b/, g("ratelimiter")],
  [/\b(browser extension|chrome extension|extension)\b/, g("extension")],
  [/\b(sdk|embedded sdk|client library)\b/, g("sdk")],
  [/\b(state machine|fsm)\b/, g("statemachine")],
  [/\b(dag|workflow node|pipeline step)\b/, g("dag")],
  [/\b(parallel executor|fan[- ]out|map[- ]reduce|parallel)\b/, g("parallel")],
  [/\b(jira)\b/, g("jira")],
  [/\b(xray|x-ray)\b/, g("xray")],
  [/\b(github|gitlab|bitbucket)\b/, g("github")],
  [/\b(confluence|notion|wiki)\b/, g("confluence")],
  [/\b(selenium|webdriver)\b/, g("selenium")],
  [/\b(playwright|cypress)\b/, g("playwright")],
  [/\b(docker|container image)\b/, g("docker")],
  [/\b(terraform|cdk|bicep|pulumi)\b/, g("iac")],
  [/\b(aws|amazon web services|lambda|ecs|eks)\b/, g("aws")],
  [/\b(azure|aks|azure functions)\b/, g("azure")],
  [/\b(gcp|google cloud|gke|cloud run)\b/, g("gcp")],

  // Governance & people
  [
    /\b(hitl|human[- ]in[- ]the[- ]loop|approval|approve|reviewer|sign[- ]?off|approval console|human gate)\b/,
    g("hitl"),
  ],
  [/\b(hook|hooks|pretooluse|posttooluse|pre-merge|lifecycle)\b/, g("hooks")],
  [/\b(audit|audit log|provenance|immutable)\b/, g("audit")],
  [
    /\b(guardrail|guardrails|grounding check|policy filter|moderation|safety|content filter|pii scan|secrets scan|gitleaks)\b/,
    g("guardrail"),
  ],
  [/\b(waf|firewall|cdn|cloudfront|edge protection)\b/, g("waf")],
  [
    /\b(sso|oidc|oauth|iam|rbac|identity|entra|login|auth|authentication|authorization)\b/,
    g("iam"),
  ],
  [/\b(kms|vault|secret|secrets)\b/, g("secrets")],
  [
    /\b(user|users|customer|persona|actor|human|tester|architect|developer|curator|admin|analyst)\b/,
    g("user"),
  ],

  // AI / ML
  [/\b(clarif|ask[- ]back|question[- ]back|disambiguat)\w*/, g("clarifier")],
  [/\b(skill|skills|steering|playbook|expertise)\b/, g("skills")],
  [/\b(prompt store|prompt template|prompt registry|prompt library|prompt version)/, g("prompts")],
  [/\b(embed|embedding|embeddings|embedder|vectoriz|titan)\w*/, g("embedder")],
  [/\b(rerank|reranker|cross-encoder|re-rank)\w*/, g("reranker")],
  [
    /\b(eval|evaluator|evaluation|scoring|judge|grader|validaite|qmentis|quality gate|confidence)\w*/,
    g("evaluator"),
  ],
  [/\b(entity|entities|extraction|extractor|relation extraction|ner|triples)\b/, g("extractor")],
  [/\b(translat|multilingual|language detection|locali[sz])\w*/, g("translator")],
  [/\b(vision model|vlm|multimodal|image model|ocr model|gpt-4o|qwen.?vl|smolvlm)\b/, g("vlm")],
  [/\b(master planner|planner|planning agent|aon agent|task planner)\b/, g("planner")],
  [
    /\b(router|routing|model router|prompt routing|intelligent prompt routing|dispatcher)\b/,
    g("router"),
  ],
  [
    /\b(orchestrat|supervisor|coordinator|workflow agent|agent orchestrator|control plane)\w*/,
    g("orchestrator"),
  ],
  [/\b(sub-?agent|subagent|worker agent|specialist)\b/, g("subagent")],
  [/\b(agent|agents|agentic|assistant|copilot|bot)\b/, g("agent")],
  [
    /\b(llm|gpt|claude|gemini|llama|mistral|qwen|sonnet|opus|haiku|bedrock|openai|azure openai|model|inference|completion|foundation)\b/,
    g("llm"),
  ],

  // Knowledge & data
  [
    /\b(vector|pinecone|qdrant|weaviate|milvus|chroma|faiss|pgvector|opensearch serverless|similarity)\b/,
    g("vectordb"),
  ],
  [/\b(knowledge ?graph|ontology|graph ?rag|triple ?store|kg)\b/, g("kg")],
  [/\b(neo4j|neptune|graph ?db|graph database|gremlin|cypher)\b/, g("graphdb")],
  [/\b(knowledge ?base|kb|bedrock kb|wiki|confluence|sharepoint|curated)\b/, g("kb")],
  [/\b(parser|parse|ocr|extract text|document intelligence|textract|unstructured)\b/, g("parser")],
  [/\b(chunk|chunker|chunking|splitter|ingest|ingestion|indexing pipeline)\w*/, g("chunker")],
  [/\b(search|retriev|index|indexer|elasticsearch|opensearch|solr|bm25|hybrid)\w*/, g("search")],
  [/\b(cache|redis|memcache)\w*/, g("cache")],
  [
    /\b(memory|session|state store|conversation history|agenticstate|agentic state|checkpoint)\b/,
    g("memory"),
  ],
  [/\b(s3|bucket|blob|object ?stor|minio|gcs|file ?stor)\w*/, g("objectstore")],
  [
    /\b(athena|warehouse|snowflake|bigquery|redshift|lake|lakehouse|databricks|bi export)\w*/,
    g("warehouse"),
  ],
  [/\b(mongo|mongodb|dynamo|dynamodb|cosmos|documentdb|firestore|couch)\w*/, g("nosql")],
  [/\b(sap|salesforce|qms|erp|crm|servicenow|workday|system of record)\b/, g("enterprise")],
  [/\b(db|database|sql|postgres|postgresql|mysql|aurora|rds|sqlite)\w*/, g("sql")],
  [
    /\b(audio|voice|speech|microphone|mic|podcasts?|call recordings?|stt|tts|transcripts?)\b/,
    g("audio"),
  ],
  [/\b(videos?|screen recordings?|camera|media files|footage|frames)\b/, g("video")],
  [
    /\b(document|documents|docs|pdf|pdfs|files|corpus|sop|sops|policies|manuals|specs?)\b/,
    g("documents"),
  ],

  // Integration
  [/\b(jira|azure devops|ado|work item|work items|backlog|story|stories|ticket)\b/, g("tracker")],
  [/\b(xray|testrail|zephyr|test management|test cases? repository)\b/, g("testmgmt")],
  [/\b(github|gitlab|bitbucket|repository|repo|merge request|pull request|git)\b/, g("repo")],
  [
    /\b(playwright|selenium|cypress|puppeteer|browser automation|ui explorer|dom scan)\b/,
    g("browser"),
  ],
  [
    /\b(step functions|temporal|airflow|workflow engine|state machine|pipeline orchestrator)\b/,
    g("workflow"),
  ],
  [
    /\b(kafka|event ?bus|event ?stream|pubsub|pub\/sub|topic|eventhub|eventbridge|kinesis|sns)\w*/,
    g("kafka"),
  ],
  [/\b(queue|sqs|rabbit|amqp|celery|job ?queue|task ?queue)\w*/, g("queue")],
  [/\b(mcp|mcp server|mcp connector)\b/, g("mcp")],
  [/\b(tool|tools|plugin|plugins|function calling|connector|adapter)\b/, g("tools")],
  [/\b(webhook|callback)\w*/, g("webhook")],
  [/\b(gateway|api|rest|graphql|endpoint|bff|load ?balancer|ingress)\b/, g("api")],

  // Application
  [/\b(ide|vs code|vscode|cursor|kiro|cli|terminal|editor)\b/, g("ide")],
  [/\b(chat ?ui|chatbot|slack|teams|whatsapp|chat client|conversational)\b/, g("chat")],
  [/\b(mobile|ios|android|phone)\b/, g("mobile")],
  [/\b(web ?app|browser|frontend|front-end|ui|spa|website|portal|dashboard ui|client)\b/, g("web")],
  [
    /\b(pom|page object|generated code|codegen|code generation|test scripts?|scaffold)\b/,
    g("codegen"),
  ],

  // Cloud & DevOps
  [/\b(terraform|cdk|pulumi|cloudformation|infrastructure as code|iac)\b/, g("iac")],
  [/\b(k8s|kubernetes|cluster|container|docker|pod|eks|aks)\w*/, g("k8s")],
  [/\b(ci\/cd|cicd|github actions|jenkins|deploy|deployment|release pipeline)\w*/, g("cicd")],
  [
    /\b(dashboard|dashboards|grafana|quicksight|power ?bi|tableau|report|reporting)\w*/,
    g("dashboard"),
  ],
  [/\b(alarm|alarms|alert|alerts|budget|budgets|quota|rate limit)\w*/, g("alerts")],
  [
    /\b(monitor|metric|trace|tracing|log|logs|logging|observ|telemetry|opentelemetry|otel|cloudwatch|datadog|langfuse|langsmith)\w*/,
    g("observability"),
  ],
  [/\b(lambda|function|functions|serverless|cloud run|azure function)\w*/, g("serverless")],
  [/\b(worker|workers|job|jobs|batch|cron|scheduler)\w*/, g("worker")],
  [
    /\b(service|microservice|backend|server|app|application|engine|processor|analy|normali[sz]er|composer|builder|writer|adapter)\w*/,
    g("service"),
  ],
];

export function guessComponent(label: string): ComponentGuess {
  const l = label.toLowerCase();
  for (const [re, guess] of RULES) if (re.test(l)) return guess;
  return { category: "application", icon: "Server", type: "generic" };
}

export function iconForType(type: string, fallback = "Server"): string {
  return (
    PALETTE.find((p) => p.type === type)?.icon ??
    RULES.find(([, g]) => g.type === type)?.[1].icon ??
    fallback
  );
}

export function categoryForType(type: string): NodeCategory {
  return (
    PALETTE.find((p) => p.type === type)?.category ??
    RULES.find(([, g]) => g.type === type)?.[1].category ??
    "application"
  );
}

export function guessSemantics(
  style: string,
  label: string,
): { semantic: SemanticType; protocol: string } {
  const hay = `${style} ${label}`.toLowerCase();
  if (/kafka|event|topic|pubsub|publish|emit|notif|trigger/.test(hay))
    return { semantic: "event", protocol: "Kafka" };
  if (/stream|sse|websocket|token|realtime|real-time/.test(hay))
    return { semantic: "stream", protocol: "WebSocket" };
  if (
    /search|retriev|query|knn|lookup|similar|vector ?(?:db|store|database)|index|traversal|cypher/.test(
      hay,
    )
  )
    return { semantic: "retrieval", protocol: "gRPC" };
  if (/embed|vector/.test(hay)) return { semantic: "embedding", protocol: "gRPC" };
  if (
    /rerank|candidates?|chunks?|top-?k|memory|session|state|cache|context|handoff|draft|payload|entities|triples/.test(
      hay,
    )
  )
    return { semantic: "data", protocol: "gRPC" };
  if (/response|reply|result|answer|return|approved|write-?back/.test(hay))
    return { semantic: "response", protocol: "REST" };
  if (/error|fail|exception|reject/.test(hay)) return { semantic: "error", protocol: "REST" };
  if (/retry|rebuild|loop/.test(hay)) return { semantic: "retry", protocol: "REST" };
  if (/tool|mcp|function call|invoke/.test(hay)) return { semantic: "message", protocol: "MCP" };
  if (/upload|file|document|pdf|ingest|export/.test(hay))
    return { semantic: "file", protocol: "S3" };
  if (/auth|policy|guard|control|approve|validate|gate|hook|check/.test(hay))
    return { semantic: "control", protocol: "gRPC" };
  if (/sql|db|database|store|write|read|persist|save|load|log|span|telemetry|audit/.test(hay))
    return { semantic: "data", protocol: "SQL" };
  return { semantic: "request", protocol: "REST" };
}

export function defaultProtocol(semantic: SemanticType, targetType: string): string {
  switch (targetType) {
    case "kafka":
      return "Kafka";
    case "queue":
    case "rabbitmq":
      return "AMQP";
    case "sqs":
    case "gcppubsub":
      return "REST";
    case "audio":
    case "video":
      return "S3";
    case "mcp":
    case "tools":
      return "MCP";
    case "sql":
    case "memory":
    case "warehouse":
      return "SQL";
    case "nosql":
    case "cache":
    case "tracker":
    case "testmgmt":
    case "repo":
    case "enterprise":
      return "REST";
    case "objectstore":
    case "documents":
      return "S3";
    case "vectordb":
    case "search":
    case "kg":
    case "graphdb":
    case "embedder":
    case "reranker":
      return "gRPC";
    case "browser":
      return "CDP";
    default:
      break;
  }
  switch (semantic) {
    case "event":
      return "Kafka";
    case "stream":
      return "SSE";
    case "embedding":
    case "retrieval":
    case "control":
      return "gRPC";
    case "message":
      return "MCP";
    case "file":
      return "S3";
    case "data":
      return "SQL";
    default:
      return "REST";
  }
}

export function defaultExecutionMode(semantic: SemanticType): ExecutionMode {
  if (semantic === "stream") return "streaming";
  if (semantic === "event" || semantic === "message") return "asynchronous";
  if (semantic === "file") return "batch";
  return "synchronous";
}

export function defaultGrammar(semantic: SemanticType, executionMode: ExecutionMode): Grammar {
  if (semantic === "stream" || executionMode === "streaming") return "dense";
  if (semantic === "event") return "pulse";
  if (executionMode === "batch" || semantic === "file") return "batch";
  if (semantic === "data" || semantic === "retrieval") return "stream";
  return "packet";
}
