import { useMemo } from "react";
import type { NodeCategory } from "@/lib/studio/types";
import { EXPORT_THEMES } from "@/lib/studio/theme";
import {
  NODE_MOTION_PERIOD,
  nodeOverlayMarkup,
  statusColor,
  type NodeMotion,
  type ResolvedStatus,
} from "@/lib/studio/render/motion";

/**
 * Component motion + status badge drawn over an Icon3D. The markup is the
 * same string the SVG exporter emits, so what animates on the canvas is what
 * animates in the file.
 */
export function NodeOverlay({
  motion,
  status,
  category,
  size = 32,
  playing = true,
  speedScale = 1,
  badge = true,
  className,
}: {
  motion: NodeMotion;
  status: ResolvedStatus;
  category: NodeCategory;
  size?: number;
  playing?: boolean;
  speedScale?: number;
  badge?: boolean;
  className?: string;
}) {
  const html = useMemo(() => {
    const theme = EXPORT_THEMES.studio;
    const accent = theme.category[category] ?? theme.category.application;
    return nodeOverlayMarkup({
      motion,
      status,
      accent,
      statusColor: statusColor(status, theme, accent),
      bg: theme.card,
      size,
      period: NODE_MOTION_PERIOD[motion] / Math.max(0.1, speedScale),
      animated: playing,
      badge,
    });
  }, [motion, status, category, size, playing, speedScale, badge]);
  return (
    <span
      className={`arch-node-overlay ${className ?? ""}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
