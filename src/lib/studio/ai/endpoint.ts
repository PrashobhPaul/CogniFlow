import type { AiSettings } from "./settings";

/**
 * Browser-side client for any OpenAI-compatible chat-completions endpoint the
 * user controls. The endpoint must allow CORS from this origin (Ollama:
 * OLLAMA_ORIGINS=*, vLLM: --allowed-origins, LM Studio: enable CORS).
 */

export interface ChatMessage {
  role: "system" | "user";
  content:
    string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
}

export async function endpointChat(
  settings: AiSettings["endpoint"],
  model: string,
  messages: ChatMessage[],
  opts: { timeoutMs?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);
  opts.signal?.addEventListener("abort", () => controller.abort());
  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.1,
      max_tokens: opts.maxTokens ?? 4096,
      stream: false,
    };
    if (settings.jsonMode) body["response_format"] = { type: "json_object" };
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.apiKey.trim()) headers["Authorization"] = `Bearer ${settings.apiKey.trim()}`;
    const res = await fetch(`${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403)
      throw new Error("The endpoint rejected the API key.");
    if (res.status === 404) throw new Error(`The endpoint has no model named "${model}".`);
    if (res.status === 429)
      throw new Error("The endpoint is rate limiting requests. Try again shortly.");
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`Endpoint request failed (${res.status})${detail ? `: ${detail}` : ""}.`);
    }
    const payload = (await res.json()) as {
      choices?: { message?: { content?: string | { text?: string }[] } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map((c) => c.text ?? "").join("");
    throw new Error("The endpoint returned an empty response.");
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("The endpoint timed out.");
    if (e instanceof TypeError) {
      throw new Error(
        "Could not reach the endpoint from the browser. Check the URL and that it allows CORS from this site (e.g. OLLAMA_ORIGINS=*).",
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
