import { useMemo } from "react";
import { entitlementsFor, type Entitlements } from "./entitlements";
import { useAiSettings, aiStatusFor } from "./ai/settings";

/** Everything is included in the open-source build; AI status follows the chosen engine. */
export function useEntitlements(): { entitlements: Entitlements; loading: boolean } {
  const settings = useAiSettings();
  const entitlements = useMemo(() => entitlementsFor(aiStatusFor(settings)), [settings]);
  return { entitlements, loading: false };
}
