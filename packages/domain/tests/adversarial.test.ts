import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildSplicePlan,
  registerProfile,
  clearRegistry,
  copperStandard25,
  fiberTia598_12,
  resolveEndpoint,
  renderText,
} from '../src/index.js';
import { exportCSV } from '../../export-engine/src/index.js';
import type { Cable, CableEnd } from '../src/index.js';

// ── Helpers (mirror splice-plan.test.ts patterns) ──

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

function makeFiberCable(id: string, count: number, construction?: string): Cable {
  return {
    id,
    media: 'fiber',
    nominalCount: count,
    countProfileId: 'fiber-tia598-12',
    countProfileVersion: '1.0.0',
    sheathId: `FO-${id}`,
    orientation: { end: 'A', physicalDirection: 'ascending', reversed: false },
    construction,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

function makeEnd(cableId: string, start: number, end: number, role: CableEnd['role'] = 'peer'): CableEnd {
  return { id: `end-${cableId}`, cableId, role, rangeStart: start, rangeEnd: end };
}

describe('Adversarial Accuracy Tests', () => {
  beforeEach(() => {
    registerProfile(copperStandard25);
    registerProfile(fiberTia598_12);
  });
  afterEach(() => {
    clearRegistry();
  });

  // ── CASE 1: Count mismatch detection ──
  describe('CASE 1: Count mismatch detection (300 vs 200 pair)', () => {
    it('generates capacity mismatch warning', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-1',
        operationType: 'straight',
        cables: [makeCopperCable('A', 300), makeCopperCable('B', 200)],
        cableEnds: [makeEnd('A', 1, 300), makeEnd('B', 1, 200)],
      });

      expect(plan.issues.some(i => i.code === 'CAPACITY_MISMATCH')).toBe(true);
    });

    it('produces exactly 200 connections (min of both counts)', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-1b',
        operationType: 'straight',
        cables: [makeCopperCable('A', 300), makeCopperCable('B', 200)],
        cableEnds: [makeEnd('A', 1, 300), makeEnd('B', 1, 200)],
      });

      expect(plan.connections).toHaveLength(200);
    });

    it('reports 100 unassigned source endpoints', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-1c',
        operationType: 'straight',
        cables: [makeCopperCable('A', 300), makeCopperCable('B', 200)],
        cableEnds: [makeEnd('A', 1, 300), makeEnd('B', 1, 200)],
      });

      expect(plan.unassignedSource).toHaveLength(100);
      expect(plan.unassignedTarget).toHaveLength(0);
    });
  });

  // ── CASE 2: Fiber with unspecified tube structure ──
  describe('CASE 2: Fiber with undefined construction (144F)', () => {
    it('defaults to 12F/tube and resolves all 144 endpoints', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-2',
        operationType: 'straight',
        cables: [
          makeFiberCable('F1', 144, undefined),
          makeFiberCable('F2', 144, undefined),
        ],
        cableEnds: [makeEnd('F1', 1, 144), makeEnd('F2', 1, 144)],
      });

      expect(plan.connections).toHaveLength(144);
      expect(plan.unassignedSource).toHaveLength(0);
      expect(plan.unassignedTarget).toHaveLength(0);
    });

    it('assigns tube structure correctly without construction hint', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-2b',
        operationType: 'straight',
        cables: [
          makeFiberCable('F1', 144, undefined),
          makeFiberCable('F2', 144, undefined),
        ],
        cableEnds: [makeEnd('F1', 1, 144), makeEnd('F2', 1, 144)],
      });

      // Fiber 1 should be in Tube 1
      expect(plan.connections[0]!.sourceEndpoint.structurePath[0]).toContain('Tube 1');
      // Fiber 12 should be in Tube 1 (last in tube)
      expect(plan.connections[11]!.sourceEndpoint.structurePath[0]).toContain('Tube 1');
      // Fiber 13 should be in Tube 2 (first of next tube)
      expect(plan.connections[12]!.sourceEndpoint.structurePath[0]).toContain('Tube 2');
      // Fiber 144 should be in Tube 12
      expect(plan.connections[143]!.sourceEndpoint.structurePath[0]).toContain('Tube 12');
    });
  });

  // ── CASE 3: Duplicate destination in remap ──
  describe('CASE 3: Duplicate destination in remap crosswalk', () => {
    it('catches duplicate target when positions 1 and 2 both map to position 5', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-3',
        operationType: 'remap',
        cables: [makeCopperCable('A', 25), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
        crosswalk: {
          id: 'cw-dup',
          sourceProfileId: 'copper-standard-25',
          targetProfileId: 'copper-standard-25',
          entries: [
            { sourcePosition: 1, targetPosition: 5, verified: true },
            { sourcePosition: 2, targetPosition: 5, verified: true },
          ],
          provenance: 'Adversarial test: duplicate target',
          version: '1.0.0',
        },
      });

      expect(plan.issues.some(i => i.code === 'DUPLICATE_TARGET')).toBe(true);
      // Only first mapping should be accepted
      expect(plan.connections).toHaveLength(1);
      expect(plan.connections[0]!.sourceEndpoint.physicalPosition).toBe(1);
      expect(plan.connections[0]!.targetEndpoint.physicalPosition).toBe(5);
    });
  });

  // ── CASE 4: Cable orientation reversal ──
  describe('CASE 4: Cable orientation reversal', () => {
    it('pair 1 of A maps to pair 25 of reversed B', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-4',
        operationType: 'straight',
        cables: [
          makeCopperCable('A', 25, false),
          makeCopperCable('B', 25, true),  // reversed
        ],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
      });

      expect(plan.connections).toHaveLength(25);

      // Source pair 1 (White-Blue) connects to target pair 25 (Violet-Slate)
      // because B is reversed: position 1 normalizes to 25, position 25 normalizes to 1
      const first = plan.connections[0]!;
      expect(first.sourceEndpoint.physicalPosition).toBe(1);
      expect(first.sourceEndpoint.colorIdentity.name).toBe('White-Blue');

      // The target's physical position should be 25 due to reversal
      expect(first.targetEndpoint.physicalPosition).toBe(25);
      expect(first.targetEndpoint.colorIdentity.name).toBe('Violet-Slate');
    });

    it('last connection has correct reversed identity', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-4b',
        operationType: 'straight',
        cables: [
          makeCopperCable('A', 25, false),
          makeCopperCable('B', 25, true),
        ],
        cableEnds: [makeEnd('A', 1, 25), makeEnd('B', 1, 25)],
      });

      const last = plan.connections[24]!;
      expect(last.sourceEndpoint.physicalPosition).toBe(25);
      expect(last.sourceEndpoint.colorIdentity.name).toBe('Violet-Slate');
      // Target position 1 (after reversal of end position 25)
      expect(last.targetEndpoint.physicalPosition).toBe(1);
      expect(last.targetEndpoint.colorIdentity.name).toBe('White-Blue');
    });
  });

  // ── CASE 5: Export integrity ──
  describe('CASE 5: Export integrity (100 connections -> 100 CSV rows)', () => {
    it('CSV has exactly 100 data rows plus 1 header', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-5',
        operationType: 'straight',
        cables: [makeCopperCable('A', 100), makeCopperCable('B', 100)],
        cableEnds: [makeEnd('A', 1, 100), makeEnd('B', 1, 100)],
      });

      expect(plan.connections).toHaveLength(100);

      const csv = exportCSV(plan);
      const lines = csv.content.split('\n');
      // First line is header, rest are data rows
      expect(lines).toHaveLength(101); // 1 header + 100 data
    });

    it('text schedule also has exactly 100 rows', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-5b',
        operationType: 'straight',
        cables: [makeCopperCable('A', 100), makeCopperCable('B', 100)],
        cableEnds: [makeEnd('A', 1, 100), makeEnd('B', 1, 100)],
      });

      const text = renderText(plan);
      expect(text.rows).toHaveLength(100);
    });
  });

  // ── CASE 6: Profile always disambiguates with position ──
  describe('CASE 6: Repeated colors are disambiguated by group + position', () => {
    it('pair 1 and pair 26 both have White-Blue color but different binder and position', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-6',
        operationType: 'straight',
        cables: [makeCopperCable('A', 50), makeCopperCable('B', 50)],
        cableEnds: [makeEnd('A', 1, 50), makeEnd('B', 1, 50)],
      });

      const conn1 = plan.connections[0]!;   // pair 1
      const conn26 = plan.connections[25]!;  // pair 26

      // Both have the same color name (White-Blue)
      expect(conn1.sourceEndpoint.colorIdentity.name).toBe('White-Blue');
      expect(conn26.sourceEndpoint.colorIdentity.name).toBe('White-Blue');

      // But they are disambiguated by physical position
      expect(conn1.sourceEndpoint.physicalPosition).toBe(1);
      expect(conn26.sourceEndpoint.physicalPosition).toBe(26);

      // And by structure path (different binder groups)
      expect(conn1.sourceEndpoint.structurePath[0]).toContain('Binder 1');
      expect(conn26.sourceEndpoint.structurePath[0]).toContain('Binder 2');
    });

    it('fiber colors repeat every 12 but tube distinguishes them', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-6b',
        operationType: 'straight',
        cables: [makeFiberCable('F1', 24), makeFiberCable('F2', 24)],
        cableEnds: [makeEnd('F1', 1, 24), makeEnd('F2', 1, 24)],
      });

      const fiber1 = plan.connections[0]!.sourceEndpoint;   // fiber 1
      const fiber13 = plan.connections[12]!.sourceEndpoint;  // fiber 13

      // Both are "Blue"
      expect(fiber1.colorIdentity.name).toBe('Blue');
      expect(fiber13.colorIdentity.name).toBe('Blue');

      // But different tube
      expect(fiber1.structurePath[0]).toContain('Tube 1');
      expect(fiber13.structurePath[0]).toContain('Tube 2');

      // And different physical position
      expect(fiber1.physicalPosition).toBe(1);
      expect(fiber13.physicalPosition).toBe(13);
    });
  });

  // ── CASE 7: Nonexistent fiber number ──
  describe('CASE 7: Nonexistent fiber number (position 145 on 144F cable)', () => {
    it('returns validation error, not a crash', () => {
      const context = {
        cableId: 'F-test',
        segmentId: 'default',
        sheathId: 'FO-test',
        nominalCount: 144,
        orientation: { end: 'A' as const, physicalDirection: 'ascending' as const, reversed: false },
      };

      const result = resolveEndpoint(
        'fiber-tia598-12',
        '1.0.0',
        145,
        context,
      );

      // Should be a ValidationIssue, not a ResolvedEndpoint
      expect('severity' in result).toBe(true);
      if ('severity' in result) {
        expect(result.severity).toBe('error');
        expect(result.code).toBe('OUT_OF_RANGE');
      }
    });

    it('splice plan collects out-of-range as issue, not crash', () => {
      // Build a plan where range exceeds cable capacity
      // The resolveEndpoints function should filter out errors
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-7b',
        operationType: 'straight',
        cables: [makeFiberCable('F1', 144), makeFiberCable('F2', 144)],
        cableEnds: [makeEnd('F1', 1, 150), makeEnd('F2', 1, 144)],
      });

      // Positions 145-150 should produce errors, not crashes
      // The plan should still have 144 valid connections
      expect(plan.connections).toHaveLength(144);
      // There should be issues for the out-of-range positions
      expect(plan.issues.some(i => i.code === 'OUT_OF_RANGE')).toBe(true);
    });
  });

  // ── CASE 8: Zero-pair cable ──
  describe('CASE 8: Zero-pair cable', () => {
    it('produces error with no connections', () => {
      const plan = buildSplicePlan({
        spliceCaseId: 'adv-8',
        operationType: 'straight',
        cables: [makeCopperCable('A', 0), makeCopperCable('B', 25)],
        cableEnds: [makeEnd('A', 1, 0), makeEnd('B', 1, 25)],
      });

      expect(plan.connections).toHaveLength(0);
      // Should have some kind of error or warning about the zero-count cable
      expect(plan.issues.length).toBeGreaterThan(0);
    });
  });
});
