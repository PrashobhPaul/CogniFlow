import { useMemo } from "react";
import type { NodeCategory } from "@/lib/studio/types";
import { EXPORT_THEMES } from "@/lib/studio/theme";
import { icon3dMarkup, shapeFor, type IconShape } from "@/lib/studio/render/icons3d";

/**
 * The same 3D medallion the exporters draw, as a React element. Accent colours
 * come from the studio export theme, which mirrors the canvas CSS exactly, so
 * canvas, palette and exports stay pixel-consistent.
 */
export function Icon3D({
  icon,
  category,
  type,
  size = 32,
  shape,
  className,
  title,
}: {
  icon: string;
  category: NodeCategory;
  type?: string | undefined;
  size?: number;
  shape?: IconShape | undefined;
  className?: string;
  title?: string;
}) {
  const html = useMemo(
    () =>
      icon3dMarkup({
        icon,
        category,
        accent:
          EXPORT_THEMES.studio.category[category] ?? EXPORT_THEMES.studio.category.application,
        shape: shape ?? shapeFor(type, category),
        size,
      }),
    [icon, category, type, size, shape],
  );
  return (
    <span
      className={className}
      title={title}
      style={{ width: size, height: size, display: "inline-block", lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
