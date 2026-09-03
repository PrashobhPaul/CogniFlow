/**
 * CogniFlow is fully open source: there is no paid tier and nothing is
 * gated. This module keeps the same shape the studio components consume so
 * every export and AI feature is simply "on", with generous browser-safe
 * limits. The AI status reflects which engine the user picked in Settings
 * (in-browser open-weight model, or their own OpenAI-compatible endpoint).
 */

export type Plan = "open";

export interface AiStatus {
  configured: boolean;
  provider: string | null;
  textModel: string | null;
  visionModel: string | null;
  openSource: boolean;
}

export interface Entitlements {
  plan: Plan;
  label: string;
  features: {
    staticExports: boolean;
    animatedSvg: boolean;
    gif: boolean;
    video: boolean;
    pptx: boolean;
    aiCompile: boolean;
    imageReconstruction: boolean;
  };
  limits: {
    maxLoopSeconds: number;
    maxVideoSeconds: number;
    maxScale: number;
    maxFps: number;
  };
  ai: AiStatus;
}

export function entitlementsFor(ai: AiStatus): Entitlements {
  return {
    plan: "open",
    label: "open source · everything included",
    features: {
      staticExports: true,
      animatedSvg: true,
      gif: true,
      video: true,
      pptx: true,
      aiCompile: ai.configured,
      imageReconstruction: ai.configured && !!ai.visionModel,
    },
    limits: {
      maxLoopSeconds: 20,
      maxVideoSeconds: 30,
      maxScale: 3,
      maxFps: 50,
    },
    ai,
  };
}
