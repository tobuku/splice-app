import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildSplicePlan,
  registerProfile,
  clearRegistry,
  copperStandard25,
  fiberTia598_12,
} from '../src/index.js';
import type { Cable, CableEnd } from '../src/index.js';

// ── Helpers ──

function makeCopperCable(id: string, count: number): Cable {
  return {
    id,
    media: 'copper',
    nominalCount: count,
    countProfileId: 'copper-standard-25',
    countProfileVersion: '1.0.0',
    sheathId: `CA-${id}`,
    orientation: { end: 'A', physicalDirection: 'ascending', reversed: false },
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function makeFiberCable(id: string, count: number): Cable {
  return {
    id,
    media: 'fiber',
    nominalCount: count,
    countProfileId: 'fiber-tia598-12',
    countProfileVersion: '1.0.0',
    sheathId: `FO-${id}`,
    orientation: { end: 'A', physicalDirection: 'ascending', reversed: false },
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function makeEnd(cableId: string, start: number, end: number, role: CableEnd['role'] = 'peer'): CableEnd {
  return { id: `end-${cableId}`, cableId, role, rangeStart: start, rangeEnd: end };
}

/** Verify the fundamental accounting invariants on any splice plan */
function assertInvariants(
  plan: ReturnType<typeof buildSplicePlan>,
  sourceCount: number,
  targetCount: number,
) {
  // Invariant 1: connections + unassignedSource = sourceCount
  expect(plan.connections.length + plan.unassignedSource.length).toBe(sourceCount);

  // Invariant 2: connections + unassignedTarget = targetCount
  expect(plan.connections.length + plan.unassignedTarget.length).toBe(targetCount);

  // Invariant 3: all connection IDs unique
  const ids = plan.connections.map(c => c.id);
  expect(new Set(ids).size).toBe(ids.length);

  // Invariant 4: no duplicate target positions within the same target cable
  const targetPositions = plan.connections.map(
    c => `${c.targetEndpoint.cableId}:${c.targetEndpoint.physicalPosition}`
  );
  expect(new Set(targetPositions).size).toBe(targetPositions.length);
}

describe('Large-Scale Copper Cable Tests', () => {
  beforeEach(() => {
    registerProfile(copperStandard25);
    registerProfile(fiberTia598_12);
  });
  afterEach(() => {
    clearRegistry();
  });

  describe('300-pair cable', () => {
    it('resolves 300 endpoints with 12 binder groups', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'lg-cu-300',
        operationType: 'straight',
        cables: [makeCopperCable('A', 300), makeCopperCable('B', 300)],
        cableEnds: [makeEnd('A', 1, 300), makeEnd('B', 1, 300)],
      });

      expect(plan.connections).toHaveLength(300);
      assertInvariants(plan, 300, 300);

      // Verify binder group structure: 300 / 25 = 12 binder groups
      // Check that pair 1 is in Binder 1, pair 26 in Binder 2, pair 300 in Binder 12
      expect(plan.connections[0]!.sourceEndpoint.structurePath[0]).toContain('Binder 1');
      expect(plan.connections[25]!.sourceEndpoint.structurePath[0]).toContain('Binder 2');
      expect(plan.connections[299]!.sourceEndpoint.structurePath[0]).toContain('Binder 12');
    });
  });

  describe('600-pair cable', () => {
    it('resolves 600 endpoints with 24 binder groups', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'lg-cu-600',
        operationType: 'straight',
        cables: [makeCopperCable('A', 600), makeCopperCable('B', 600)],
        cableEnds: [makeEnd('A', 1, 600), makeEnd('B', 1, 600)],
      });

      expect(plan.connections).toHaveLength(600);
      assertInvariants(plan, 600, 600);

      // Check binder group boundaries
      // Pair 1 -> Binder 1, Pair 600 -> Binder 24
      expect(plan.connections[0]!.sourceEndpoint.structurePath[0]).toContain('Binder 1');
      expect(plan.connections[599]!.sourceEndpoint.structurePath[0]).toContain('Binder 24');

      // Verify specific binder boundary: pair 25 is last of Binder 1, pair 26 is first of Binder 2
      expect(plan.connections[24]!.sourceEndpoint.structurePath[0]).toContain('Binder 1');
      expect(plan.connections[25]!.sourceEndpoint.structurePath[0]).toContain('Binder 2');
    });
  });

  describe('900-pair cable', () => {
    it('resolves 900 endpoints with 36 binder groups', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'lg-cu-900',
        operationType: 'straight',
        cables: [makeCopperCable('A', 900), makeCopperCable('B', 900)],
        cableEnds: [makeEnd('A', 1, 900), makeEnd('B', 1, 900)],
      });

      expect(plan.connections).toHaveLength(900);
      assertInvariants(plan, 900, 900);

      // 900 / 25 = 36 binder groups
      // Binders 1-25 are in Super 1, Binders 26-36 are in Super 2
      // Pair 625 is the last of Super 1 (binder 25, pair 25)
      // Pair 626 is the first of Super 2 (binder 26, pair 1)
      const pair625 = plan.connections[624]!.sourceEndpoint;
      const pair626 = plan.connections[625]!.sourceEndpoint;

      expect(pair625.structurePath).toContain('Super 1');
      expect(pair625.structurePath.some(s => s.includes('Binder 25'))).toBe(true);
      expect(pair626.structurePath).toContain('Super 2');
      expect(pair626.structurePath.some(s => s.includes('Binder 26'))).toBe(true);

      // Pair 900 -> Binder 36
      const pair900 = plan.connections[899]!.sourceEndpoint;
      expect(pair900.structurePath.some(s => s.includes('Binder 36'))).toBe(true);
    });
  });

  describe('600-pair feeder to 3x200-pair distribution', () => {
    it('accounts for all 600 pairs across three cables', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'lg-cu-branch',
        operationType: 'branch',
        cables: [
          makeCopperCable('feeder', 600),
          makeCopperCable('dist1', 200),
          makeCopperCable('dist2', 200),
          makeCopperCable('dist3', 200),
        ],
        cableEnds: [
          makeEnd('feeder', 1, 600, 'feeder'),
          makeEnd('dist1', 1, 200, 'distribution'),
          makeEnd('dist2', 1, 200, 'distribution'),
          makeEnd('dist3', 1, 200, 'distribution'),
        ],
      });

      expect(plan.connections).toHaveLength(600);
      expect(plan.unassignedSource).toHaveLength(0);
      expect(plan.unassignedTarget).toHaveLength(0);
      assertInvariants(plan, 600, 600);

      // Verify distribution across cables:
      // dist1 gets feeder pairs 1-200, dist2 gets 201-400, dist3 gets 401-600
      const dist1Conns = plan.connections.filter(c => c.targetEndpoint.cableId === 'dist1');
      const dist2Conns = plan.connections.filter(c => c.targetEndpoint.cableId === 'dist2');
      const dist3Conns = plan.connections.filter(c => c.targetEndpoint.cableId === 'dist3');

      expect(dist1Conns).toHaveLength(200);
      expect(dist2Conns).toHaveLength(200);
      expect(dist3Conns).toHaveLength(200);
    });
  });
});

describe('Large-Scale Fiber Cable Tests', () => {
  beforeEach(() => {
    registerProfile(copperStandard25);
    registerProfile(fiberTia598_12);
  });
  afterEach(() => {
    clearRegistry();
  });

  describe('288F cable (24 tubes x 12F)', () => {
    it('resolves all 288 endpoints', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'lg-fi-288',
        operationType: 'straight',
        cables: [makeFiberCable('F1', 288), makeFiberCable('F2', 288)],
        cableEnds: [makeEnd('F1', 1, 288), makeEnd('F2', 1, 288)],
      });

      expect(plan.connections).toHaveLength(288);
      assertInvariants(plan, 288, 288);

      // 288 / 12 = 24 tubes
      // Fiber 1 -> Tube 1 Blue, Fiber 12 -> Tube 1 Aqua
      // Fiber 13 -> Tube 2 Blue, Fiber 288 -> Tube 24
      expect(plan.connections[0]!.sourceEndpoint.structurePath[0]).toContain('Tube 1');
      expect(plan.connections[0]!.sourceEndpoint.colorIdentity.name).toBe('Blue');
      expect(plan.connections[11]!.sourceEndpoint.colorIdentity.name).toBe('Aqua');
      expect(plan.connections[12]!.sourceEndpoint.structurePath[0]).toContain('Tube 2');
      expect(plan.connections[287]!.sourceEndpoint.structurePath[0]).toContain('Tube 24');
    });
  });

  describe('576F cable (48 tubes x 12F)', () => {
    it('resolves all 576 endpoints', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'lg-fi-576',
        operationType: 'straight',
        cables: [makeFiberCable('F1', 576), makeFiberCable('F2', 576)],
        cableEnds: [makeEnd('F1', 1, 576), makeEnd('F2', 1, 576)],
      });

      expect(plan.connections).toHaveLength(576);
      assertInvariants(plan, 576, 576);

      // 576 / 12 = 48 tubes
      // Tubes 13-24 are cycle 2, tubes 25-36 are cycle 3, tubes 37-48 are cycle 4
      // Fiber 145 -> Tube 13 (cycle 2)
      const fiber145 = plan.connections[144]!.sourceEndpoint;
      expect(fiber145.structurePath[0]).toContain('Tube 13');
      expect(fiber145.structurePath[0]).toContain('cycle 2');
    });
  });

  describe('144F feeder to 2x72F distribution', () => {
    it('accounts for all 144 fibers across two cables', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'lg-fi-branch',
        operationType: 'branch',
        cables: [
          makeFiberCable('feeder', 144),
          makeFiberCable('dist1', 72),
          makeFiberCable('dist2', 72),
        ],
        cableEnds: [
          makeEnd('feeder', 1, 144, 'feeder'),
          makeEnd('dist1', 1, 72, 'distribution'),
          makeEnd('dist2', 1, 72, 'distribution'),
        ],
      });

      expect(plan.connections).toHaveLength(144);
      expect(plan.unassignedSource).toHaveLength(0);
      expect(plan.unassignedTarget).toHaveLength(0);
      assertInvariants(plan, 144, 144);

      const dist1Conns = plan.connections.filter(c => c.targetEndpoint.cableId === 'dist1');
      const dist2Conns = plan.connections.filter(c => c.targetEndpoint.cableId === 'dist2');
      expect(dist1Conns).toHaveLength(72);
      expect(dist2Conns).toHaveLength(72);
    });
  });

  describe('864F cable', () => {
    it('resolves all 864 endpoints and labels tube cycles correctly', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'lg-fi-864',
        operationType: 'straight',
        cables: [makeFiberCable('F1', 864), makeFiberCable('F2', 864)],
        cableEnds: [makeEnd('F1', 1, 864), makeEnd('F2', 1, 864)],
      });

      expect(plan.connections).toHaveLength(864);
      assertInvariants(plan, 864, 864);

      // 864 / 12 = 72 tubes
      // Tubes 1-12: cycle 1 (no label)
      // Tubes 13-24: cycle 2
      // Tubes 25-36: cycle 3
      // Tubes 37-48: cycle 4
      // Tubes 49-60: cycle 5
      // Tubes 61-72: cycle 6

      // Fiber 1 -> Tube 1 (no cycle label)
      expect(plan.connections[0]!.sourceEndpoint.structurePath[0]).toContain('Tube 1');
      expect(plan.connections[0]!.sourceEndpoint.structurePath[0]).not.toContain('cycle');

      // Fiber 145 -> Tube 13 (cycle 2)
      const fiber145 = plan.connections[144]!.sourceEndpoint;
      expect(fiber145.structurePath[0]).toContain('Tube 13');
      expect(fiber145.structurePath[0]).toContain('cycle 2');

      // Fiber 289 -> Tube 25 (cycle 3)
      const fiber289 = plan.connections[288]!.sourceEndpoint;
      expect(fiber289.structurePath[0]).toContain('Tube 25');
      expect(fiber289.structurePath[0]).toContain('cycle 3');

      // Fiber 864 -> Tube 72 (cycle 6)
      const fiber864 = plan.connections[863]!.sourceEndpoint;
      expect(fiber864.structurePath[0]).toContain('Tube 72');
      expect(fiber864.structurePath[0]).toContain('cycle 6');
    });
  });
});

describe('Performance Checks', () => {
  beforeEach(() => {
    registerProfile(copperStandard25);
    registerProfile(fiberTia598_12);
  });
  afterEach(() => {
    clearRegistry();
  });

  it('900-pair straight splice completes in under 100ms', () => {
    const start = performance.now();
    const plan = buildSplicePlan({
      spliceCaseId: 'perf-cu-900',
      operationType: 'straight',
      cables: [makeCopperCable('A', 900), makeCopperCable('B', 900)],
      cableEnds: [makeEnd('A', 1, 900), makeEnd('B', 1, 900)],
    });
    const elapsed = performance.now() - start;

    expect(plan.connections).toHaveLength(900);
    expect(elapsed).toBeLessThan(100);
  });

  it('864F straight splice completes in under 100ms', () => {
    const start = performance.now();
    const plan = buildSplicePlan({
      spliceCaseId: 'perf-fi-864',
      operationType: 'straight',
      cables: [makeFiberCable('F1', 864), makeFiberCable('F2', 864)],
      cableEnds: [makeEnd('F1', 1, 864), makeEnd('F2', 1, 864)],
    });
    const elapsed = performance.now() - start;

    expect(plan.connections).toHaveLength(864);
    expect(elapsed).toBeLessThan(100);
  });
});
