/**
 * Single source of truth for product branding. Import from here instead of
 * hard-coding the name so a future rename is a one-file change.
 */
export const BRAND = {
  name: "CogniFlow",
  tagline: "Animated Architecture for AI",
  description:
    "Free, open-source studio for animated software architecture diagrams: design components, watch real data flow move between them, export GIF, video and slides — all in the browser.",
  author: "Prashobh Paul",
  repoUrl: "https://github.com/PrashobhPaul/CogniFlow",
  repoLabel: "github.com/PrashobhPaul/CogniFlow",
  siteUrl: "https://cogniflow.prashobhpaul.com",
  /** Static assets under public/brand, resolved against Vite's base path. */
  assets: {
    mark: "brand/cogniflow-mark.svg",
    logo: "brand/cogniflow-logo.svg",
    ogImage: "brand/og-image.png",
  },
} as const;

/** Page title in the shared "<page> — CogniFlow" shape. */
export function pageTitle(page?: string): string {
  return page ? `${page} — ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`;
}

/** Absolute URL for a public asset, honouring the GitHub Pages base path. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path}`;
}
