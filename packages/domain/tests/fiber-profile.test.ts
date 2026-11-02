import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  fiberTia598_12,
  registerProfile,
  clearRegistry,
} from '../src/index.js';
import {
  getFiberColor,
  getTubeColor,
  FIBER_COLORS,
} from '../src/profiles/fiber-tia598-12.js';
import type { CableContext } from '../src/profiles/registry.js';

function makeContext(nominalCount: number, construction?: string): CableContext {
  return {
    cableId: 'fiber-cable',
    segmentId: 'seg-1',
    sheathId: 'FO-200',
    nominalCount,
    orientation: { end: 'A', physicalDirection: 'ascending', reversed: false },
    construction,
  };
}

describe('Fiber TIA-598 12-Color Profile', () => {
  beforeEach(() => {
    registerProfile(fiberTia598_12);
  });
  afterEach(() => {
    clearRegistry();
  });

  describe('color sequence', () => {
    it('baseline 12-color sequence matches spec', () => {
      const expected = ['Blue', 'Orange', 'Green', 'Brown', 'Slate', 'White',
                        'Red', 'Black', 'Yellow', 'Violet', 'Rose', 'Aqua'];
      for (let i = 0; i < 12; i++) {
        expect(FIBER_COLORS[i]!.name).toBe(expected[i]);
      }
    });

    it('fiber 1 in tube is Blue', () => {
      expect(getFiberColor(1).name).toBe('Blue');
    });

    it('fiber 12 in tube is Aqua', () => {
      expect(getFiberColor(12).name).toBe('Aqua');
    });

    it('tube 1 is Blue', () => {
      expect(getTubeColor(1).name).toBe('Blue');
    });

    it('tube 12 is Aqua', () => {
      expect(getTubeColor(12).name).toBe('Aqua');
    });

    it('tube 13 is Blue (cycle 2)', () => {
      expect(getTubeColor(13).name).toBe('Blue (cycle 2)');
    });
  });

  describe('endpoint resolution', () => {
    it('fiber 1 in 12F cable', () => {
      const result = fiberTia598_12.resolveEndpoint(1, makeContext(12));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.physicalPosition).toBe(1);
        expect(result.identity.colorIdentity.name).toBe('Blue');
        expect(result.identity.structurePath[0]).toContain('Tube 1');
      }
    });

    it('fiber 12 in 12F cable', () => {
      const result = fiberTia598_12.resolveEndpoint(12, makeContext(12));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.colorIdentity.name).toBe('Aqua');
      }
    });

    it('fiber 13 in 24F cable (tube 2, fiber 1)', () => {
      const result = fiberTia598_12.resolveEndpoint(13, makeContext(24));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.physicalPosition).toBe(13);
        expect(result.identity.colorIdentity.name).toBe('Blue');
        expect(result.identity.structurePath[0]).toContain('Tube 2');
      }
    });

    it('fiber 24 in 24F cable (tube 2, fiber 12)', () => {
      const result = fiberTia598_12.resolveEndpoint(24, makeContext(24));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.colorIdentity.name).toBe('Aqua');
        expect(result.identity.structurePath[0]).toContain('Tube 2');
      }
    });

    it('fiber 144 in 144F cable (tube 12, fiber 12)', () => {
      const result = fiberTia598_12.resolveEndpoint(144, makeContext(144));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.physicalPosition).toBe(144);
        expect(result.identity.colorIdentity.name).toBe('Aqua');
        expect(result.identity.structurePath[0]).toContain('Tube 12');
      }
    });

    it('fiber 145 in 864F cable (tube 13, fiber 1, color cycle 2)', () => {
      const result = fiberTia598_12.resolveEndpoint(145, makeContext(864));
      expect('identity' in result).toBe(true);
      if ('identity' in result) {
        expect(result.identity.colorIdentity.name).toBe('Blue');
        expect(result.identity.structurePath[0]).toContain('Tube 13');
      }
    });
  });

  describe('boundary cases', () => {
    it('rejects position 0', () => {
      const result = fiberTia598_12.resolveEndpoint(0, makeContext(12));
      expect('severity' in result).toBe(true);
    });

    it('rejects position beyond capacity', () => {
      const result = fiberTia598_12.resolveEndpoint(13, makeContext(12));
      expect('severity' in result).toBe(true);
      if ('severity' in result) {
        expect(result.code).toBe('OUT_OF_RANGE');
      }
    });
  });

  describe('group boundaries', () => {
    it('12F cable has 1 tube', () => {
      const bounds = fiberTia598_12.groupBoundaries(makeContext(12));
      expect(bounds).toHaveLength(1);
      expect(bounds[0]!.startPosition).toBe(1);
      expect(bounds[0]!.endPosition).toBe(12);
    });

    it('144F cable has 12 tubes', () => {
      const bounds = fiberTia598_12.groupBoundaries(makeContext(144));
      expect(bounds).toHaveLength(12);
      expect(bounds[11]!.endPosition).toBe(144);
    });

    it('864F cable has 72 tubes', () => {
      const bounds = fiberTia598_12.groupBoundaries(makeContext(864));
      expect(bounds).toHaveLength(72);
      expect(bounds[71]!.endPosition).toBe(864);
    });
  });
});
