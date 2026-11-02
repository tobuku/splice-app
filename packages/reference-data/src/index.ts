/**
 * Reference data package: standard color codes and verified profile definitions.
 * All profiles must cite provenance and be reviewed before field use.
 */

// Standard copper 25-pair color code data
export const COPPER_MAJOR_COLORS = ['White', 'Red', 'Black', 'Yellow', 'Violet'] as const;
export const COPPER_MINOR_COLORS = ['Blue', 'Orange', 'Green', 'Brown', 'Slate'] as const;

// Standard fiber TIA-598 12-color sequence
export const FIBER_12_COLORS = [
  'Blue', 'Orange', 'Green', 'Brown', 'Slate', 'White',
  'Red', 'Black', 'Yellow', 'Violet', 'Rose', 'Aqua',
] as const;

// Hex values for rendering
export const COLOR_HEX_MAP: Record<string, string> = {
  White: '#FFFFFF',
  Red: '#FF0000',
  Black: '#000000',
  Yellow: '#FFFF00',
  Violet: '#8B00FF',
  Blue: '#0000FF',
  Orange: '#FF8000',
  Green: '#008000',
  Brown: '#8B4513',
  Slate: '#708090',
  Rose: '#FF007F',
  Aqua: '#00FFFF',
};

// Standard profile metadata
export const STANDARD_PROFILES = {
  'copper-standard-25': {
    name: 'Standard North American 25-Pair',
    medium: 'copper' as const,
    version: '1.0.0',
    provenance: '7 CFR 1755.200, standard 25-pair tip/ring color code',
    pairsPerGroup: 25,
    maxGroups: 25,
  },
  'fiber-tia598-12': {
    name: 'TIA/EIA-598 12-Color Fiber',
    medium: 'fiber' as const,
    version: '1.0.0',
    provenance: 'TIA/EIA-598 12-color identification standard',
    fibersPerTube: 12,
    colorsPerCycle: 12,
  },
} as const;
