import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildAccountingSummary,
  validateAccounting,
  registerProfile,
  clearRegistry,
  copperStandard25,
  fiberTia598_12,
  buildSplicePlan,
} from '../src/index.js';
import type { Cable, CableEnd, CableElement } from '../src/index.js';

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

describe('Connection Accounting Engine', () => {
  beforeEach(() => {
    registerProfile(copperStandard25);
    registerProfile(fiberTia598_12);
  });
  afterEach(() => {
    clearRegistry();
  });

  describe('buildAccountingSummary', () => {
    it('25-pair cable, all assigned: all planned, 0 unassigned', () => {
      const cableA = makeCopperCable('A', 25);
      const cableB = makeCopperCable('B', 25);
      const plan = buildSplicePlan({
        spliceCaseId: 'case-acct-1',
        operationType: 'straight',
        cables: [cableA, cableB],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
      });

      const summary = buildAccountingSummary(cableA, plan.connections);

      expect(summary.totalElements).toBe(25);
      expect(summary.byState['planned']).toBe(25);
      expect(summary.byState['unassigned']).toBe(0);
      expect(summary.byAssignment['assigned']).toBe(25);
      expect(summary.byAssignment['unassigned']).toBe(0);
    });

    it('50-pair cable, 25 assigned: 25 planned, 25 unassigned', () => {
      const cableA = makeCopperCable('A', 50);
      const cableB = makeCopperCable('B', 25);
      const plan = buildSplicePlan({
        spliceCaseId: 'case-acct-2',
        operationType: 'straight',
        cables: [cableA, cableB],
        cableEnds: [makeEnd('A', 1, 50), makeEnd('B', 1, 25)],
      });

      const summary = buildAccountingSummary(cableA, plan.connections);

      expect(summary.totalElements).toBe(50);
      expect(summary.byState['planned']).toBe(25);
      expect(summary.byState['unassigned']).toBe(25);
      expect(summary.byAssignment['assigned']).toBe(25);
      expect(summary.byAssignment['unassigned']).toBe(25);
    });

    it('cable with 3 damaged, 2 reserved via overrides', () => {
      const cable = makeCopperCable('C', 25);
      const plan = buildSplicePlan({
        spliceCaseId: 'case-acct-3',
        operationType: 'straight',
        cables: [cable, makeCopperCable('D', 25)],
        cableEnds: [makeEnd('C', 1, 25), makeEnd('D', 1, 25)],
      });

      const overrides = new Map<number, Partial<CableElement>>();
      // Mark positions 1-3 as damaged
      overrides.set(1, { elementState: 'damaged', condition: 'damaged', assignment: 'unassigned' });
      overrides.set(2, { elementState: 'damaged', condition: 'damaged', assignment: 'unassigned' });
      overrides.set(3, { elementState: 'damaged', condition: 'damaged', assignment: 'unassigned' });
      // Mark positions 4-5 as reserved
      overrides.set(4, { elementState: 'reserved', condition: 'good', assignment: 'reserved' });
      overrides.set(5, { elementState: 'reserved', condition: 'good', assignment: 'reserved' });

      const summary = buildAccountingSummary(cable, plan.connections, overrides);

      expect(summary.totalElements).toBe(25);
      expect(summary.byState['damaged']).toBe(3);
      expect(summary.byState['reserved']).toBe(2);
      expect(summary.byState['planned']).toBe(20); // remaining 20 have connections
      expect(summary.byCondition['damaged']).toBe(3);
      expect(summary.byAssignment['reserved']).toBe(2);
      expect(summary.byAssignment['unassigned']).toBe(3); // the damaged ones
    });

    it('fiber cable with express (pass-through) elements', () => {
      const cable = makeFiberCable('F1', 24);
      const plan = buildSplicePlan({
        spliceCaseId: 'case-acct-4',
        operationType: 'straight',
        cables: [cable, makeFiberCable('F2', 24)],
        cableEnds: [makeEnd('F1', 1, 24), makeEnd('F2', 1, 24)],
      });

      const overrides = new Map<number, Partial<CableElement>>();
      // Mark fibers 13-24 as express/pass-through
      for (let i = 13; i <= 24; i++) {
        overrides.set(i, { elementState: 'express', condition: 'good', assignment: 'pass-through' });
      }

      const summary = buildAccountingSummary(cable, plan.connections, overrides);

      expect(summary.totalElements).toBe(24);
      expect(summary.byState['express']).toBe(12);
      expect(summary.byState['planned']).toBe(12);
      expect(summary.byAssignment['pass-through']).toBe(12);
      expect(summary.byAssignment['assigned']).toBe(12);
    });

    it('invariant: state counts always sum to totalElements', () => {
      const cable = makeCopperCable('inv', 50);
      const plan = buildSplicePlan({
        spliceCaseId: 'case-acct-inv',
        operationType: 'straight',
        cables: [cable, makeCopperCable('inv2', 30)],
        cableEnds: [makeEnd('inv', 1, 50), makeEnd('inv2', 1, 30)],
      });

      const overrides = new Map<number, Partial<CableElement>>();
      overrides.set(35, { elementState: 'abandoned', condition: 'unknown', assignment: 'unassigned' });
      overrides.set(40, { elementState: 'damaged', condition: 'damaged', assignment: 'unassigned' });

      const summary = buildAccountingSummary(cable, plan.connections, overrides);

      const stateSum = Object.values(summary.byState).reduce((a, b) => a + b, 0);
      const assignmentSum = Object.values(summary.byAssignment).reduce((a, b) => a + b, 0);
      const conditionSum = Object.values(summary.byCondition).reduce((a, b) => a + b, 0);

      expect(stateSum).toBe(summary.totalElements);
      expect(assignmentSum).toBe(summary.totalElements);
      expect(conditionSum).toBe(summary.totalElements);
    });

    it('empty connections: all unassigned', () => {
      const cable = makeCopperCable('empty', 25);
      const summary = buildAccountingSummary(cable, []);

      expect(summary.totalElements).toBe(25);
      expect(summary.byState['unassigned']).toBe(25);
      expect(summary.byAssignment['unassigned']).toBe(25);
      expect(summary.byCondition['unknown']).toBe(25);
      expect(summary.unresolvedCount).toBe(25);
    });
  });

  describe('validateAccounting', () => {
    it('no issues on fully assigned cable', () => {
      const cable = makeCopperCable('V1', 25);
      const plan = buildSplicePlan({
        spliceCaseId: 'case-val-1',
        operationType: 'straight',
        cables: [cable, makeCopperCable('V2', 25)],
        cableEnds: [makeEnd('V1', 1, 25), makeEnd('V2', 1, 25)],
      });

      const summary = buildAccountingSummary(cable, plan.connections);
      const issues = validateAccounting(summary);

      // No errors, but no warnings since unresolved = 0
      const errors = issues.filter(i => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    it('warns on unresolved elements', () => {
      const cable = makeCopperCable('V3', 50);
      const plan = buildSplicePlan({
        spliceCaseId: 'case-val-2',
        operationType: 'straight',
        cables: [cable, makeCopperCable('V4', 25)],
        cableEnds: [makeEnd('V3', 1, 50), makeEnd('V4', 1, 25)],
      });

      const summary = buildAccountingSummary(cable, plan.connections);
      const issues = validateAccounting(summary);

      const warnings = issues.filter(i => i.code === 'ACCOUNTING_UNRESOLVED_ELEMENTS');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain('25');
    });

    it('detects damaged elements that are assigned', () => {
      const cable = makeCopperCable('V5', 25);
      const plan = buildSplicePlan({
        spliceCaseId: 'case-val-3',
        operationType: 'straight',
        cables: [cable, makeCopperCable('V6', 25)],
        cableEnds: [makeEnd('V5', 1, 25), makeEnd('V6', 1, 25)],
      });

      // Mark some as damaged but keep them as assigned (invalid state)
      const overrides = new Map<number, Partial<CableElement>>();
      overrides.set(1, { elementState: 'damaged', condition: 'damaged', assignment: 'assigned' });
      overrides.set(2, { elementState: 'damaged', condition: 'damaged', assignment: 'assigned' });
      overrides.set(3, { elementState: 'abandoned', condition: 'damaged', assignment: 'assigned' });

      const summary = buildAccountingSummary(cable, plan.connections, overrides);
      const issues = validateAccounting(summary);

      const damageErrors = issues.filter(i => i.code === 'ACCOUNTING_DAMAGED_ASSIGNED');
      expect(damageErrors).toHaveLength(1);
    });
  });
});
