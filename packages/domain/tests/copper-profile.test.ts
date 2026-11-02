import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  copperStandard25,
  registerProfile,
  clearRegistry,
} from '../src/index.js';
import {
  getTipColor,
  getRingColor,
  getPairColorName,
  getBinderLabel,
} from '../src/profiles/copper-standard-25.js';
import type { CableContext } from '../src/profiles/registry.js';

function makeContext(nominalCount: number): CableContext {
  return {
    cableId: 'test-cable',
    segmentId: 'seg-1',
    sheathId: 'CA-100',
    nominalCount,
    orientation: { end: 'A', physicalDirection: 'ascending', reversed: false },
  };
}

describe('Copper Standard 25-Pair Profile', () => {
  beforeEach(() => {
    registerProfile(copperStandard25);
  });
  afterEach(() => {
    clearRegistry();
  });

  describe('color code correctness', () => {
    it('pair 1 is White-Blue', () => {
      expect(getPairColorName(1)).toBe('White-Blue');
    });

    it('pair 5 is White-Slate', () => {
      expect(getPairColorName(5)).toBe('White-Slate');
    });

    it('pair 6 is Red-Blue', () => {
      expect(getPairColorName(6)).toBe('Red-Blue');
    });

    it('pair 25 is Violet-Slate', () => {
      expect(getPairColorName(25)).toBe('Violet-Slate');
    });

    it('tip colors cycle: White(1-5), Red(6-10), Black(11-15), Yellow(16-20), Violet(21-25)', () => {
      expect(getTipColor(1).name).toBe('White');
      expect(getTipColor(5).name).toBe('White');
      expect(getTipColor(6).name).toBe('Red');
      expect(getTipColor(10).name).toBe('Red');
      expect(getTipColor(11).name).toBe('Black');
      expect(getTipColor(15).name).toBe('Black');
      expect(getTipColor(16).name).toBe('Yellow');
      expect(getTipColor(20).name).toBe('Yellow');
      expect(getTipColor(21).name).toBe('Violet');
      expect(getTipColor(25).name).toBe('Violet');
    });

    it('ring colors cycle: Blue, Orange, Green, Brown, Slate', () => {
      expect(getRingColor(1).name).toBe('Blue');
      expect(getRingColor(2).name).toBe('Orange');
      expect(getRingColor(3).name).toBe('Green');
      expect(getRingColor(4).name).toBe('Brown');
      expect(getRingColor(5).name).toBe('Slate');
      // Cycle repeats
      expect(getRingColor(6).name).toBe('Blue');
    });

    it('binder 1 is White-Blue, binder 25 is Violet-Slate', () => {
      expect(getBinderLabel(1)).toBe('White-Blue');
      expect(getBinderLabel(25)).toBe('Violet-Slate');
    });
  });

  describe('endpoint resolution', () => {
    it('resolves pair 1 in a 25-pair cable', () => {
      const result = copperStandard25.resolveEndpoint(1, makeContext(25));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.physicalPosition).toBe(1);
        expect(result.identity.colorIdentity.name).toBe('White-Blue');
        expect(result.identity.tipRing?.tip.name).toBe('White');
        expect(result.identity.tipRing?.ring.name).toBe('Blue');
        expect(result.identity.structurePath).toContain('Binder 1 (White-Blue)');
      }
    });

    it('resolves pair 26 in a 50-pair cable (second binder)', () => {
      const result = copperStandard25.resolveEndpoint(26, makeContext(50));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.physicalPosition).toBe(26);
        expect(result.identity.colorIdentity.name).toBe('White-Blue');
        expect(result.identity.structurePath).toContain('Binder 2 (White-Orange)');
      }
    });

    it('resolves pair 50 correctly', () => {
      const result = copperStandard25.resolveEndpoint(50, makeContext(50));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.physicalPosition).toBe(50);
        expect(result.identity.colorIdentity.name).toBe('Violet-Slate');
        expect(result.identity.structurePath).toContain('Binder 2 (White-Orange)');
      }
    });

    it('resolves pair 600 in a 600-pair cable', () => {
      const result = copperStandard25.resolveEndpoint(600, makeContext(600));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.physicalPosition).toBe(600);
        // Pair 600: binder 24, pair 25 in group
        expect(result.identity.colorIdentity.name).toBe('Violet-Slate');
      }
    });

    it('resolves pair 601 in a 900-pair cable (enters super-binder 2 territory)', () => {
      const result = copperStandard25.resolveEndpoint(601, makeContext(900));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.physicalPosition).toBe(601);
        expect(result.identity.colorIdentity.name).toBe('White-Blue');
      }
    });
  });

  describe('boundary cases', () => {
    it('rejects position 0', () => {
      const result = copperStandard25.resolveEndpoint(0, makeContext(25));
      expect('severity' in result).toBe(true);
      if ('severity' in result) {
        expect(result.code).toBe('INVALID_POSITION');
      }
    });

    it('rejects negative position', () => {
      const result = copperStandard25.resolveEndpoint(-1, makeContext(25));
      expect('severity' in result).toBe(true);
    });

    it('rejects position beyond cable capacity', () => {
      const result = copperStandard25.resolveEndpoint(26, makeContext(25));
      expect('severity' in result).toBe(true);
      if ('severity' in result) {
        expect(result.code).toBe('OUT_OF_RANGE');
      }
    });

    it('rejects non-integer position', () => {
      const result = copperStandard25.resolveEndpoint(1.5, makeContext(25));
      expect('severity' in result).toBe(true);
    });
  });

  describe('group boundaries', () => {
    it('25-pair cable has 1 binder', () => {
      const bounds = copperStandard25.groupBoundaries(makeContext(25));
      expect(bounds).toHaveLength(1);
      expect(bounds[0]!.startPosition).toBe(1);
      expect(bounds[0]!.endPosition).toBe(25);
    });

    it('50-pair cable has 2 binders', () => {
      const bounds = copperStandard25.groupBoundaries(makeContext(50));
      expect(bounds).toHaveLength(2);
      expect(bounds[0]!.endPosition).toBe(25);
      expect(bounds[1]!.startPosition).toBe(26);
      expect(bounds[1]!.endPosition).toBe(50);
    });

    it('600-pair cable has 24 binders', () => {
      const bounds = copperStandard25.groupBoundaries(makeContext(600));
      expect(bounds).toHaveLength(24);
      expect(bounds[23]!.endPosition).toBe(600);
    });
  });

  describe('total capacity', () => {
    it('returns nominal count', () => {
      expect(copperStandard25.totalCapacity(makeContext(100))).toBe(100);
    });
  });
});
