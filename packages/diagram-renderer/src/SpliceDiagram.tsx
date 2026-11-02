import type { DiagramModel } from '@splice/domain';

interface SpliceDiagramProps {
  model: DiagramModel;
  width?: number;
  rowHeight?: number;
}

const LEFT_X = 20;
const RIGHT_X_OFFSET = 400;
const COLOR_SWATCH_SIZE = 12;

/**
 * SVG splice diagram renderer.
 * Consumes a DiagramModel (derived from ResolvedSplicePlan) -- no count math here.
 * Spec rule 9: both text and graphics render from the same source.
 */
export function SpliceDiagram({
  model,
  width = 800,
  rowHeight = 24,
}: SpliceDiagramProps) {
  const totalHeight = Math.max(
    (model.edges.length + model.nodes.filter(n => !model.edges.some(
      e => e.sourceNodeId === n.endpointId || e.targetNodeId === n.endpointId
    )).length) * rowHeight + 60,
    200
  );

  const nodeMap = new Map(model.nodes.map(n => [n.endpointId, n]));

  const rightX = width - RIGHT_X_OFFSET + LEFT_X;

  return (
    <svg
      viewBox={`0 0 ${width} ${totalHeight}`}
      width="100%"
      style={{ maxWidth: width }}
      role="img"
      aria-label={`Splice diagram with ${model.edges.length} connections`}
    >
      {/* Source side header */}
      <text x={LEFT_X} y={16} fontSize={12} fontWeight="bold" fill="#333">
        Source
      </text>
      <text x={rightX} y={16} fontSize={12} fontWeight="bold" fill="#333">
        Target
      </text>

      {/* Connection lines */}
      {model.edges.map((edge, i) => {
        const src = nodeMap.get(edge.sourceNodeId);
        const tgt = nodeMap.get(edge.targetNodeId);
        if (!src || !tgt) return null;
        const y = 30 + i * rowHeight;
        const lineColor = edge.pairStatus === 'spare' ? '#999'
          : edge.pairStatus === 'bridged' ? '#f59e0b'
          : edge.status === 'blocked' ? '#ef4444'
          : '#3b82f6';

        return (
          <g key={edge.connectionId}>
            {/* Source endpoint */}
            <rect
              x={LEFT_X}
              y={y - COLOR_SWATCH_SIZE / 2}
              width={COLOR_SWATCH_SIZE}
              height={COLOR_SWATCH_SIZE}
              fill={src.colorHex}
              stroke="#333"
              strokeWidth={0.5}
            />
            <text x={LEFT_X + 16} y={y + 4} fontSize={10} fill="#333">
              {src.label}
            </text>

            {/* Connection line */}
            <line
              x1={LEFT_X + 180}
              y1={y}
              x2={rightX - 10}
              y2={y}
              stroke={lineColor}
              strokeWidth={1}
              strokeDasharray={edge.pairStatus === 'spare' ? '4 2' : undefined}
            />

            {/* Target endpoint */}
            <rect
              x={rightX}
              y={y - COLOR_SWATCH_SIZE / 2}
              width={COLOR_SWATCH_SIZE}
              height={COLOR_SWATCH_SIZE}
              fill={tgt.colorHex}
              stroke="#333"
              strokeWidth={0.5}
            />
            <text x={rightX + 16} y={y + 4} fontSize={10} fill="#333">
              {tgt.label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${LEFT_X}, ${totalHeight - 40})`}>
        <text fontSize={9} fill="#666">
          Plan: {model.metadata.planId} | Hash: {model.metadata.planHash} | {model.metadata.timestamp}
        </text>
      </g>
    </svg>
  );
}
