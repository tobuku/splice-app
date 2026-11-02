import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  buildSplicePlan,
  registerProfile,
  clearRegistry,
  copperStandard25,
  fiberTia598_12,
} from '../src/index.js';
import type { Cable, CableEnd } from '../src/index.js';

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

function makeEnd(cableId: string, start: number, end: number): CableEnd {
  return { id: `end-${cableId}`, cableId, role: 'peer', rangeStart: start, rangeEnd: end };
}

describe('Property-based tests', () => {
  beforeEach(() => {
    registerProfile(copperStandard25);
    registerProfile(fiberTia598_12);
  });
  afterEach(() => {
    clearRegistry();
  });

  it('straight splice: connections + unassigned = total endpoints', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 600 }),
        fc.integer({ min: 1, max: 600 }),
        (srcCount, tgtCount) => {
          const plan = buildSplicePlan({
            spliceCaseId: 'prop-1',
            operationType: 'straight',
            cables: [makeCopperCable('A', srcCount), makeCopperCable('B', tgtCount)],
            cableEnds: [makeEnd('A', 1, srcCount), makeEnd('B', 1, tgtCount)],
          });

          const totalMapped = plan.connections.length;
          expect(totalMapped + plan.unassignedSource.length).toBe(srcCount);
          expect(totalMapped + plan.unassignedTarget.length).toBe(tgtCount);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('straight splice: no duplicate target positions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        (count) => {
          const plan = buildSplicePlan({
            spliceCaseId: 'prop-2',
            operationType: 'straight',
            cables: [makeCopperCable('A', count), makeCopperCable('B', count)],
            cableEnds: [makeEnd('A', 1, count), makeEnd('B', 1, count)],
          });

          const targetPositions = plan.connections.map(
            c => `${c.targetEndpoint.cableId}:${c.targetEndpoint.physicalPosition}`
          );
          expect(new Set(targetPositions).size).toBe(targetPositions.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('straight splice: unique connection IDs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        (count) => {
          const plan = buildSplicePlan({
            spliceCaseId: 'prop-3',
            operationType: 'straight',
            cables: [makeFiberCable('F1', count), makeFiberCable('F2', count)],
            cableEnds: [makeEnd('F1', 1, count), makeEnd('F2', 1, count)],
          });

          const ids = plan.connections.map(c => c.id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('fiber straight splice: connections + unassigned = total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 12, max: 864 }).filter(n => n % 12 === 0),
        fc.integer({ min: 12, max: 864 }).filter(n => n % 12 === 0),
        (srcCount, tgtCount) => {
          const plan = buildSplicePlan({
            spliceCaseId: 'prop-4',
            operationType: 'straight',
            cables: [makeFiberCable('F1', srcCount), makeFiberCable('F2', tgtCount)],
            cableEnds: [makeEnd('F1', 1, srcCount), makeEnd('F2', 1, tgtCount)],
          });

          expect(plan.connections.length + plan.unassignedSource.length).toBe(srcCount);
          expect(plan.connections.length + plan.unassignedTarget.length).toBe(tgtCount);
        }
      ),
      { numRuns: 30 }
    );
  });
});
