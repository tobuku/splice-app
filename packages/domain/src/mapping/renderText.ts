import type { ResolvedSplicePlan, Connection } from '../models/index.js';

export interface SpliceScheduleRow {
  connectionId: string;
  sourceSheath: string;
  sourcePosition: number;
  sourceLabel: string;
  sourceGroup: string;
  sourceColor: string;
  sourceTip?: string;
  sourceRing?: string;
  targetSheath: string;
  targetPosition: number;
  targetLabel: string;
  targetGroup: string;
  targetColor: string;
  targetTip?: string;
  targetRing?: string;
  status: string;
  pairStatus?: string;
}

export interface SpliceSchedule {
  planId: string;
  planHash: string;
  rows: SpliceScheduleRow[];
  unassignedSourceCount: number;
  unassignedTargetCount: number;
  issueCount: number;
  timestamp: string;
}

function connectionToRow(conn: Connection): SpliceScheduleRow {
  const src = conn.sourceEndpoint;
  const tgt = conn.targetEndpoint;
  return {
    connectionId: conn.id,
    sourceSheath: src.cableId,
    sourcePosition: src.physicalPosition,
    sourceLabel: src.localLabel,
    sourceGroup: src.structurePath.join(' > '),
    sourceColor: src.colorIdentity.name,
    sourceTip: src.tipRing?.tip.name,
    sourceRing: src.tipRing?.ring.name,
    targetSheath: tgt.cableId,
    targetPosition: tgt.physicalPosition,
    targetLabel: tgt.localLabel,
    targetGroup: tgt.structurePath.join(' > '),
    targetColor: tgt.colorIdentity.name,
    targetTip: tgt.tipRing?.tip.name,
    targetRing: tgt.tipRing?.ring.name,
    status: conn.approvalState,
    pairStatus: conn.pairStatus,
  };
}

/**
 * Render a ResolvedSplicePlan to a text schedule.
 * This is a pure projection -- no count math, just formatting.
 */
export function renderText(plan: ResolvedSplicePlan): SpliceSchedule {
  return {
    planId: plan.id,
    planHash: plan.hash,
    rows: plan.connections.map(connectionToRow),
    unassignedSourceCount: plan.unassignedSource.length,
    unassignedTargetCount: plan.unassignedTarget.length,
    issueCount: plan.issues.length,
    timestamp: new Date().toISOString(),
  };
}
