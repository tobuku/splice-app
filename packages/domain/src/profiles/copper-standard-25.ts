import type {
  ResolvedEndpoint,
  GroupBoundary,
  ValidationIssue,
  ColorIdentity,
} from '../models/index.js';
import type { CountProfile, CableContext } from './registry.js';

// ── Standard 25-Pair Color Code ──
// Major (tip): White, Red, Black, Yellow, Violet
// Minor (ring): Blue, Orange, Green, Brown, Slate
// 5 major x 5 minor = 25 unique pair colors per binder group

const MAJOR_COLORS: ColorIdentity[] = [
  { name: 'White',  hexValue: '#FFFFFF', position: 1 },
  { name: 'Red',    hexValue: '#FF0000', position: 2 },
  { name: 'Black',  hexValue: '#000000', position: 3 },
  { name: 'Yellow', hexValue: '#FFFF00', position: 4 },
  { name: 'Violet', hexValue: '#8B00FF', position: 5 },
];

const MINOR_COLORS: ColorIdentity[] = [
  { name: 'Blue',   hexValue: '#0000FF', position: 1 },
  { name: 'Orange', hexValue: '#FF8000', position: 2 },
  { name: 'Green',  hexValue: '#008000', position: 3 },
  { name: 'Brown',  hexValue: '#8B4513', position: 4 },
  { name: 'Slate',  hexValue: '#708090', position: 5 },
];

// Binder group colors use the same major/minor sequence
// Binder 1: White-Blue, Binder 2: White-Orange, ... Binder 25: Violet-Slate
// Super-binder (600-pair) uses the same sequence at the next level

const PAIRS_PER_GROUP = 25;
const GROUPS_PER_BINDER = 25;  // max 25 groups = 625 pairs per super-unit
const PAIRS_PER_SUPER = PAIRS_PER_GROUP * GROUPS_PER_BINDER; // 625

export function getTipColor(pairInGroup: number): ColorIdentity {
  // pairInGroup: 1-25
  const majorIndex = Math.floor((pairInGroup - 1) / 5);
  return MAJOR_COLORS[majorIndex]!;
}

export function getRingColor(pairInGroup: number): ColorIdentity {
  // pairInGroup: 1-25
  const minorIndex = (pairInGroup - 1) % 5;
  return MINOR_COLORS[minorIndex]!;
}

export function getBinderColor(binderInSuper: number): { major: ColorIdentity; minor: ColorIdentity } {
  // binderInSuper: 1-25
  const majorIndex = Math.floor((binderInSuper - 1) / 5);
  const minorIndex = (binderInSuper - 1) % 5;
  return {
    major: MAJOR_COLORS[majorIndex]!,
    minor: MINOR_COLORS[minorIndex]!,
  };
}

export function getPairColorName(pairInGroup: number): string {
  const tip = getTipColor(pairInGroup);
  const ring = getRingColor(pairInGroup);
  return `${tip.name}-${ring.name}`;
}

export function getBinderLabel(binderNumber: number): string {
  const { major, minor } = getBinderColor(binderNumber);
  return `${major.name}-${minor.name}`;
}

function resolvePosition(position: number): {
  superBinder: number;
  binderInSuper: number;
  pairInGroup: number;
  binderAbsolute: number;
} {
  const zeroPos = position - 1;
  const superBinder = Math.floor(zeroPos / PAIRS_PER_SUPER) + 1;
  const posInSuper = zeroPos % PAIRS_PER_SUPER;
  const binderInSuper = Math.floor(posInSuper / PAIRS_PER_GROUP) + 1;
  const pairInGroup = (posInSuper % PAIRS_PER_GROUP) + 1;
  const binderAbsolute = (superBinder - 1) * GROUPS_PER_BINDER + binderInSuper;
  return { superBinder, binderInSuper, pairInGroup, binderAbsolute };
}

export const copperStandard25: CountProfile = {
  id: 'copper-standard-25',
  version: '1.0.0',
  medium: 'copper',
  provenance: 'Standard North American 25-pair color code per 7 CFR 1755.200',

  resolveEndpoint(position: number, context: CableContext): ResolvedEndpoint | ValidationIssue {
    if (!Number.isInteger(position) || position < 1) {
      return {
        severity: 'error',
        code: 'INVALID_POSITION',
        message: `Position must be a positive integer, got ${position}`,
        cableId: context.cableId,
        profileId: this.id,
        position,
      };
    }
    if (position > context.nominalCount) {
      return {
        severity: 'error',
        code: 'OUT_OF_RANGE',
        message: `Position ${position} exceeds cable capacity of ${context.nominalCount} pairs`,
        cableId: context.cableId,
        profileId: this.id,
        position,
      };
    }

    const { binderInSuper, pairInGroup, binderAbsolute, superBinder } = resolvePosition(position);
    const tip = getTipColor(pairInGroup);
    const ring = getRingColor(pairInGroup);
    const binderCol = getBinderColor(binderInSuper);

    const structurePath: string[] = [];
    if (context.nominalCount > PAIRS_PER_SUPER) {
      structurePath.push(`Super ${superBinder}`);
    }
    structurePath.push(`Binder ${binderAbsolute} (${binderCol.major.name}-${binderCol.minor.name})`);

    return {
      identity: {
        cableId: context.cableId,
        segmentId: context.segmentId,
        structurePath,
        physicalPosition: position,
        localLabel: String(position),
        colorIdentity: {
          name: `${tip.name}-${ring.name}`,
          hexValue: tip.hexValue,
          position: pairInGroup,
        },
        tipRing: { tip, ring },
      },
      profileId: this.id,
      profileVersion: this.version,
    };
  },

  totalCapacity(context: CableContext): number {
    return context.nominalCount;
  },

  groupBoundaries(context: CableContext): GroupBoundary[] {
    const boundaries: GroupBoundary[] = [];
    const totalPairs = context.nominalCount;
    const totalBinders = Math.ceil(totalPairs / PAIRS_PER_GROUP);

    for (let b = 1; b <= totalBinders; b++) {
      const start = (b - 1) * PAIRS_PER_GROUP + 1;
      const end = Math.min(b * PAIRS_PER_GROUP, totalPairs);
      const binderInSuper = ((b - 1) % GROUPS_PER_BINDER) + 1;
      const binderCol = getBinderColor(binderInSuper);
      const superBinder = Math.floor((b - 1) / GROUPS_PER_BINDER) + 1;
      const parentGroupId = totalPairs > PAIRS_PER_SUPER ? `super-${superBinder}` : undefined;

      boundaries.push({
        groupId: `binder-${b}`,
        groupLabel: `Binder ${b} (${binderCol.major.name}-${binderCol.minor.name})`,
        startPosition: start,
        endPosition: end,
        colorIdentity: {
          name: `${binderCol.major.name}-${binderCol.minor.name}`,
          hexValue: binderCol.major.hexValue,
          position: binderInSuper,
        },
        parentGroupId,
      });
    }

    return boundaries;
  },
};

// Export color data for tests and reference
export { MAJOR_COLORS, MINOR_COLORS, PAIRS_PER_GROUP };
