// Connection Accounting Engine
// Builds element-level state tracking for every position in a cable.

import type {
  Cable,
  Connection,
  CableElement,
  AccountingSummary,
  ElementState,
  ElementAssignment,
  ElementCondition,
} from '../models/index.js';

const ALL_STATES: ElementState[] = [
  'unassigned', 'planned', 'reserved', 'express',
  'damaged', 'abandoned', 'spliced', 'tested', 'verified',
];

const ALL_ASSIGNMENTS: ElementAssignment[] = [
  'unassigned', 'assigned', 'reserved', 'express', 'pass-through',
];

const ALL_CONDITIONS: ElementCondition[] = ['good', 'damaged', 'unknown'];

function zeroCounts<T extends string>(keys: T[]): Record<T, number> {
  const rec = {} as Record<T, number>;
  for (const k of keys) rec[k] = 0;
  return rec;
}

/**
 * Determine the ElementState from a connection's approvalState.
 * 'verified' connections -> 'spliced'; others -> 'planned'.
 */
function stateFromConnection(conn: Connection): ElementState {
  if (conn.approvalState === 'verified') return 'spliced';
  return 'planned';
}

/**
 * Build an accounting summary for every element position in a cable.
 *
 * For each position 1..nominalCount:
 * - If an override exists, use the override state/condition/assignment.
 * - Else if a connection references this position (source or target on this cable), derive state from the connection.
 * - Otherwise, the element is unassigned.
 *
 * Invariant: sum of all state counts === totalElements.
 */
export function buildAccountingSummary(
  cable: Cable,
  connections: Connection[],
  elementOverrides?: Map<number, Partial<CableElement>>,
): AccountingSummary {
  const byState = zeroCounts(ALL_STATES);
  const byAssignment = zeroCounts(ALL_ASSIGNMENTS);
  const byCondition = zeroCounts(ALL_CONDITIONS);

  // Index connections by position for this cable (source or target side).
  const connectionByPosition = new Map<number, Connection>();
  for (const conn of connections) {
    if (conn.sourceEndpoint.cableId === cable.id) {
      connectionByPosition.set(conn.sourceEndpoint.physicalPosition, conn);
    }
    if (conn.targetEndpoint.cableId === cable.id) {
      connectionByPosition.set(conn.targetEndpoint.physicalPosition, conn);
    }
  }

  let unresolvedCount = 0;

  for (let pos = 1; pos <= cable.nominalCount; pos++) {
    const override = elementOverrides?.get(pos);
    const conn = connectionByPosition.get(pos);

    let state: ElementState;
    let condition: ElementCondition;
    let assignment: ElementAssignment;

    if (override) {
      // Override takes precedence
      state = override.elementState ?? (conn ? stateFromConnection(conn) : 'unassigned');
      condition = override.condition ?? 'good';
      assignment = override.assignment ?? (conn ? 'assigned' : 'unassigned');
    } else if (conn) {
      // Derive from connection
      state = stateFromConnection(conn);
      condition = 'good';
      assignment = 'assigned';
    } else {
      // No connection, no override
      state = 'unassigned';
      condition = 'unknown';
      assignment = 'unassigned';
    }

    byState[state]++;
    byCondition[condition]++;
    byAssignment[assignment]++;

    // An element is "unresolved" if its state is ambiguous --
    // unassigned elements that have unknown condition, or damaged/abandoned elements
    // that still show as assigned.
    if (state === 'unassigned' || state === 'damaged' || state === 'abandoned') {
      unresolvedCount++;
    }
  }

  // Invariant check: sum of all states must equal nominalCount
  const stateSum = Object.values(byState).reduce((a, b) => a + b, 0);
  if (stateSum !== cable.nominalCount) {
    throw new Error(
      `Accounting invariant violated: state sum ${stateSum} !== nominalCount ${cable.nominalCount}`
    );
  }

  return {
    cableId: cable.id,
    totalElements: cable.nominalCount,
    byState,
    byAssignment,
    byCondition,
    unresolvedCount,
  };
}
