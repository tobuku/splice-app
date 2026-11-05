import { useState, useRef, useCallback, useMemo } from 'react';
import type { DiagramModel, VisualEdge } from '@splice/domain';

interface InteractiveDiagramProps {
  model: DiagramModel;
  width?: number;
  rowHeight?: number;
  onConnectionClick?: (connectionId: string) => void;
}

const LEFT_X = 20;
const LABEL_WIDTH = 200;
const LINE_GAP = 20;
const COLOR_SWATCH = 14;

/**
 * Interactive splice diagram with zoom, pan, search, group collapse, and filtering.
 * Same data source as text schedule (spec rule 9).
 */
export function InteractiveSpliceDiagram({
  model,
  width = 900,
  rowHeight = 26,
  onConnectionClick,
}: InteractiveDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panY, setPanY] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);

  const nodeMap = useMemo(
    () => new Map(model.nodes.map(n => [n.endpointId, n])),
    [model.nodes]
  );

  // Build group membership for collapsing
  const sourceGroupMap = useMemo(() => {
    const map = new Map<string, string>(); // endpointId -> groupId
    for (const g of model.sourceGroups) {
      for (const node of model.nodes) {
        if (node.side === 'source' && node.groupLabel === g.groupLabel) {
          map.set(node.endpointId, g.groupId);
        }
      }
    }
    return map;
  }, [model]);

  // Filter and search
  const visibleEdges = useMemo(() => {
    let edges = model.edges;

    if (filterStatus) {
      edges = edges.filter(e =>
        filterStatus === 'flagged' ? e.pairStatus === 'spare' || e.pairStatus === 'bridged'
        : e.status === filterStatus || e.pairStatus === filterStatus
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      edges = edges.filter(e => {
        const src = nodeMap.get(e.sourceNodeId);
        const tgt = nodeMap.get(e.targetNodeId);
        return (
          src?.label.toLowerCase().includes(term) ||
          tgt?.label.toLowerCase().includes(term) ||
          e.connectionId.toLowerCase().includes(term)
        );
      });
    }

    // Collapse: hide edges whose source group is collapsed (show summary row instead)
    if (collapsedGroups.size > 0) {
      edges = edges.filter(e => {
        const groupId = sourceGroupMap.get(e.sourceNodeId);
        return !groupId || !collapsedGroups.has(groupId);
      });
    }

    return edges;
  }, [model.edges, filterStatus, searchTerm, collapsedGroups, nodeMap, sourceGroupMap]);

  // Collapsed group summary rows
  const collapsedGroupSummaries = useMemo(() => {
    if (collapsedGroups.size === 0) return [];
    return model.sourceGroups
      .filter(g => collapsedGroups.has(g.groupId))
      .map(g => {
        const count = model.edges.filter(e => sourceGroupMap.get(e.sourceNodeId) === g.groupId).length;
        return { ...g, connectionCount: count };
      });
  }, [collapsedGroups, model.sourceGroups, model.edges, sourceGroupMap]);

  const totalRows = visibleEdges.length + collapsedGroupSummaries.length;
  const contentHeight = Math.max(totalRows * rowHeight + 80, 200);
  const rightX = width - LABEL_WIDTH - LINE_GAP;

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.max(0.3, Math.min(3, z + delta)));
    } else {
      setPanY(p => Math.max(-(contentHeight * zoom - 400), Math.min(0, p - e.deltaY)));
    }
  }, [contentHeight, zoom]);

  // Touch/mouse pan
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStartY(e.clientY - panY);
  }, [panY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const newY = e.clientY - dragStartY;
    setPanY(Math.max(-(contentHeight * zoom - 400), Math.min(0, newY)));
  }, [isDragging, dragStartY, contentHeight, zoom]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  function toggleGroup(groupId: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  function getLineColor(edge: VisualEdge): string {
    if (highlightedId === edge.connectionId) return '#8b5cf6';
    if (edge.pairStatus === 'spare') return '#9ca3af';
    if (edge.pairStatus === 'bridged') return '#f59e0b';
    if (edge.status === 'blocked') return '#ef4444';
    return '#3b82f6';
  }

  // SVG export
  function exportSVG() {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `splice-diagram-${model.metadata.planId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  let yOffset = 0;

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          className="input-field flex-1 min-w-[120px] text-sm"
          placeholder="Search pairs/fibers..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select
          className="select-field text-sm w-auto"
          value={filterStatus || ''}
          onChange={e => setFilterStatus(e.target.value || null)}
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="verified">Verified</option>
          <option value="blocked">Blocked</option>
          <option value="spare">Spare</option>
          <option value="working">Working</option>
          <option value="flagged">Flagged</option>
        </select>
        <div className="flex gap-1">
          <button
            className="btn-secondary px-2 py-1 text-sm"
            onClick={() => setZoom(z => Math.min(3, z + 0.2))}
            title="Zoom in"
          >+</button>
          <button
            className="btn-secondary px-2 py-1 text-sm"
            onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
            title="Zoom out"
          >-</button>
          <button
            className="btn-secondary px-2 py-1 text-sm"
            onClick={() => { setZoom(1); setPanY(0); }}
            title="Reset view"
          >Fit</button>
        </div>
        <button className="btn-secondary px-2 py-1 text-sm" onClick={exportSVG}>
          Export SVG
        </button>
      </div>

      {/* Group collapse toggles */}
      {model.sourceGroups.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {model.sourceGroups.map(g => (
            <button
              key={g.groupId}
              className={`text-xs px-2 py-1 rounded touch-manipulation ${
                collapsedGroups.has(g.groupId)
                  ? 'bg-slate-300 text-slate-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => toggleGroup(g.groupId)}
            >
              {g.groupLabel} ({g.endPosition - g.startPosition + 1})
              {collapsedGroups.has(g.groupId) ? ' [+]' : ' [-]'}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="text-xs text-slate-500">
        Showing {visibleEdges.length} of {model.edges.length} connections
        {collapsedGroups.size > 0 && ` (${collapsedGroups.size} groups collapsed)`}
      </div>

      {/* Diagram viewport */}
      <div
        className="overflow-hidden border border-slate-200 rounded-lg bg-white"
        style={{ height: Math.min(contentHeight * zoom + 20, 600), touchAction: 'none' }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg
          ref={svgRef}
          viewBox={`0 ${-panY / zoom} ${width} ${Math.min(contentHeight, 600 / zoom)}`}
          width="100%"
          style={{ maxWidth: width, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          role="img"
          aria-label={`Interactive splice diagram: ${visibleEdges.length} connections`}
        >
          {/* Headers */}
          <text x={LEFT_X} y={16} fontSize={11} fontWeight="bold" fill="#334155">Source</text>
          <text x={rightX} y={16} fontSize={11} fontWeight="bold" fill="#334155">Target</text>
          <line x1={0} y1={22} x2={width} y2={22} stroke="#e2e8f0" strokeWidth={1} />

          {/* Collapsed group summaries */}
          {collapsedGroupSummaries.map(g => {
            const y = 36 + yOffset * rowHeight;
            yOffset++;
            return (
              <g key={`collapsed-${g.groupId}`} opacity={0.6}>
                <rect x={LEFT_X} y={y - 8} width={width - LEFT_X * 2} height={rowHeight - 2}
                  fill="#f1f5f9" rx={3} />
                <text x={LEFT_X + 8} y={y + 4} fontSize={10} fill="#64748b" fontWeight="bold">
                  {g.groupLabel}: {g.connectionCount} connections (collapsed)
                </text>
              </g>
            );
          })}

          {/* Connection rows */}
          {visibleEdges.map((edge) => {
            const src = nodeMap.get(edge.sourceNodeId);
            const tgt = nodeMap.get(edge.targetNodeId);
            if (!src || !tgt) return null;

            const y = 36 + yOffset * rowHeight;
            yOffset++;
            const isHighlighted = highlightedId === edge.connectionId;
            const lineColor = getLineColor(edge);

            return (
              <g
                key={edge.connectionId}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setHighlightedId(prev => prev === edge.connectionId ? null : edge.connectionId);
                  onConnectionClick?.(edge.connectionId);
                }}
              >
                {/* Highlight background */}
                {isHighlighted && (
                  <rect x={0} y={y - rowHeight / 2} width={width} height={rowHeight}
                    fill="#ede9fe" opacity={0.5} />
                )}

                {/* Source swatch + label */}
                <rect
                  x={LEFT_X}
                  y={y - COLOR_SWATCH / 2}
                  width={COLOR_SWATCH}
                  height={COLOR_SWATCH}
                  fill={src.colorHex}
                  stroke="#475569"
                  strokeWidth={0.5}
                  rx={2}
                />
                <text x={LEFT_X + COLOR_SWATCH + 4} y={y + 4} fontSize={10} fill="#1e293b">
                  {src.label}
                </text>

                {/* Connection line */}
                <line
                  x1={LEFT_X + LABEL_WIDTH}
                  y1={y}
                  x2={rightX - COLOR_SWATCH - 4}
                  y2={y}
                  stroke={lineColor}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={edge.pairStatus === 'spare' ? '4 2' : undefined}
                  markerEnd={isHighlighted ? undefined : undefined}
                />

                {/* Pair status indicator */}
                {edge.pairStatus && (
                  <text
                    x={(LEFT_X + LABEL_WIDTH + rightX - COLOR_SWATCH - 4) / 2}
                    y={y - 4}
                    fontSize={8}
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {edge.pairStatus}
                  </text>
                )}

                {/* Target swatch + label */}
                <rect
                  x={rightX - COLOR_SWATCH}
                  y={y - COLOR_SWATCH / 2}
                  width={COLOR_SWATCH}
                  height={COLOR_SWATCH}
                  fill={tgt.colorHex}
                  stroke="#475569"
                  strokeWidth={0.5}
                  rx={2}
                />
                <text x={rightX + 4} y={y + 4} fontSize={10} fill="#1e293b">
                  {tgt.label}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${LEFT_X}, ${36 + yOffset * rowHeight + 10})`}>
            <text fontSize={9} fill="#94a3b8">
              Plan: {model.metadata.planId} | Hash: {model.metadata.planHash} | {model.metadata.timestamp}
            </text>
            {/* Color legend */}
            <g transform="translate(0, 14)">
              <rect x={0} y={0} width={10} height={10} fill="#3b82f6" rx={1} />
              <text x={14} y={8} fontSize={8} fill="#64748b">Connected</text>
              <rect x={80} y={0} width={10} height={10} fill="#9ca3af" rx={1} />
              <text x={94} y={8} fontSize={8} fill="#64748b">Spare</text>
              <rect x={140} y={0} width={10} height={10} fill="#f59e0b" rx={1} />
              <text x={154} y={8} fontSize={8} fill="#64748b">Bridged</text>
              <rect x={210} y={0} width={10} height={10} fill="#ef4444" rx={1} />
              <text x={224} y={8} fontSize={8} fill="#64748b">Blocked</text>
              <rect x={290} y={0} width={10} height={10} fill="#8b5cf6" rx={1} />
              <text x={304} y={8} fontSize={8} fill="#64748b">Selected</text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
