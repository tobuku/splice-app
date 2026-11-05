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
  caseSuffix = 'case',
): SpliceCase {
  const now = new Date().toISOString();
  return {
    id: did(demo, caseSuffix),
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
  planSuffix = 'plan',
): ResolvedSplicePlan {
  const now = new Date().toISOString();
  return {
    id: did(demo, planSuffix),
    spliceCaseId: caseId,
    connections: [],
    unassignedSource,
    unassignedTarget,
    issues,
    sourceProfileVersions: {},
    hash: did(demo, planSuffix, 'hash'),
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

// ─── Demo F: Real Fiber Cutover — MH 4031 (from engineering prints) ───
// Based on actual engineering print data. This demonstrates a fiber count
// transfer/cutover at MH #4031, S Beretania St, Honolulu.
// Counts FHNLL201,49-60 are being cut dead on one cable and energized on another.

function demoF() {
  const job = makeJob('f', 'Fiber Cutover — MH #4031, S Beretania St', 'MH #4031, S Beretania St, Honolulu');

  // ─── Cable 1: FID# 200636960 — Existing 72-SM (cut dead on FHNLL201,49-60) ───
  // FHNLL201,1-48 | (FHNLL201,49-60)FD49-60<PP> | FHNLL201,61-68 | FD69-72
  const cable636960 = makeCable('f', '636960', 'fiber', 72, '200636960', 'A', '12F/tube');
  cable636960.manufacturer = 'OFS';
  cable636960.model = 'Microcable 72-SM';
  cable636960.provenance = 'FID#200636960 (14), M#71005455-1, 4052ft. FHNLL201 counts 1-48 active, 49-60 to be CUT DEAD per splice instruction, 61-68 active, 69-72 FD.';

  // ─── Cable 2: FID# 200827578 — New 72-SM (energize FHNLL201,49-60) ───
  // HHNLL281,289-312 | HHNLL281,337-348 | THEOA,37-48 | (THEOA,49-60)(R)FHNLL201,49-60<PP> | THEOA,61-68 | FD69-72
  const cable827578 = makeCable('f', '827578', 'fiber', 72, '200827578', 'Z', '12F/tube');
  cable827578.manufacturer = 'OFS';
  cable827578.model = 'Microcable 72-SM';
  cable827578.provenance = 'FID#200827578 (18), M#71005455-1, 330ft. HHNLL281 counts 289-312 and 337-348, THEOA 37-48 and 61-68. Fibers 49-60 rerouted to carry FHNLL201,49-60 per splice instruction.';

  // ─── Cable 3: FID# 200827576 — Adjacent 72-SM ───
  // HHNLL281,289-312 | HHNLL281,337-348 | FD37-48 | (FD49-60)(R)FHNLL201,49-60<PP> | FD61-72
  const cable827576 = makeCable('f', '827576', 'fiber', 72, '200827576', 'A', '12F/tube');
  cable827576.manufacturer = 'OFS';
  cable827576.model = 'Microcable 72-SM';
  cable827576.provenance = 'FID#200827576 (18), M#71005455-1, 250ft. HHNLL281 counts 289-312 and 337-348. Fibers 49-60 pass-through for FHNLL201,49-60.';

  // ─── Cable 4: FID# 201181876 — Pass-through 72-SM at MH 4031 ───
  // FD1-24<PP> | HHNLL281,337-339<PP> | FD28-72<PP>
  const cable181876 = makeCable('f', '181876', 'fiber', 72, '201181876', 'A', '12F/tube');
  cable181876.manufacturer = 'OFS';
  cable181876.model = 'Microcable 72-SM';
  cable181876.provenance = 'FID#201181876 (PP), 3F015KF-0000, M#71005455-1, 1200ft. All fibers pass-through at MH 4031.';

  // ─── Cable 5: FID# 200625508 — 216-SM Fortex on Kinau St ───
  // HHNLL281,1-173 | FD174-180 | HHNLL281,181-197 | FD198-202 | (FD203-204)FHNLL201,49-50<PP> | HHNLL281,205-206 | (FD207-216)FHNLL201,51-60<PP>
  const cable625508 = makeCable('f', '625508', 'fiber', 216, '200625508', 'Z', '12F/tube');
  cable625508.manufacturer = 'OFS';
  cable625508.model = 'Fortex 216-SM';
  cable625508.provenance = 'FID#200625508 (14), M#100000057-1, 772ft, Kinau St P15. HHNLL281 counts 1-173, 181-197, 205-206. FHNLL201,49-50 at positions 203-204, FHNLL201,51-60 at positions 207-216.';

  // ─── Splice Case 1: Cut dead & energize FHNLL201,49-60 at MH 4031 ───
  // Cut dead fibers 49-60 on cable 200636960
  // Energize fibers 49-60 on cable 200827578
  // This is a straight splice of 12 fibers (the FHNLL201 counts being transferred)
  const splice1 = makeSpliceCase('f', job.id, 'straight', [
    { id: did('f', 'end', 's1-src'), cableId: cable636960.id, role: 'peer', rangeStart: 49, rangeEnd: 60 },
    { id: did('f', 'end', 's1-tgt'), cableId: cable827578.id, role: 'peer', rangeStart: 49, rangeEnd: 60 },
  ], 'case-splice1');

  const plan1 = makePlan('f', splice1.id, 'needs-verification', [
    {
      severity: 'info',
      code: 'CUTOVER_OPERATION',
      message: 'SPLICE 1: Cut dead FHNLL201,49-60 on 200636960 and energize same counts on 200827578. This transfers 12 fiber counts from old cable to new cable at MH #4031, S Beretania St.',
    },
    {
      severity: 'warning',
      code: 'LIVE_CIRCUIT_AFFECTED',
      message: 'FHNLL201 counts 49-60 are currently live on cable 200636960. Coordinate outage window before cutting.',
      cableId: cable636960.id,
      suggestedAction: 'Confirm outage authorization with NOC before performing Splice 1.',
    },
    {
      severity: 'info',
      code: 'PASS_THROUGH_CABLES',
      message: 'Cables 200827576 and 201181876 have pass-through fibers at this location. Do not disturb.',
    },
    {
      severity: 'info',
      code: 'FIBER_ASSIGNMENT_DETAIL',
      message: 'Cable 200636960 fiber assignments: FHNLL201 f1-48 (active, untouched), f49-60 (CUT DEAD), f61-68 (active, untouched), f69-72 (FD). Cable 200827578 fiber assignments: HHNLL281 f289-312 @pos1-24, HHNLL281 f337-348 @pos25-36, THEOA f37-48 @pos37-48, FHNLL201 f49-60 @pos49-60 (ENERGIZE), THEOA f61-68 @pos61-68, FD @pos69-72.',
    },
  ], [], [], 'plan-splice1');

  // ─── Splice Case 2: Energize FHNLL201,49-60 on 216-SM at Kinau St ───
  // Fibers 49-50 of FHNLL201 go to positions 203-204 of cable 200625508
  // Fibers 51-60 of FHNLL201 go to positions 207-216 of cable 200625508
  const splice2 = makeSpliceCase('f', job.id, 'remap', [
    { id: did('f', 'end', 's2-src'), cableId: cable827578.id, role: 'peer', rangeStart: 49, rangeEnd: 60 },
    { id: did('f', 'end', 's2-tgt'), cableId: cable625508.id, role: 'peer', rangeStart: 203, rangeEnd: 216 },
  ], 'case-splice2');

  const plan2 = makePlan('f', splice2.id, 'needs-verification', [
    {
      severity: 'info',
      code: 'CUTOVER_OPERATION',
      message: 'SPLICE 2: Energize FHNLL201,49-60 on 216-SM OFS Fortex (FID# 200625508) on Kinau St, P15.',
    },
    {
      severity: 'warning',
      code: 'NON_CONTIGUOUS_MAPPING',
      message: 'Target positions on cable 200625508 are not contiguous: FHNLL201 f49-50 map to positions 203-204, but f51-60 map to positions 207-216 (positions 205-206 are HHNLL281 counts). Requires explicit crosswalk.',
      cableId: cable625508.id,
      suggestedAction: 'Use remap splice with crosswalk table: src49->tgt203, src50->tgt204, src51->tgt207, src52->tgt208 ... src60->tgt216.',
    },
    {
      severity: 'warning',
      code: 'CROSSWALK_REQUIRED',
      message: 'This remap requires an explicit crosswalk table. The non-contiguous target positions mean a straight splice would assign fibers incorrectly.',
      suggestedAction: 'Build or import the crosswalk mapping before approving this splice case.',
    },
  ], [], [], 'plan-splice2');

  return {
    jobs: [job],
    cables: [cable636960, cable827578, cable827576, cable181876, cable625508],
    spliceCases: [splice1, splice2],
    plans: [plan1, plan2],
  };
}

// ─── Seed orchestrator ───

export async function seedDemoData(database: SpliceDatabase): Promise<void> {
  // Idempotent: skip if demo data already present
  const existing = await database.jobs.get(did('a', 'job'));
  if (existing) return;

  const demos = [demoA(), demoB(), demoC(), demoD(), demoE(), demoF()];

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
