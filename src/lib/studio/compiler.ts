import { candidateToGraph, type Candidate, type CandidateResult, SEMANTICS } from "./candidate";
import { guessSemantics } from "./classify";
import { matchPattern } from "./samples";

/**
 * Free-tier description compiler. Purely rule-based and deterministic:
 * arrows ("A -> B -> C", "A <-> B"), verbs ("gateway sends events to Kafka"),
 * clause chaining ("…, which writes to Postgres and publishes to Kafka"),
 * containment ("platform with A, B and C") and fronting ("app behind a WAF")
 * all become connectors; keyword classifiers pick component types, icons,
 * connector semantics, protocols and motion grammars. No model is involved.
 */

export interface CompileResult extends CandidateResult {
  engine: "rules";
  statements: number;
}

type Semantic = (typeof SEMANTICS)[number];
type Op = "->" | "<-" | "<->";

interface VerbRule {
  re: RegExp;
  semantic: Semantic;
  reverse?: boolean;
  bidirectional?: boolean;
  label?: string;
  /** Capture group index holding the object words between verb and preposition. */
  objectGroup?: number;
}

// "<verb> [up to three object words] <to|into|onto|on>"
const OBJ = "((?:[\\w.'/-]+\\s+){0,3}?)";
const TO = "(?:to|into|onto|on|towards)";

const VERBS: VerbRule[] = [
  {
    re: new RegExp(`\\b(streams?|streaming|pipes?)\\s+${OBJ}(?:back\\s+)?${TO}\\b`, "i"),
    semantic: "stream",
    label: "stream",
    objectGroup: 2,
  },
  {
    re: new RegExp(
      `\\b(publish(?:es)?|emits?|broadcasts?|fires?|raises?|notifies)\\s+${OBJ}${TO}\\b`,
      "i",
    ),
    semantic: "event",
    objectGroup: 2,
  },
  {
    re: new RegExp(
      `\\b(sends?|pushes?|forwards?|routes?|passes?|posts?|submits?|dispatch(?:es)?|hands?\\s+off|transfers?)\\s+${OBJ}${TO}\\b`,
      "i",
    ),
    semantic: "request",
    objectGroup: 2,
  },
  {
    re: new RegExp(
      `\\b(returns?|responds?|replies|answers?|reports?\\s+back)\\s+${OBJ}${TO}\\b`,
      "i",
    ),
    semantic: "response",
    label: "response",
    objectGroup: 2,
  },
  {
    re: new RegExp(`\\b(uploads?|ingests?|imports?)\\s+${OBJ}${TO}\\b`, "i"),
    semantic: "file",
    label: "upload",
    objectGroup: 2,
  },
  {
    re: new RegExp(
      `\\b(writes?|persists?|stores?|saves?|caches?|records?)\\s+${OBJ}(?:to|in|into)\\b`,
      "i",
    ),
    semantic: "data",
    label: "write",
    objectGroup: 2,
  },
  {
    re: new RegExp(
      `\\b(logs?|traces?|reports?\\s+(?:metrics|telemetry|spans)?)\\s*${OBJ}${TO}\\b`,
      "i",
    ),
    semantic: "data",
    label: "telemetry",
    objectGroup: 2,
  },
  {
    re: /\b(queries|query|searches|search|looks?\s+up|retrieves?\s+(?:[\w-]+\s+){0,2}?from|fetches?\s+(?:[\w-]+\s+){0,2}?from|reads?\s+(?:[\w-]+\s+){0,2}?from|pulls?\s+(?:[\w-]+\s+){0,2}?from|loads?\s+(?:[\w-]+\s+){0,2}?from)\b/i,
    semantic: "retrieval",
    label: "query",
  },
  {
    re: /\b(embeds?\s+(?:[\w-]+\s+){0,2}?(?:via|with|using|through)|vectorizes?\s+(?:[\w-]+\s+){0,2}?(?:via|with|using))\b/i,
    semantic: "embedding",
    label: "embed",
  },
  {
    re: /\b(subscribes?\s+to|listens?\s+(?:to|on)|consumes?\s+(?:[\w-]+\s+){0,2}?from)\b/i,
    semantic: "event",
    reverse: true,
    label: "subscribe",
  },
  {
    re: /\b(authenticates?\s+(?:[\w-]+\s+){0,2}?(?:with|against|via)|authorizes?\s+(?:[\w-]+\s+){0,2}?(?:with|via)|validates?\s+(?:[\w-]+\s+){0,2}?(?:with|via|against)|checks?\s+(?:[\w-]+\s+){0,2}?(?:with|against))\b/i,
    semantic: "control",
    label: "auth",
  },
  {
    re: /\b(syncs?\s+with|exchanges?\s+(?:[\w-]+\s+){0,2}?with|integrates?\s+with|connects?\s+(?:to|with)|communicates?\s+with|talks?\s+with)\b/i,
    semantic: "message",
    bidirectional: true,
  },
  { re: /\b(retries|retry\s+against|retries\s+against)\b/i, semantic: "retry", label: "retry" },
  {
    re: /\b(reports?\s+errors?\s+to|fails?\s+over\s+to|escalates?\s+to)\b/i,
    semantic: "error",
    label: "error",
  },
  {
    re: /\b(calls?|invokes?|hits?|requests?|talks?\s+to|consults?|uses?|triggers?|asks?|delegates?\s+to)\b/i,
    semantic: "request",
  },
  {
    re: /\b(monitors?|observes?|watches)\b/i,
    semantic: "data",
    label: "telemetry",
  },
  {
    re: /\b(feeds?|flows?\s+(?:in)?to|goes\s+to|delivers?\s+to|provides?\s+(?:[\w-]+\s+){0,2}?to|serves?)\b/i,
    semantic: "data",
  },
];

/** Verbs that can start a subject-less clause ("…, which writes to X and publishes to Y"). */
const CLAUSE_VERB =
  /(?:sends?|pushes?|forwards?|routes?|passes?|posts?|submits?|dispatch(?:es)?|publish(?:es)?|emits?|broadcasts?|notifies|streams?|queries|query|searches|calls?|invokes?|hits?|requests?|writes?|persists?|stores?|saves?|caches?|returns?|responds?|replies|answers?|subscribes?|listens?|consumes?|authenticates?|validates?|checks?|uploads?|ingests?|feeds?|delivers?|reads?|fetches?|retrieves?|pulls?|loads?|triggers?|uses?|reports?|monitors?|logs?|traces?|syncs?|exchanges?|connects?|communicates?|talks?|delegates?|embeds?|records?|serves?|provides?)\b/i;
const CLAUSE_SPLIT = new RegExp(
  `\\s*,?\\s+(which|that|and|then|and\\s+then)\\s+(?=${CLAUSE_VERB.source})`,
  "i",
);
const STARTS_WITH_VERB = new RegExp(`^${CLAUSE_VERB.source}`, "i");

const ARTICLES = /^(?:a|an|the|our|its|their|your|my|some|each|every|this|that|these|those)\s+/i;
const TRAILING = /\s+(?:layer|tier|component|components|node)$/i;
const ACRONYMS = new Set([
  "llm",
  "api",
  "db",
  "rag",
  "mcp",
  "sql",
  "nosql",
  "s3",
  "cdn",
  "waf",
  "iam",
  "ui",
  "ux",
  "ci/cd",
  "cicd",
  "k8s",
  "kms",
  "sse",
  "grpc",
  "rest",
  "graphql",
  "http",
  "https",
  "sso",
  "oidc",
  "oauth",
  "etl",
  "ml",
  "ai",
  "gpt",
  "bff",
  "vm",
  "kb",
  "pdf",
  "csv",
  "json",
  "xml",
  "sla",
  "crm",
  "erp",
  "sdk",
  "cli",
  "ide",
  "gpu",
  "cpu",
  "faq",
  "ocr",
]);

const PROTOCOLS: [RegExp, string][] = [
  [/\b(grpc)\b/i, "gRPC"],
  [/\b(graphql)\b/i, "GraphQL"],
  [/\b(rest|http|https)\b/i, "REST"],
  [/\b(websockets?|ws)\b/i, "WebSocket"],
  [/\b(sse|server[- ]sent)\b/i, "SSE"],
  [/\b(kafka)\b/i, "Kafka"],
  [/\b(amqp|rabbitmq|sqs)\b/i, "AMQP"],
  [/\b(sql|jdbc|odbc)\b/i, "SQL"],
  [/\b(mcp)\b/i, "MCP"],
  [/\b(s3)\b/i, "S3"],
];

const SEMANTIC_HINTS: [RegExp, Semantic][] = [
  [/\b(streaming|streamed|stream)\b/i, "stream"],
  [/\b(event|events|async|asynchronous|notification)\b/i, "event"],
  [/\b(embedding|embeddings)\b/i, "embedding"],
  [/\b(retrieval|retrieve|search|lookup)\b/i, "retrieval"],
  [/\b(response|reply|answer)\b/i, "response"],
  [/\b(error|failure)\b/i, "error"],
  [/\b(retry|retries)\b/i, "retry"],
  [/\b(file|files|upload|document ingestion)\b/i, "file"],
  [/\b(control|policy|approval)\b/i, "control"],
];

interface ParsedPhrase {
  label: string;
  key: string;
  protocol: string | undefined;
  semantic: Semantic | undefined;
  execution: "streaming" | "asynchronous" | "batch" | undefined;
  subtitle: string | undefined;
}

function titleCase(v: string): string {
  return v
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase().replace("CICD", "CI/CD");
      if (/^[A-Z0-9][A-Za-z0-9]*[A-Z]/.test(w)) return w; // keep CamelCase / brand casing
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

const ALIASES: [RegExp, string][] = [
  [/\bvector (?:database|store)\b/i, "vector db"],
  [/\bapi gateway\b/i, "gateway"],
  [/\bknowledge base\b/i, "knowledge base"],
  [/\bpostgresql\b/i, "postgres"],
  [/\bkubernetes\b/i, "k8s"],
  [/\b(front[- ]?end|website|web application)\b/i, "web app"],
  [/\bdatabase\b/i, "db"],
];

export function normalizeKey(label: string): string {
  let v = label.toLowerCase();
  for (const [re, to] of ALIASES) v = v.replace(re, to);
  return v
    .replace(/\b(service|services|server|servers|system|systems)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/s$/, "");
}

export function parsePhrase(raw: string): ParsedPhrase | null {
  let text = raw
    .trim()
    .replace(/[.,;:!?]+$/g, "")
    .trim();
  let subtitle: string | undefined;
  let protocol: string | undefined;
  let semantic: Semantic | undefined;
  let execution: ParsedPhrase["execution"];

  const paren = text.match(/\(([^)]*)\)/);
  if (paren) {
    subtitle = paren[1]?.trim();
    text = text.replace(paren[0], " ").trim();
  }
  const via = text.match(
    /\b(?:over|via|using|through|on|with)\s+((?:grpc|graphql|rest|https?|websockets?|ws|sse|kafka|amqp|rabbitmq|sqs|sql|mcp|s3)\b[\w/.-]*)/i,
  );
  if (via) {
    protocol = PROTOCOLS.find(([re]) => re.test(via[1] ?? ""))?.[1];
    text = text.replace(via[0], " ").trim();
  }
  for (const [re, p] of PROTOCOLS) {
    if (!protocol && re.test(subtitle ?? "")) protocol = p;
  }
  const lead = text.match(/^(streaming|streamed|async|asynchronous|batch|batched|real-?time)\s+/i);
  if (lead) {
    const w = lead[1]!.toLowerCase();
    if (w.startsWith("stream") || w.startsWith("real")) {
      semantic = "stream";
      execution = "streaming";
    } else if (w.startsWith("async")) execution = "asynchronous";
    else execution = "batch";
    text = text.slice(lead[0].length);
  }
  for (const [re, s] of SEMANTIC_HINTS) {
    if (!semantic && re.test(`${text} ${subtitle ?? ""}`)) semantic = s;
  }

  text = text.replace(ARTICLES, "").replace(TRAILING, "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 60 || /^\d+$/.test(text)) return null;
  return {
    label: titleCase(text),
    key: normalizeKey(text),
    protocol,
    semantic,
    execution,
    subtitle,
  };
}

interface Rel {
  source: ParsedPhrase;
  target: ParsedPhrase;
  semantic: Semantic | undefined;
  direction: "forward" | "bidirectional";
  label: string | undefined;
}

const splitList = (v: string) =>
  v
    .split(/\s*(?:,|\band\b|&|\+|\/|\bplus\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

function relate(
  a: string,
  b: string,
  semantic: Semantic | undefined,
  direction: Rel["direction"],
  label?: string,
): Rel[] {
  const out: Rel[] = [];
  for (const sa of splitList(a)) {
    for (const sb of splitList(b)) {
      const source = parsePhrase(sa);
      const target = parsePhrase(sb);
      if (!source || !target || source.key === target.key) continue;
      out.push({ source, target, semantic, direction, label });
    }
  }
  return out;
}

function objectLabel(words: string | undefined): string | undefined {
  if (!words) return undefined;
  const cleaned = words
    .replace(ARTICLES, "")
    .replace(/\b(?:a|an|the|its|their|back)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned && cleaned.length <= 32 ? cleaned.toLowerCase() : undefined;
}

export function parseClause(statement: string): { rels: Rel[]; standalone: ParsedPhrase[] } {
  const s = statement.trim();
  if (!s) return { rels: [], standalone: [] };

  // Arrows: A -> B <-> C
  if (/->|<-|<->/.test(s)) {
    const parts = s.split(/\s*(<->|->|<-)\s*/);
    const rels: Rel[] = [];
    for (let i = 0; i + 2 < parts.length; i += 2) {
      const left = parts[i] ?? "";
      const op = parts[i + 1] as Op;
      const right = parts[i + 2] ?? "";
      if (op === "->") rels.push(...relate(left, right, undefined, "forward"));
      else if (op === "<-") rels.push(...relate(right, left, undefined, "forward"));
      else rels.push(...relate(left, right, "message", "bidirectional"));
    }
    return { rels, standalone: [] };
  }

  // Verbs.
  for (const rule of VERBS) {
    const m = rule.re.exec(s);
    if (!m || m.index === 0) continue;
    const left = s.slice(0, m.index).trim();
    const right = s.slice(m.index + m[0].length).trim();
    if (!left || !right) continue;
    const label = objectLabel(rule.objectGroup ? m[rule.objectGroup] : undefined) ?? rule.label;
    const rels = rule.reverse
      ? relate(right, left, rule.semantic, "forward", label)
      : relate(left, right, rule.semantic, rule.bidirectional ? "bidirectional" : "forward", label);
    if (rels.length) return { rels, standalone: [] };
  }

  // "X behind Y with A, B and C"
  let core = s;
  const rels: Rel[] = [];
  const withIdx = core.search(/\s+with\s+/i);
  let items = "";
  if (withIdx > 0) {
    items = core.slice(withIdx).replace(/^\s+with\s+/i, "");
    core = core.slice(0, withIdx);
  }
  const behind = core.split(/\s+behind\s+/i);
  const hub = behind[0] ?? core;
  if (behind.length > 1 && behind[1]) rels.push(...relate(behind[1], hub, "request", "forward"));
  if (items) {
    for (const item of splitList(items)) {
      const target = parsePhrase(item);
      const source = parsePhrase(hub);
      if (!target || !source || target.key === source.key) continue;
      const guess = guessSemantics("", item);
      const bidi = /\b(memory|tools?|mcp|cache|session)\b/i.test(item);
      rels.push({
        source,
        target,
        semantic: target.semantic ?? guess.semantic,
        direction: bidi ? "bidirectional" : "forward",
        label: undefined,
      });
    }
  }
  if (rels.length) return { rels, standalone: [] };

  // Plain component list: "components: A, B, C" or "A, B and C".
  const list = s.replace(/^[^:]{0,40}:\s*/, "");
  const standalone = splitList(list)
    .map(parsePhrase)
    .filter((p): p is ParsedPhrase => !!p && p.label.split(" ").length <= 4);
  return { rels: [], standalone: standalone.length >= 2 ? standalone : [] };
}

/**
 * A statement may chain clauses: "A sends X to B, which writes to C and publishes to D".
 * "which/that" clauses take the previous target as subject; "and/then" clauses keep the subject.
 */
export function parseStatement(statement: string): { rels: Rel[]; standalone: ParsedPhrase[] } {
  const rels: Rel[] = [];
  const standalone: ParsedPhrase[] = [];
  let subject: string | null = null;
  let lastTarget: string | null = null;
  let rest = statement.trim();
  let connector: string | null = null;

  while (rest) {
    const m = CLAUSE_SPLIT.exec(rest);
    let clause = m ? rest.slice(0, m.index) : rest;
    const nextConnector = m ? (m[1] ?? "").toLowerCase() : null;
    rest = m ? rest.slice(m.index + m[0].length) : "";

    if (STARTS_WITH_VERB.test(clause)) {
      const carry =
        connector && /^(which|that)$/.test(connector) ? lastTarget : (subject ?? lastTarget);
      if (carry) clause = `${carry} ${clause}`;
    }
    const parsed = parseClause(clause);
    rels.push(...parsed.rels);
    standalone.push(...parsed.standalone);
    if (parsed.rels.length) {
      const first = parsed.rels[0]!;
      const last = parsed.rels[parsed.rels.length - 1]!;
      // Grammatical subject = text before the first verb (independent of reversed rules).
      const verbAt = clause.search(CLAUSE_VERB);
      const grammatical = verbAt > 0 ? parsePhrase(clause.slice(0, verbAt))?.label : undefined;
      subject = grammatical ?? subject ?? first.source.label;
      const carriedInto = parsed.rels.find(
        (r) => r.source.label === subject || r.target.label === subject,
      );
      lastTarget = carriedInto
        ? carriedInto.source.label === subject
          ? carriedInto.target.label
          : carriedInto.source.label
        : last.target.label;
    }
    connector = nextConnector;
  }
  return { rels, standalone };
}

export function compileDescription(input: string): CompileResult {
  let text = input
    .replace(/\r/g, "")
    .replace(/[→⇒➜➔⟶]|-->|==>|=>|>>/g, " -> ")
    .replace(/[←⟵]|<--|<==/g, " <- ")
    .replace(/[⇄↔⟷]|<->|<=>/g, " <-> ");

  let title: string | undefined;
  const firstLine = text.split("\n")[0] ?? "";
  const colon = firstLine.indexOf(":");
  if (colon > 0 && colon < 80 && !/->|<-/.test(firstLine.slice(0, colon))) {
    title = titleCase(firstLine.slice(0, colon).replace(ARTICLES, "").trim());
    text = firstLine.slice(colon + 1) + text.slice(firstLine.length);
  }

  const statements = text
    .split(/\n|;|(?<=[a-z0-9)])\.\s+|\.$|\bafter that\b|\bfinally\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const nodes = new Map<string, Candidate["nodes"][number] & { key: string }>();
  const edges: Candidate["edges"] = [];
  const warnings: string[] = [];
  const ensure = (p: ParsedPhrase) => {
    const existing = nodes.get(p.key);
    if (existing) {
      if (!existing.subtitle && p.subtitle) existing.subtitle = p.subtitle;
      return existing.id;
    }
    const node = {
      id: p.key || `node_${nodes.size + 1}`,
      label: p.label,
      key: p.key,
      ...(p.subtitle ? { subtitle: p.subtitle } : {}),
    };
    nodes.set(p.key, node);
    return node.id;
  };

  let parsed = 0;
  for (const statement of statements) {
    const { rels, standalone } = parseStatement(statement);
    if (rels.length === 0 && standalone.length === 0) {
      if (/[A-Za-z]{3,}/.test(statement)) {
        warnings.push(
          `Could not read "${statement.slice(0, 60)}" — use arrows (A -> B) or verbs (A sends events to B).`,
        );
      }
      continue;
    }
    parsed++;
    for (const p of standalone) ensure(p);
    for (const r of rels) {
      const source = ensure(r.source);
      const target = ensure(r.target);
      const guess = guessSemantics("", `${r.label ?? ""} ${r.target.label}`);
      const semantic = r.semantic ?? r.target.semantic ?? guess.semantic;
      const executionMode =
        r.target.execution ??
        r.source.execution ??
        (semantic === "stream" ? "streaming" : semantic === "event" ? "asynchronous" : undefined);
      edges.push({
        id: `e${edges.length + 1}`,
        source_node_id: source,
        target_node_id: target,
        semantic_type: semantic,
        direction: r.direction,
        ...(r.target.protocol || r.source.protocol
          ? { protocol: r.target.protocol ?? r.source.protocol }
          : {}),
        ...(executionMode ? { execution_mode: executionMode } : {}),
        ...(r.label ? { label: r.label } : {}),
      });
    }
  }

  if (nodes.size === 0) {
    // Intent-level prompts ("agents that do a full AIDLC lifecycle") name a pattern
    // family rather than flows: instantiate the best matching reference pattern.
    const match = matchPattern(input);
    if (match) {
      const { pattern } = match;
      return {
        graph: pattern.graph,
        // The per-statement "Could not read" warnings are moot: the intent was understood.
        warnings: [
          `Built from the "${pattern.name}" reference pattern because no explicit flows were found — edit the canvas or describe flows (A -> B) to customise.`,
        ],
        title: title ?? pattern.name,
        engine: "rules",
        statements: 0,
      };
    }
    throw new Error(
      "Nothing to compile. Describe flows with arrows (web app -> gateway -> LLM) or verbs (gateway sends events to Kafka), or name a pattern (RAG, GraphRAG, agentic assistant, AIDLC / SDLC / STLC agents, microservices).",
    );
  }

  const candidate: Candidate = {
    ...(title ? { title } : {}),
    nodes: [...nodes.values()].map(({ key: _key, ...n }) => n),
    edges,
    warnings,
  };
  const result = candidateToGraph(candidate);
  return { ...result, engine: "rules", statements: parsed };
}
