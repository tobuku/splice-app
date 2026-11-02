import type { ResolvedEndpoint, ValidationIssue } from '../models/index.js';
import type { CableContext } from '../profiles/registry.js';
import { getProfileOrThrow } from '../profiles/registry.js';

/**
 * Resolve a single endpoint at a given physical position using the cable's registered profile.
 * Returns a fully identified endpoint or a validation error -- never a guess.
 */
export function resolveEndpoint(
  profileId: string,
  profileVersion: string,
  position: number,
  context: CableContext,
): ResolvedEndpoint | ValidationIssue {
  const profile = getProfileOrThrow(profileId, profileVersion);

  if (profile.medium === 'copper' && context.nominalCount <= 0) {
    return {
      severity: 'error',
      code: 'INVALID_CABLE',
      message: 'Cable nominal count must be positive',
      cableId: context.cableId,
      profileId,
      position,
    };
  }

  return profile.resolveEndpoint(position, context);
}

/**
 * Resolve all endpoints for a range within a cable.
 * Returns resolved endpoints and any errors encountered.
 */
export function resolveRange(
  profileId: string,
  profileVersion: string,
  startPosition: number,
  endPosition: number,
  context: CableContext,
): { resolved: ResolvedEndpoint[]; errors: ValidationIssue[] } {
  const resolved: ResolvedEndpoint[] = [];
  const errors: ValidationIssue[] = [];

  for (let pos = startPosition; pos <= endPosition; pos++) {
    const result = resolveEndpoint(profileId, profileVersion, pos, context);
    if ('identity' in result) {
      resolved.push(result);
    } else {
      errors.push(result);
    }
  }

  return { resolved, errors };
}
