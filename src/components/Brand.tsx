import { BRAND, assetUrl } from "@/lib/brand";

/** The CogniFlow head/network mark, served from public/brand. */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={assetUrl(BRAND.assets.mark)}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`${className} select-none`}
    />
  );
}

/** Wordmark: "Cogni" in the foreground colour, "Flow" in the brand gradient. */
export function BrandWordmark({ className = "text-sm" }: { className?: string }) {
  return (
    <span className={`${className} font-semibold tracking-tight`}>
      Cogni
      <span className="brand-gradient-text">Flow</span>
    </span>
  );
}

/** Mark + wordmark lockup used in headers. */
export function BrandLogo({
  markClassName = "h-8 w-8",
  wordmarkClassName = "text-sm",
  tagline = false,
}: {
  markClassName?: string;
  wordmarkClassName?: string;
  tagline?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={BRAND.name}>
      <BrandMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <BrandWordmark className={wordmarkClassName} />
        {tagline && (
          <span className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground">
            {BRAND.tagline}
          </span>
        )}
      </span>
    </span>
  );
}
