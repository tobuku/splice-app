import type {
  Cable,
  CableEnd,
  Connection,
  CrosswalkTable,
  EndpointIdentity,
  ExposedRange,
  ResolvedEndpoint,
  ResolvedSplicePlan,
  SpliceOperationType,
  ValidationIssue,
} from '../models/index.js';
import type { CableContext } from '../profiles/registry.js';
import { resolveRange } from './resolveEndpoint.js';
import { normalizePhysicalPosition } from './normalizePosition.js';
import { getProfileOrThrow } from '../profiles/registry.js';

// ── Inputs ──

export interface SplicePlanInput {
  spliceCaseId: string;
  operationType: SpliceOperationType;
  cables: Cable[];
  cableEnds: CableEnd[];
  crosswalk?: CrosswalkTable;
  exposedSubset?: ExposedRange;
  pairStatuses?: Map<number, 'working' | 'spare' | 'bridged' | 'reserved'>;
}

// ── Helpers ──

function makeCableContext(cable: Cable, segmentId: string): CableContext {
  return {
    cableId: cable.id,
    segmentId,
    sheathId: cable.sheathId,
    nominalCount: cable.nominalCount,
    orientation: cable.orientation,
    construction: cable.construction,
  };
}

function generateConnectionId(sourcePos: number, targetPos: number, caseId: string): string {
  return `${caseId}-${sourcePos}-${targetPos}`;
}

function hashPlan(connections: Connection[]): string {
  // Simple deterministic hash from connection IDs
  const data = connections.map(c => c.id).sort().join('|');
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ── Resolve endpoints for a cable end ──

function resolveEndpoints(
  cable: Cable,
  cableEnd: CableEnd,
): { endpoints: ResolvedEndpoint[]; errors: ValidationIssue[] } {
  const context = makeCableContext(cable, cableEnd.segmentId ?? 'default');
  const profile = getProfileOrThrow(cable.countProfileId, cable.countProfileVersion);

  // Normalize positions based on orientation
  const startPos = normalizePhysicalPosition(
    cableEnd.rangeStart, profile.totalCapacity(context), cable.orientation
  );
  const endPos = normalizePhysicalPosition(
    cableEnd.rangeEnd, profile.totalCapacity(context), cable.orientation
  );

  const actualStart = Math.min(startPos, endPos);
  const actualEnd = Math.max(startPos, endPos);

  const result = resolveRange(
    cable.countProfileId,
    cable.countProfileVersion,
    actualStart,
    actualEnd,
    context,
  );
  return { endpoints: result.resolved, errors: result.errors };
}

// ── Straight Splice ──

function buildStraightSplice(
  input: SplicePlanInput,
  sourceCable: Cable,
  targetCable: Cable,
  sourceEnd: CableEnd,
  targetEnd: CableEnd,
): { connections: Connection[]; unassignedSource: EndpointIdentity[]; unassignedTarget: EndpointIdentity[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  const sourceResult = resolveEndpoints(sourceCable, sourceEnd);
  const targetResult = resolveEndpoints(targetCable, targetEnd);
  issues.push(...sourceResult.errors, ...targetResult.errors);

  const connections: Connection[] = [];
  const paired = Math.min(sourceResult.endpoints.length, targetResult.endpoints.length);

  for (let i = 0; i < paired; i++) {
    connections.push({
      id: generateConnectionId(
        sourceResult.endpoints[i]!.identity.physicalPosition,
        targetResult.endpoints[i]!.identity.physicalPosition,
        input.spliceCaseId,
      ),
      sourceEndpoint: sourceResult.endpoints[i]!.identity,
      targetEndpoint: targetResult.endpoints[i]!.identity,
      operationType: 'straight',
      approvalState: 'draft',
    });
  }

  const unassignedSource = sourceResult.endpoints.slice(paired).map(e => e.identity);
  const unassignedTarget = targetResult.endpoints.slice(paired).map(e => e.identity);

  if (sourceResult.endpoints.length !== targetResult.endpoints.length) {
    issues.push({
      severity: 'warning',
      code: 'CAPACITY_MISMATCH',
      message: `Source has ${sourceResult.endpoints.length} endpoints, target has ${targetResult.endpoints.length}. ${unassignedSource.length + unassignedTarget.length} endpoint(s) unassigned.`,
    });
  }

  return { connections, unassignedSource, unassignedTarget, issues };
}

// ── Remap Splice ──

function buildRemapSplice(
  input: SplicePlanInput,
  sourceCable: Cable,
  targetCable: Cable,
  sourceEnd: CableEnd,
  targetEnd: CableEnd,
): { connections: Connection[]; unassignedSource: EndpointIdentity[]; unassignedTarget: EndpointIdentity[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!input.crosswalk) {
    issues.push({
      severity: 'error',
      code: 'MISSING_CROSSWALK',
      message: 'Remap operation requires an explicit crosswalk table. Cannot proceed without verified position mapping.',
    });
    const sourceResult = resolveEndpoints(sourceCable, sourceEnd);
    const targetResult = resolveEndpoints(targetCable, targetEnd);
    return {
      connections: [],
      unassignedSource: sourceResult.endpoints.map(e => e.identity),
      unassignedTarget: targetResult.endpoints.map(e => e.identity),
      issues: [...issues, ...sourceResult.errors, ...targetResult.errors],
    };
  }

  const sourceResult = resolveEndpoints(sourceCable, sourceEnd);
  const targetResult = resolveEndpoints(targetCable, targetEnd);
  issues.push(...sourceResult.errors, ...targetResult.errors);

  const sourceMap = new Map(sourceResult.endpoints.map(e => [e.identity.physicalPosition, e]));
  const targetMap = new Map(targetResult.endpoints.map(e => [e.identity.physicalPosition, e]));

  const connections: Connection[] = [];
  const usedSources = new Set<number>();
  const usedTargets = new Set<number>();

  for (const entry of input.crosswalk.entries) {
    const source = sourceMap.get(entry.sourcePosition);
    const target = targetMap.get(entry.targetPosition);

    if (!source) {
      issues.push({
        severity: 'error',
        code: 'CROSSWALK_SOURCE_NOT_FOUND',
        message: `Crosswalk references source position ${entry.sourcePosition} which is not in the resolved range`,
        position: entry.sourcePosition,
      });
      continue;
    }
    if (!target) {
      issues.push({
        severity: 'error',
        code: 'CROSSWALK_TARGET_NOT_FOUND',
        message: `Crosswalk references target position ${entry.targetPosition} which is not in the resolved range`,
        position: entry.targetPosition,
      });
      continue;
    }

    if (usedTargets.has(entry.targetPosition)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_TARGET',
        message: `Target position ${entry.targetPosition} is assigned more than once in the crosswalk`,
        position: entry.targetPosition,
      });
      continue;
    }

    usedSources.add(entry.sourcePosition);
    usedTargets.add(entry.targetPosition);

    connections.push({
      id: generateConnectionId(entry.sourcePosition, entry.targetPosition, input.spliceCaseId),
      sourceEndpoint: source.identity,
      targetEndpoint: target.identity,
      operationType: 'remap',
      approvalState: entry.verified ? 'draft' : 'needs-verification',
    });
  }

  const unassignedSource = sourceResult.endpoints
    .filter(e => !usedSources.has(e.identity.physicalPosition))
    .map(e => e.identity);
  const unassignedTarget = targetResult.endpoints
    .filter(e => !usedTargets.has(e.identity.physicalPosition))
    .map(e => e.identity);

  return { connections, unassignedSource, unassignedTarget, issues };
}

// ── Branch Splice ──

function buildBranchSplice(
  input: SplicePlanInput,
  cables: Cable[],
  cableEnds: CableEnd[],
): { connections: Connection[]; unassignedSource: EndpointIdentity[]; unassignedTarget: EndpointIdentity[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  const feederEnd = cableEnds.find(e => e.role === 'feeder');
  const distEnds = cableEnds.filter(e => e.role === 'distribution');

  if (!feederEnd) {
    issues.push({ severity: 'error', code: 'NO_FEEDER', message: 'Branch splice requires a feeder cable end' });
    return { connections: [], unassignedSource: [], unassignedTarget: [], issues };
  }
  if (distEnds.length === 0) {
    issues.push({ severity: 'error', code: 'NO_DISTRIBUTION', message: 'Branch splice requires at least one distribution cable end' });
    return { connections: [], unassignedSource: [], unassignedTarget: [], issues };
  }

  const feederCable = cables.find(c => c.id === feederEnd.cableId);
  if (!feederCable) {
    issues.push({ severity: 'error', code: 'CABLE_NOT_FOUND', message: `Feeder cable ${feederEnd.cableId} not found` });
    return { connections: [], unassignedSource: [], unassignedTarget: [], issues };
  }

  const feederResult = resolveEndpoints(feederCable, feederEnd);
  issues.push(...feederResult.errors);

  const connections: Connection[] = [];
  let feederIndex = 0;
  const allUnassignedTarget: EndpointIdentity[] = [];

  for (const distEnd of distEnds) {
    const distCable = cables.find(c => c.id === distEnd.cableId);
    if (!distCable) {
      issues.push({ severity: 'error', code: 'CABLE_NOT_FOUND', message: `Distribution cable ${distEnd.cableId} not found` });
      continue;
    }

    const distResult = resolveEndpoints(distCable, distEnd);
    issues.push(...distResult.errors);

    for (const distEndpoint of distResult.endpoints) {
      if (feederIndex < feederResult.endpoints.length) {
        connections.push({
          id: generateConnectionId(
            feederResult.endpoints[feederIndex]!.identity.physicalPosition,
            distEndpoint.identity.physicalPosition,
            input.spliceCaseId,
          ),
          sourceEndpoint: feederResult.endpoints[feederIndex]!.identity,
          targetEndpoint: distEndpoint.identity,
          operationType: 'branch',
          approvalState: 'draft',
        });
        feederIndex++;
      } else {
        allUnassignedTarget.push(distEndpoint.identity);
      }
    }
  }

  const unassignedSource = feederResult.endpoints.slice(feederIndex).map(e => e.identity);

  if (unassignedSource.length > 0 || allUnassignedTarget.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'CAPACITY_MISMATCH',
      message: `Branch: ${unassignedSource.length} feeder endpoint(s) and ${allUnassignedTarget.length} distribution endpoint(s) unassigned.`,
    });
  }

  return { connections, unassignedSource, unassignedTarget: allUnassignedTarget, issues };
}

// ── Mid-Span Splice ──

function buildMidSpanSplice(
  input: SplicePlanInput,
  cables: Cable[],
  cableEnds: CableEnd[],
): { connections: Connection[]; unassignedSource: EndpointIdentity[]; unassignedTarget: EndpointIdentity[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!input.exposedSubset) {
    issues.push({
      severity: 'error',
      code: 'MISSING_EXPOSED_SUBSET',
      message: 'Mid-span operation requires an exposed subset definition (which tubes/binders are physically accessible)',
    });
    return { connections: [], unassignedSource: [], unassignedTarget: [], issues };
  }

  // Mid-span: only a subset of the cable is exposed. Filter endpoints to exposed range.
  const sourceEnd = cableEnds[0];
  const targetEnd = cableEnds[1];
  if (!sourceEnd || !targetEnd) {
    issues.push({ severity: 'error', code: 'INSUFFICIENT_ENDS', message: 'Mid-span requires at least two cable ends' });
    return { connections: [], unassignedSource: [], unassignedTarget: [], issues };
  }

  const sourceCable = cables.find(c => c.id === sourceEnd.cableId);
  const targetCable = cables.find(c => c.id === targetEnd.cableId);
  if (!sourceCable || !targetCable) {
    issues.push({ severity: 'error', code: 'CABLE_NOT_FOUND', message: 'One or more cables not found' });
    return { connections: [], unassignedSource: [], unassignedTarget: [], issues };
  }

  // Resolve only the exposed subset
  const exposedStart = input.exposedSubset.startPosition;
  const exposedEnd = input.exposedSubset.endPosition;

  const sourceResult = resolveEndpoints(sourceCable, {
    ...sourceEnd,
    rangeStart: Math.max(sourceEnd.rangeStart, exposedStart),
    rangeEnd: Math.min(sourceEnd.rangeEnd, exposedEnd),
  });
  const targetResult = resolveEndpoints(targetCable, targetEnd);
  issues.push(...sourceResult.errors, ...targetResult.errors);

  const connections: Connection[] = [];
  const paired = Math.min(sourceResult.endpoints.length, targetResult.endpoints.length);

  for (let i = 0; i < paired; i++) {
    connections.push({
      id: generateConnectionId(
        sourceResult.endpoints[i]!.identity.physicalPosition,
        targetResult.endpoints[i]!.identity.physicalPosition,
        input.spliceCaseId,
      ),
      sourceEndpoint: sourceResult.endpoints[i]!.identity,
      targetEndpoint: targetResult.endpoints[i]!.identity,
      operationType: 'mid-span',
      approvalState: 'draft',
    });
  }

  const unassignedSource = sourceResult.endpoints.slice(paired).map(e => e.identity);
  const unassignedTarget = targetResult.endpoints.slice(paired).map(e => e.identity);

  return { connections, unassignedSource, unassignedTarget, issues };
}

// ── Bridge Tap / Spare Reserve ──

function buildBridgeTapSplice(
  input: SplicePlanInput,
  sourceCable: Cable,
  targetCable: Cable,
  sourceEnd: CableEnd,
  targetEnd: CableEnd,
): { connections: Connection[]; unassignedSource: EndpointIdentity[]; unassignedTarget: EndpointIdentity[]; issues: ValidationIssue[] } {
  // Start with a straight splice, then apply pair status markings
  const result = buildStraightSplice(input, sourceCable, targetCable, sourceEnd, targetEnd);

  if (input.pairStatuses) {
    for (const conn of result.connections) {
      const status = input.pairStatuses.get(conn.sourceEndpoint.physicalPosition);
      if (status) {
        conn.pairStatus = status;
      }
    }
  }

  return result;
}

// ── Main Entry Point ──

export function buildSplicePlan(input: SplicePlanInput): ResolvedSplicePlan {
  const { operationType, cables, cableEnds } = input;

  if (cableEnds.length < 2) {
    return {
      id: `plan-${input.spliceCaseId}`,
      spliceCaseId: input.spliceCaseId,
      connections: [],
      unassignedSource: [],
      unassignedTarget: [],
      issues: [{
        severity: 'error',
        code: 'INSUFFICIENT_CABLE_ENDS',
        message: 'A splice requires at least two cable ends',
      }],
      sourceProfileVersions: {},
      hash: '00000000',
      status: 'blocked',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Build profile version map
  const sourceProfileVersions: Record<string, string> = {};
  for (const cable of cables) {
    sourceProfileVersions[cable.countProfileId] = cable.countProfileVersion;
  }

  let result: {
    connections: Connection[];
    unassignedSource: EndpointIdentity[];
    unassignedTarget: EndpointIdentity[];
    issues: ValidationIssue[];
  };

  const sourceCable = cables.find(c => c.id === cableEnds[0]!.cableId);
  const targetCable = cables.find(c => c.id === cableEnds[1]!.cableId);

  if (operationType === 'branch' || operationType === 'mid-span') {
    result = operationType === 'branch'
      ? buildBranchSplice(input, cables, cableEnds)
      : buildMidSpanSplice(input, cables, cableEnds);
  } else if (!sourceCable || !targetCable) {
    result = {
      connections: [],
      unassignedSource: [],
      unassignedTarget: [],
      issues: [{ severity: 'error', code: 'CABLE_NOT_FOUND', message: 'One or more cables not found in the provided cable list' }],
    };
  } else {
    switch (operationType) {
      case 'straight':
        result = buildStraightSplice(input, sourceCable, targetCable, cableEnds[0]!, cableEnds[1]!);
        break;
      case 'remap':
        result = buildRemapSplice(input, sourceCable, targetCable, cableEnds[0]!, cableEnds[1]!);
        break;
      case 'bridge-tap':
      case 'spare-reserve':
        result = buildBridgeTapSplice(input, sourceCable, targetCable, cableEnds[0]!, cableEnds[1]!);
        break;
      default: {
        const _exhaustive: never = operationType;
        result = {
          connections: [],
          unassignedSource: [],
          unassignedTarget: [],
          issues: [{ severity: 'error', code: 'UNKNOWN_OPERATION', message: `Unknown operation type: ${_exhaustive}` }],
        };
      }
    }
  }

  const hasErrors = result.issues.some(i => i.severity === 'error');
  const status: ResolvedSplicePlan['status'] = hasErrors ? 'blocked' : 'draft';

  return {
    id: `plan-${input.spliceCaseId}`,
    spliceCaseId: input.spliceCaseId,
    connections: result.connections,
    unassignedSource: result.unassignedSource,
    unassignedTarget: result.unassignedTarget,
    issues: result.issues,
    sourceProfileVersions,
    hash: hashPlan(result.connections),
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
