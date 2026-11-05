import type { SpliceDatabase } from './db.js';
import type { Job, Cable, SpliceCase, ResolvedSplicePlan } from '@splice/domain';

const DEMO_PREFIX = 'demo';

/** Deterministic ID helper */
function did(demo: string, ...parts: string[]): string {
  return [DEMO_PREFIX, demo, ...parts].join('-');
}

function makeJob(demo: string, name: string, location: string, status: Job['status'] = 'active'): Job {
  const now = new Date().toISOString();
  return { id: did(demo, 'job'), name, location, owner: 'demo', status, createdAt: now, updatedAt: now };
}

function makeCable(
  demo: string,
  suffix: string,
  media: Cable['media'],
  nominalCount: number,
  sheathId: string,
  end: 'A' | 'Z' = 'A',
  construction?: string,
): Cable {
  const now = new Date().toISOString();
  return {
    id: did(demo, 'cable', suffix),
    media,
    nominalCount,
    countProfileId: media === 'copper' ? 'copper-standard-25' : 'fiber-tia598-12',
    countProfileVersion: '1.0.0',
    sheathId,
    construction,
    orientation: { end, physicalDirection: 'ascending', reversed: false },
    createdAt: now,
    updatedAt: now,
  };
}

function makeSpliceCase(
  demo: string,
  jobId: string,
  operationType: SpliceCase['operationType'],
  cableEnds: SpliceCase['cableEnds'],
): SpliceCase {
  const now = new Date().toISOString();
  return {
    id: did(demo, 'case'),
    jobId,
    operationType,
    cableEnds,
    createdAt: now,
    updatedAt: now,
  };
}

function makePlan(
  demo: string,
  caseId: string,
  status: ResolvedSplicePlan['status'],
  issues: ResolvedSplicePlan['issues'] = [],
  unassignedSource: ResolvedSplicePlan['unassignedSource'] = [],
  unassignedTarget: ResolvedSplicePlan['unassignedTarget'] = [],
): ResolvedSplicePlan {
  const now = new Date().toISOString();
  return {
    id: did(demo, 'plan'),
    spliceCaseId: caseId,
    connections: [],
    unassignedSource,
    unassignedTarget,
    issues,
    sourceProfileVersions: {},
    hash: did(demo, 'hash'),
    status,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Demo A: Simple Copper Splice ───

function demoA() {
  const job = makeJob('a', 'Simple Copper Splice — MH-101', 'Manhole 101, Main St & 1st Ave');
  const cableA = makeCable('a', '1', 'copper', 25, 'C-101', 'A');
  const cableB = makeCable('a', '2', 'copper', 25, 'C-102', 'Z');
  const spliceCase = makeSpliceCase('a', job.id, 'straight', [
    { id: did('a', 'end', '1'), cableId: cableA.id, role: 'peer', rangeStart: 1, rangeEnd: 25 },
    { id: did('a', 'end', '2'), cableId: cableB.id, role: 'peer', rangeStart: 1, rangeEnd: 25 },
  ]);
  const plan = makePlan('a', spliceCase.id, 'verified');
  return { jobs: [job], cables: [cableA, cableB], spliceCases: [spliceCase], plans: [plan] };
}

// ─── Demo B: Multi-Cable Copper Distribution ───

function demoB() {
  const job = makeJob('b', 'Multi-Cable Copper Distribution — MH-204', 'Manhole 204, Industrial Park');
  const feeder = makeCable('b', 'f', 'copper', 300, 'F-300', 'A');
  const d1 = makeCable('b', 'd1', 'copper', 100, 'D-101', 'Z');
  const d2 = makeCable('b', 'd2', 'copper', 100, 'D-102', 'Z');
  const d3 = makeCable('b', 'd3', 'copper', 100, 'D-103', 'Z');
  const spliceCase = makeSpliceCase('b', job.id, 'branch', [
    { id: did('b', 'end', 'f'), cableId: feeder.id, role: 'feeder', rangeStart: 1, rangeEnd: 300 },
    { id: did('b', 'end', 'd1'), cableId: d1.id, role: 'distribution', rangeStart: 1, rangeEnd: 100 },
    { id: did('b', 'end', 'd2'), cableId: d2.id, role: 'distribution', rangeStart: 1, rangeEnd: 100 },
    { id: did('b', 'end', 'd3'), cableId: d3.id, role: 'distribution', rangeStart: 1, rangeEnd: 100 },
  ]);
  const plan = makePlan('b', spliceCase.id, 'verified');
  return { jobs: [job], cables: [feeder, d1, d2, d3], spliceCases: [spliceCase], plans: [plan] };
}

// ─── Demo C: Simple Fiber Splice ───

function demoC() {
  const job = makeJob('c', 'Simple Fiber Splice — SP-001', 'Splice Point 1, Fiber Route A');
  const fa = makeCable('c', '1', 'fiber', 24, 'F-201', 'A', '12F/tube');
  const fb = makeCable('c', '2', 'fiber', 24, 'F-202', 'Z', '12F/tube');
  const spliceCase = makeSpliceCase('c', job.id, 'straight', [
    { id: did('c', 'end', '1'), cableId: fa.id, role: 'peer', rangeStart: 1, rangeEnd: 24 },
    { id: did('c', 'end', '2'), cableId: fb.id, role: 'peer', rangeStart: 1, rangeEnd: 24 },
  ]);
  const plan = makePlan('c', spliceCase.id, 'verified');
  return { jobs: [job], cables: [fa, fb], spliceCases: [spliceCase], plans: [plan] };
}

// ─── Demo D: Advanced Fiber Distribution ───

function demoD() {
  const job = makeJob('d', 'Advanced Fiber Distribution — SP-010', 'Hub Site Splice Closure');
  const feeder = makeCable('d', 'fm', 'fiber', 144, 'FM-144', 'A');
  const fb1 = makeCable('d', 'fb1', 'fiber', 48, 'FB-048-A', 'Z');
  const fb2 = makeCable('d', 'fb2', 'fiber', 48, 'FB-048-B', 'Z');
  const spliceCase = makeSpliceCase('d', job.id, 'branch', [
    { id: did('d', 'end', 'fm'), cableId: feeder.id, role: 'feeder', rangeStart: 1, rangeEnd: 144 },
    { id: did('d', 'end', 'fb1'), cableId: fb1.id, role: 'distribution', rangeStart: 1, rangeEnd: 48 },
    { id: did('d', 'end', 'fb2'), cableId: fb2.id, role: 'distribution', rangeStart: 1, rangeEnd: 48 },
  ]);
  const plan = makePlan('d', spliceCase.id, 'draft', [
    {
      severity: 'warning',
      code: 'FIBERS_RESERVED',
      message: '12 fibers reserved on feeder (positions 97-108)',
      cableId: feeder.id,
      position: 97,
    },
    {
      severity: 'info',
      code: 'FIBERS_EXPRESS',
      message: '12 fibers express/pass-through on feeder (positions 109-120)',
      cableId: feeder.id,
      position: 109,
    },
    {
      severity: 'warning',
      code: 'CAPACITY_UNASSIGNED',
      message: '24 feeder fibers (positions 121-144) not assigned to any distribution cable',
      cableId: feeder.id,
      position: 121,
    },
  ]);
  return { jobs: [job], cables: [feeder, fb1, fb2], spliceCases: [spliceCase], plans: [plan] };
}

// ─── Demo E: Engineering Discrepancy ───

function demoE() {
  const job = makeJob('e', 'Engineering Discrepancy — MH-500', 'Manhole 500, Count Mismatch');
  const cableX = makeCable('e', 'x', 'copper', 100, 'X-100', 'A');
  cableX.provenance = 'Field verified: 100 pairs confirmed on-site';
  const cableY = makeCable('e', 'y', 'copper', 75, 'Y-075', 'Z');
  cableY.provenance = 'Engineering print says 100 pairs, field count shows 75. Discrepancy unresolved.';
  const spliceCase = makeSpliceCase('e', job.id, 'straight', [
    { id: did('e', 'end', 'x'), cableId: cableX.id, role: 'peer', rangeStart: 1, rangeEnd: 100 },
    { id: did('e', 'end', 'y'), cableId: cableY.id, role: 'peer', rangeStart: 1, rangeEnd: 75 },
  ]);
  const plan = makePlan('e', spliceCase.id, 'blocked', [
    {
      severity: 'error',
      code: 'COUNT_MISMATCH',
      message: 'Cable X has 100 pairs but Cable Y has only 75 pairs. Engineering print for Y-075 says 100 pairs — field count disagrees. Cannot proceed until discrepancy is resolved.',
      cableId: cableY.id,
      suggestedAction: 'Verify cable Y pair count in the field. Update engineering records or cable entry before planning splice.',
    },
    {
      severity: 'warning',
      code: 'UNASSIGNED_SOURCE',
      message: '25 pairs on Cable X (positions 76-100) have no target assignment',
      cableId: cableX.id,
      position: 76,
    },
  ]);
  return { jobs: [job], cables: [cableX, cableY], spliceCases: [spliceCase], plans: [plan] };
}

// ─── Seed orchestrator ───

export async function seedDemoData(database: SpliceDatabase): Promise<void> {
  // Idempotent: skip if demo data already present
  const existing = await database.jobs.get(did('a', 'job'));
  if (existing) return;

  const demos = [demoA(), demoB(), demoC(), demoD(), demoE()];

  await database.transaction(
    'rw',
    [database.jobs, database.cables, database.spliceCases, database.plans],
    async () => {
      for (const demo of demos) {
        await database.jobs.bulkAdd(demo.jobs);
        await database.cables.bulkAdd(demo.cables);
        await database.spliceCases.bulkAdd(demo.spliceCases);
        await database.plans.bulkAdd(demo.plans);
      }
    },
  );
}
