import type {
  ResolvedEndpoint,
  GroupBoundary,
  ValidationIssue,
  ColorIdentity,
} from '../models/index.js';
import type { CountProfile, CableContext } from './registry.js';

// ── TIA/EIA-598 12-Color Fiber Identification ──
// Baseline sequence: Blue, Orange, Green, Brown, Slate, White,
//                    Red, Black, Yellow, Violet, Rose, Aqua
// Tubes/ribbons repeat this 12-color cycle
// Fibers within each tube also use this 12-color cycle

const FIBER_COLORS: ColorIdentity[] = [
  { name: 'Blue',   hexValue: '#0000FF', position: 1 },
  { name: 'Orange', hexValue: '#FF8000', position: 2 },
  { name: 'Green',  hexValue: '#008000', position: 3 },
  { name: 'Brown',  hexValue: '#8B4513', position: 4 },
  { name: 'Slate',  hexValue: '#708090', position: 5 },
  { name: 'White',  hexValue: '#FFFFFF', position: 6 },
  { name: 'Red',    hexValue: '#FF0000', position: 7 },
  { name: 'Black',  hexValue: '#000000', position: 8 },
  { name: 'Yellow', hexValue: '#FFFF00', position: 9 },
  { name: 'Violet', hexValue: '#8B00FF', position: 10 },
  { name: 'Rose',   hexValue: '#FF007F', position: 11 },
  { name: 'Aqua',   hexValue: '#00FFFF', position: 12 },
];

export const FIBERS_PER_TUBE = 12;

export function getFiberColor(fiberInTube: number): ColorIdentity {
  // fiberInTube: 1-12
  const index = (fiberInTube - 1) % 12;
  return FIBER_COLORS[index]!;
}

export function getTubeColor(tubeNumber: number): ColorIdentity {
  // Tubes use the same 12-color cycle
  const index = (tubeNumber - 1) % 12;
  const cycle = Math.floor((tubeNumber - 1) / 12) + 1;
  const base = FIBER_COLORS[index]!;
  return {
    ...base,
    name: cycle > 1 ? `${base.name} (cycle ${cycle})` : base.name,
    position: tubeNumber,
  };
}

function resolvePosition(position: number, fibersPerTube: number): {
  tubeNumber: number;
  fiberInTube: number;
} {
  const zeroPos = position - 1;
  const tubeNumber = Math.floor(zeroPos / fibersPerTube) + 1;
  const fiberInTube = (zeroPos % fibersPerTube) + 1;
  return { tubeNumber, fiberInTube };
}

/** Determine fibers per tube from construction string or default to 12 */
function parseFibersPerTube(construction?: string): number {
  if (!construction) return FIBERS_PER_TUBE;
  const match = construction.match(/(\d+)f/i);
  if (match) {
    const count = parseInt(match[1]!, 10);
    if (count === 12 || count === 24) return count;
  }
  return FIBERS_PER_TUBE;
}

export const fiberTia598_12: CountProfile = {
  id: 'fiber-tia598-12',
  version: '1.0.0',
  medium: 'fiber',
  provenance: 'TIA/EIA-598 12-color fiber identification standard',

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
        message: `Fiber ${position} exceeds cable capacity of ${context.nominalCount} fibers`,
        cableId: context.cableId,
        profileId: this.id,
        position,
      };
    }

    const fibersPerTube = parseFibersPerTube(context.construction);
    const { tubeNumber, fiberInTube } = resolvePosition(position, fibersPerTube);
    const fiberColor = getFiberColor(fiberInTube);
    const tubeColor = getTubeColor(tubeNumber);

    return {
      identity: {
        cableId: context.cableId,
        segmentId: context.segmentId,
        structurePath: [`Tube ${tubeNumber} (${tubeColor.name})`],
        physicalPosition: position,
        localLabel: String(position),
        colorIdentity: {
          name: fiberColor.name,
          hexValue: fiberColor.hexValue,
          position: fiberInTube,
        },
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
    const fibersPerTube = parseFibersPerTube(context.construction);
    const totalTubes = Math.ceil(context.nominalCount / fibersPerTube);

    for (let t = 1; t <= totalTubes; t++) {
      const start = (t - 1) * fibersPerTube + 1;
      const end = Math.min(t * fibersPerTube, context.nominalCount);
      const tubeColor = getTubeColor(t);

      boundaries.push({
        groupId: `tube-${t}`,
        groupLabel: `Tube ${t} (${tubeColor.name})`,
        startPosition: start,
        endPosition: end,
        colorIdentity: tubeColor,
      });
    }

    return boundaries;
  },
};

export { FIBER_COLORS };
