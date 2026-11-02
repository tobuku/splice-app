import type { CableOrientation } from '../models/index.js';

/**
 * Normalize a physical position based on cable orientation.
 * When a cable is reversed, position 1 maps to the far end.
 * This is deterministic and integer-safe (spec rule 11).
 */
export function normalizePhysicalPosition(
  position: number,
  totalCapacity: number,
  orientation: CableOrientation,
): number {
  if (!Number.isInteger(position) || position < 1 || position > totalCapacity) {
    throw new RangeError(
      `Position ${position} is out of range [1, ${totalCapacity}]`
    );
  }

  if (orientation.reversed) {
    // Reversed: position 1 becomes totalCapacity, etc.
    return totalCapacity - position + 1;
  }

  return position;
}

/**
 * Denormalize: convert a canonical position back to a local position
 * given the cable orientation. Inverse of normalizePhysicalPosition.
 */
export function denormalizePhysicalPosition(
  canonicalPosition: number,
  totalCapacity: number,
  orientation: CableOrientation,
): number {
  // The reversal operation is its own inverse
  return normalizePhysicalPosition(canonicalPosition, totalCapacity, orientation);
}
