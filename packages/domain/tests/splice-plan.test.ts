import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildSplicePlan,
  registerProfile,
  clearRegistry,
  copperStandard25,
  fiberTia598_12,
  validateSplicePlan,
  renderText,
  renderDiagram,
} from '../src/index.js';
import type { Cable, CableEnd } from '../src/index.js';

function makeCopperCable(id: string, count: number, reversed = false): Cable {
  return {
    id,
    media: 'copper',
    nominalCount: count,
    countProfileId: 'copper-standard-25',
    countProfileVersion: '1.0.0',
    sheathId: `CA-${id}`,
    orientation: { end: 'A', physicalDirection: 'ascending', reversed },
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

describe('Splice Plan Builder', () => {
  beforeEach(() => {
    registerProfile(copperStandard25);
    registerProfile(fiberTia598_12);
  });
  afterEach(() => {
    clearRegistry();
  });

  describe('straight splice - copper', () => {
    it('25-pair to 25-pair: all 25 connections', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-1',
        operationType: 'straight',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
      });

      expect(plan.connections).toHaveLength(25);
      expect(plan.unassignedSource).toHaveLength(0);
      expect(plan.unassignedTarget).toHaveLength(0);
      expect(plan.status).toBe('draft');

      // Verify pair 1 colors
      expect(plan.connections[0]!.sourceEndpoint.colorIdentity.name).toBe('White-Blue');
      expect(plan.connections[0]!.targetEndpoint.colorIdentity.name).toBe('White-Blue');

      // Verify pair 25 colors
      expect(plan.connections[24]!.sourceEndpoint.colorIdentity.name).toBe('Violet-Slate');
    });

    it('50-pair to 25-pair: 25 connected, 25 unassigned source', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-2',
        operationType: 'straight',
        cables: [makeCopperCable('A', 50), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 50), makeEnd('B', 1, 25)],
      });

      expect(plan.connections).toHaveLength(25);
      expect(plan.unassignedSource).toHaveLength(25);
      expect(plan.unassignedTarget).toHaveLength(0);
      expect(plan.issues.some(i => i.code === 'CAPACITY_MISMATCH')).toBe(true);
    });
  });

  describe('straight splice - fiber', () => {
    it('144F to 144F: all fibers connected', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-f1',
        operationType: 'straight',
        cables: [makeFiberCable('F1', 144), makeFiberCable('F2', 144)],
        cableEnds: [makeEnd('F1', 1, 144), makeEnd('F2', 1, 144)],
      });

      expect(plan.connections).toHaveLength(144);
      expect(plan.unassignedSource).toHaveLength(0);

      // Verify tube boundary: fiber 12 is Aqua, fiber 13 is Blue
      expect(plan.connections[11]!.sourceEndpoint.colorIdentity.name).toBe('Aqua');
      expect(plan.connections[12]!.sourceEndpoint.colorIdentity.name).toBe('Blue');
    });
  });

  describe('remap splice', () => {
    it('blocks without crosswalk', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-r1',
        operationType: 'remap',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
      });

      expect(plan.connections).toHaveLength(0);
      expect(plan.status).toBe('blocked');
      expect(plan.issues.some(i => i.code === 'MISSING_CROSSWALK')).toBe(true);
    });

    it('maps with explicit crosswalk', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-r2',
        operationType: 'remap',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
        crosswalk: {
          id: 'cw-1',
          sourceProfileId: 'copper-standard-25',
          targetProfileId: 'copper-standard-25',
          entries: [
            { sourcePosition: 1, targetPosition: 25, verified: true },
            { sourcePosition: 2, targetPosition: 24, verified: true },
          ],
          provenance: 'Manual mapping',
          version: '1.0.0',
        },
      });

      expect(plan.connections).toHaveLength(2);
      expect(plan.connections[0]!.sourceEndpoint.physicalPosition).toBe(1);
      expect(plan.connections[0]!.targetEndpoint.physicalPosition).toBe(25);
      expect(plan.unassignedSource).toHaveLength(23);
      expect(plan.unassignedTarget).toHaveLength(23);
    });

    it('rejects duplicate target in crosswalk', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-r3',
        operationType: 'remap',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
        crosswalk: {
          id: 'cw-2',
          sourceProfileId: 'copper-standard-25',
          targetProfileId: 'copper-standard-25',
          entries: [
            { sourcePosition: 1, targetPosition: 5, verified: true },
            { sourcePosition: 2, targetPosition: 5, verified: true },
          ],
          provenance: 'Test',
          version: '1.0.0',
        },
      });

      expect(plan.issues.some(i => i.code === 'DUPLICATE_TARGET')).toBe(true);
      expect(plan.connections).toHaveLength(1); // only first one accepted
    });
  });

  describe('branch splice', () => {
    it('600-pair feeder to three 200-pair distribution cables', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-b1',
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
    });

    it('reports unassigned when feeder exceeds distribution total', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-b2',
        operationType: 'branch',
        cables: [
          makeCopperCable('feeder', 100),
          makeCopperCable('dist1', 25),
        ],
        cableEnds: [
          makeEnd('feeder', 1, 100, 'feeder'),
          makeEnd('dist1', 1, 25, 'distribution'),
        ],
      });

      expect(plan.connections).toHaveLength(25);
      expect(plan.unassignedSource).toHaveLength(75);
      expect(plan.issues.some(i => i.code === 'CAPACITY_MISMATCH')).toBe(true);
    });

    it('blocks without feeder', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-b3',
        operationType: 'branch',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25, 'distribution'), makeEnd('B', 1, 25, 'distribution')],
      });

      expect(plan.status).toBe('blocked');
      expect(plan.issues.some(i => i.code === 'NO_FEEDER')).toBe(true);
    });
  });

  describe('mid-span splice', () => {
    it('maps only exposed subset', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-m1',
        operationType: 'mid-span',
        cables: [makeFiberCable('main', 144), makeFiberCable('branch', 24)],
        cableEnds: [makeEnd('main', 1, 144), makeEnd('branch', 1, 24)],
        exposedSubset: {
          cableEndId: 'end-main',
          exposedGroups: ['Tube 1', 'Tube 2'],
          startPosition: 1,
          endPosition: 24,
        },
      });

      expect(plan.connections).toHaveLength(24);
      // Only fibers 1-24 from main cable used
      expect(plan.connections[0]!.sourceEndpoint.physicalPosition).toBe(1);
      expect(plan.connections[23]!.sourceEndpoint.physicalPosition).toBe(24);
    });

    it('blocks without exposed subset', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-m2',
        operationType: 'mid-span',
        cables: [makeFiberCable('main', 144), makeFiberCable('branch', 12)],
        cableEnds: [makeEnd('main', 1, 144), makeEnd('branch', 1, 12)],
      });

      expect(plan.status).toBe('blocked');
      expect(plan.issues.some(i => i.code === 'MISSING_EXPOSED_SUBSET')).toBe(true);
    });
  });

  describe('bridge-tap / spare-reserve', () => {
    it('marks pair statuses on connections', () => {
      const statuses = new Map<number, 'working' | 'spare' | 'bridged' | 'reserved'>();
      statuses.set(1, 'working');
      statuses.set(2, 'spare');
      statuses.set(3, 'bridged');

      const plan = buildSplicePlan({
        spliceCaseId: 'case-bt1',
        operationType: 'bridge-tap',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
        pairStatuses: statuses,
      });

      expect(plan.connections).toHaveLength(25);
      expect(plan.connections[0]!.pairStatus).toBe('working');
      expect(plan.connections[1]!.pairStatus).toBe('spare');
      expect(plan.connections[2]!.pairStatus).toBe('bridged');
      expect(plan.connections[3]!.pairStatus).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('no issues on valid straight splice', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-v1',
        operationType: 'straight',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
      });

      const issues = validateSplicePlan(plan);
      expect(issues).toHaveLength(0);
    });

    it('catches insufficient cable ends', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-v2',
        operationType: 'straight',
        cables: [makeCopperCable('A', 25)],
        cableEnds: [makeEnd('A', 1, 25)],
      });

      expect(plan.status).toBe('blocked');
      expect(plan.issues.some(i => i.code === 'INSUFFICIENT_CABLE_ENDS')).toBe(true);
    });
  });

  describe('text/diagram parity (spec rule 9)', () => {
    it('text rows and diagram edges have matching connection IDs', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'case-p1',
        operationType: 'straight',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
      });

      const text = renderText(plan);
      const diagram = renderDiagram(plan);

      const textIds = new Set(text.rows.map(r => r.connectionId));
      const diagramIds = new Set(diagram.edges.map(e => e.connectionId));

      expect(textIds.size).toBe(25);
      expect(diagramIds.size).toBe(25);

      // Every text row ID must appear in diagram edges
      for (const id of textIds) {
        expect(diagramIds.has(id)).toBe(true);
      }
      // Every diagram edge ID must appear in text rows
      for (const id of diagramIds) {
        expect(textIds.has(id)).toBe(true);
      }
    });
  });
});
