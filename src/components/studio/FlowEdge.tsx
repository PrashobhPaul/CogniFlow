import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";
import { useStudio } from "@/lib/studio/store";
import { SEMANTIC_COLORS, type FlowEdgeData } from "@/lib/studio/types";

function Particles({
  pathId,
  count,
  dur,
  size,
  color,
  reverse,
  paused,
}: {
  pathId: string;
  count: number;
  dur: number;
  size: number;
  color: string;
  reverse?: boolean;
  paused: boolean;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <circle key={i} r={size} fill={color} className="flow-particle">
          <animateMotion
            dur={`${dur}s`}
            begin={paused ? "indefinite" : `${(-i * dur) / count}s`}
            repeatCount="indefinite"
            keyPoints={reverse ? "1;0" : "0;1"}
            keyTimes="0;1"
            calcMode="linear"
          >
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </>
  );
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const d = data as FlowEdgeData;
  const playing = useStudio((s) => s.playing);
  const speedScale = useStudio((s) => s.speedScale);
  const showLabels = useStudio((s) => s.showLabels);

  const pathType = d.pathType ?? "smoothstep";
  const [path, labelX, labelY] =
    pathType === "bezier"
      ? getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
      : pathType === "straight"
        ? getStraightPath({ sourceX, sourceY, targetX, targetY })
        : getSmoothStepPath({
            sourceX,
            sourceY,
            targetX,
            targetY,
            sourcePosition,
            targetPosition,
            borderRadius: 18,
          });

  const color = SEMANTIC_COLORS[d.semanticType];
  const pathId = `p_${id}`;
  const dur = Math.max(0.2, d.speed / speedScale);
  const active = d.enabled && playing;

  return (
    <>
      <BaseEdge
        id={pathId}
        path={path}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.4 : 1.4,
          opacity: d.enabled ? 0.55 : 0.2,
          filter: selected ? "drop-shadow(0 0 6px currentColor)" : undefined,
        }}
        markerEnd="url(#flow-arrow)"
      />
      {active && (
        <Particles
          pathId={pathId}
          count={d.density}
          dur={dur}
          size={d.size}
          color={color}
          paused={!playing}
        />
      )}
      {active && d.direction === "bidirectional" && (
        <Particles
          pathId={pathId}
          count={d.density}
          dur={dur}
          size={d.size}
          color={color}
          reverse
          paused={!playing}
        />
      )}
      {active && d.direction === "reverse" && (
        <Particles
          pathId={pathId}
          count={d.density}
          dur={dur}
          size={d.size}
          color={color}
          reverse
          paused={!playing}
        />
      )}
      {showLabels && d.label && (
        <EdgeLabelRenderer>
          <div
            className="edge-chip"
            style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, color }}
          >
            <span className="font-mono">{d.protocol}</span>
            <span className="edge-chip-sep" />
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
