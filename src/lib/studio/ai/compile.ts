import { candidateSchema, type Candidate } from "../candidate";
import { endpointChat, type ChatMessage } from "./endpoint";
import { generateLocal } from "./local";
import { DSL_SYSTEM_PROMPT, extractJson, parseDsl, SYSTEM_PROMPT, userPrompt } from "./prompts";
import { getAiSettings, type AiSettings } from "./settings";

/**
 * Engine-agnostic AI compilation: description, image, or image + instructions
 * → candidate graph. Uses the engine chosen in Settings. Both engines are
 * open: the in-browser model never sends data anywhere; the endpoint engine
 * talks only to the host the user configured.
 */

export interface ModelCompileInput {
  prompt?: string | undefined;
  imageDataUrl?: string | undefined;
  filename?: string | undefined;
  signal?: AbortSignal | undefined;
}

export interface ModelCompileResult {
  candidate: Candidate;
  provider: string;
  model: string;
  open_source: boolean;
  engine: AiSettings["engine"];
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function parseCandidate(
  raw: string,
  provider: string,
  model: string,
  engine: AiSettings["engine"],
): ModelCompileResult {
  const parsed = candidateSchema.parse(extractJson(raw));
  return {
    candidate: {
      ...parsed,
      warnings: [
        ...parsed.warnings,
        `Proposed by ${provider} (${model}). Verify every component and connector before animating.`,
      ],
    },
    provider,
    model,
    open_source: true,
    engine,
  };
}

export async function compileWithAi(input: ModelCompileInput): Promise<ModelCompileResult> {
  const instructions = input.prompt?.trim();
  const hasImage = !!input.imageDataUrl;
  if (!instructions && !hasImage) throw new Error("Provide a description, an image, or both.");
  if (hasImage) {
    const approxBytes = Math.floor(
      (input.imageDataUrl!.length - input.imageDataUrl!.indexOf(",") - 1) * 0.75,
    );
    if (approxBytes > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 8 MB limit.");
  }
  const settings = getAiSettings();
  const user = userPrompt(instructions, hasImage, input.filename);

  if (settings.engine === "endpoint") {
    const ep = settings.endpoint;
    if (!ep.baseUrl.trim()) throw new Error("Set the endpoint URL in Settings first.");
    const model = hasImage ? ep.visionModel.trim() : ep.textModel.trim();
    if (!model)
      throw new Error(
        hasImage
          ? "Set a vision model for the endpoint in Settings."
          : "Set a text model for the endpoint in Settings.",
      );
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      hasImage
        ? {
            role: "user",
            content: [
              { type: "text", text: user },
              { type: "image_url", image_url: { url: input.imageDataUrl! } },
            ],
          }
        : { role: "user", content: user },
    ];
    const chatOpts = input.signal ? { signal: input.signal } : {};
    let raw = await endpointChat(ep, model, messages, chatOpts);
    try {
      return parseCandidate(raw, hostOf(ep.baseUrl), model, "endpoint");
    } catch {
      raw = await endpointChat(
        ep,
        model,
        [
          ...messages,
          {
            role: "user",
            content: `Your previous reply was not valid JSON. Reply again with ONLY the JSON object.\n\nPrevious reply:\n${raw.slice(0, 4000)}`,
          },
        ],
        chatOpts,
      );
      return parseCandidate(raw, hostOf(ep.baseUrl), model, "endpoint");
    }
  }

  // In-browser open-weight model.
  const modelId = hasImage ? settings.visionModel : settings.textModel;
  if (!modelId)
    throw new Error(
      hasImage ? "No in-browser vision model configured." : "No in-browser text model configured.",
    );
  const raw = await generateLocal({
    kind: hasImage ? "vision" : "text",
    modelId,
    // Text uses the compact arrow DSL (about half the output tokens of JSON,
    // parseable line by line); vision keeps the JSON schema with a bigger budget.
    system: hasImage ? SYSTEM_PROMPT : DSL_SYSTEM_PROMPT,
    user,
    ...(input.imageDataUrl ? { imageDataUrl: input.imageDataUrl } : {}),
    maxNewTokens: hasImage ? 1536 : 1024,
    ...(input.signal ? { signal: input.signal } : {}),
  });
  try {
    if (!hasImage) {
      // DSL first; some models emit JSON regardless, so fall through to it.
      try {
        const parsed = candidateSchema.parse(parseDsl(raw));
        return {
          candidate: {
            ...parsed,
            warnings: [
              ...parsed.warnings,
              `Proposed by in-browser · Transformers.js (${modelId}). Verify every component and connector before animating.`,
            ],
          },
          provider: "in-browser · Transformers.js",
          model: modelId,
          open_source: true,
          engine: "local",
        };
      } catch {
        /* fall through to JSON extraction */
      }
    }
    return parseCandidate(raw, "in-browser · Transformers.js", modelId, "local");
  } catch (e) {
    throw new Error(
      `${e instanceof Error ? e.message : "Unreadable model output."} Small in-browser models occasionally drift off-schema — retry, simplify the description, or switch to the rule-based engine.`,
    );
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "custom endpoint";
  }
}
