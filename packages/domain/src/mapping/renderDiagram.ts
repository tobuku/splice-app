import type {
  ResolvedSplicePlan,
  DiagramModel,
  VisualNode,
  VisualEdge,
} from '../models/index.js';

/**
 * Render a ResolvedSplicePlan to a DiagramModel.
 * Pure projection from the same plan object -- no independent count math.
 * (Spec rule 9: text and graphics render from the same ResolvedSplicePlan)
 */
export function renderDiagram(plan: ResolvedSplicePlan): DiagramModel {
  const nodes: VisualNode[] = [];
  const edges: VisualEdge[] = [];
  const sourceGroupLabels = new Set<string>();
  const targetGroupLabels = new Set<string>();

  for (let i = 0; i < plan.connections.length; i++) {
    const conn = plan.connections[i]!;
    const src = conn.sourceEndpoint;
    const tgt = conn.targetEndpoint;
    const y = i * 24; // spacing per row

    const sourceNodeId = `src-${src.cableId}-${src.physicalPosition}`;
    const targetNodeId = `tgt-${tgt.cableId}-${tgt.physicalPosition}`;

    nodes.push({
      endpointId: sourceNodeId,
      label: `${src.localLabel} ${src.colorIdentity.name}`,
      colorHex: src.colorIdentity.hexValue,
      side: 'source',
      groupLabel: src.structurePath.join(' > '),
      y,
    });

    nodes.push({
      endpointId: targetNodeId,
      label: `${tgt.localLabel} ${tgt.colorIdentity.name}`,
      colorHex: tgt.colorIdentity.hexValue,
      side: 'target',
      groupLabel: tgt.structurePath.join(' > '),
      y,
    });

    edges.push({
      connectionId: conn.id,
      sourceNodeId,
      targetNodeId,
      status: conn.approvalState,
      pairStatus: conn.pairStatus,
    });

    sourceGroupLabels.add(src.structurePath.join(' > '));
    targetGroupLabels.add(tgt.structurePath.join(' > '));
  }

  // Add unassigned endpoints as nodes with no edges
  for (const src of plan.unassignedSource) {
    nodes.push({
      endpointId: `src-${src.cableId}-${src.physicalPosition}`,
      label: `${src.localLabel} ${src.colorIdentity.name} (unassigned)`,
      colorHex: src.colorIdentity.hexValue,
      side: 'source',
      groupLabel: src.structurePath.join(' > '),
      y: nodes.length * 24,
    });
  }

  for (const tgt of plan.unassignedTarget) {
    nodes.push({
      endpointId: `tgt-${tgt.cableId}-${tgt.physicalPosition}`,
      label: `${tgt.localLabel} ${tgt.colorIdentity.name} (unassigned)`,
      colorHex: tgt.colorIdentity.hexValue,
      side: 'target',
      groupLabel: tgt.structurePath.join(' > '),
      y: nodes.length * 24,
    });
  }

  // Gather group boundaries from profiles
  const sourceGroups = getGroupBoundariesSafe(plan, 'source');
  const targetGroups = getGroupBoundariesSafe(plan, 'target');

  return {
    nodes,
    edges,
    sourceGroups,
    targetGroups,
    metadata: {
      planId: plan.id,
      planHash: plan.hash,
      timestamp: new Date().toISOString(),
    },
  };
}

function getGroupBoundariesSafe(
  plan: ResolvedSplicePlan,
  _side: 'source' | 'target',
) {
  // Group boundaries derived from connections in the plan
  // This avoids re-running profile resolution (spec rule 9)
  const groups = new Map<string, { start: number; end: number }>();

  const endpoints = _side === 'source'
    ? plan.connections.map(c => c.sourceEndpoint)
    : plan.connections.map(c => c.targetEndpoint);

  for (const ep of endpoints) {
    const key = ep.structurePath.join(' > ');
    const existing = groups.get(key);
    if (existing) {
      existing.start = Math.min(existing.start, ep.physicalPosition);
      existing.end = Math.max(existing.end, ep.physicalPosition);
    } else {
      groups.set(key, { start: ep.physicalPosition, end: ep.physicalPosition });
    }
  }

  return Array.from(groups.entries()).map(([label, range]) => ({
    groupId: label,
    groupLabel: label,
    startPosition: range.start,
    endPosition: range.end,
  }));
}
