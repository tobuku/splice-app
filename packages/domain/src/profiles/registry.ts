import type {
  MediaType,
  ResolvedEndpoint,
  GroupBoundary,
  CableOrientation,
  ValidationIssue,
} from '../models/index.js';

// ── Cable Context (passed to profile methods) ──

export interface CableContext {
  cableId: string;
  segmentId: string;
  sheathId: string;
  nominalCount: number;
  orientation: CableOrientation;
  construction?: string;
}

// ── CountProfile Interface (spec Section 6) ──

export interface CountProfile {
  id: string;
  version: string;
  medium: MediaType;
  provenance: string;

  /** Resolve a 1-based physical position to a fully identified endpoint */
  resolveEndpoint(
    position: number,
    context: CableContext,
  ): ResolvedEndpoint | ValidationIssue;

  /** Total pair/fiber capacity for a given cable context */
  totalCapacity(context: CableContext): number;

  /** Group hierarchy boundaries */
  groupBoundaries(context: CableContext): GroupBoundary[];
}

// ── Profile Registry (fail-closed on unknown ID) ──

const registry = new Map<string, CountProfile>();

export function registerProfile(profile: CountProfile): void {
  const key = `${profile.id}@${profile.version}`;
  registry.set(key, profile);
}

export function getProfile(id: string, version: string): CountProfile | null {
  return registry.get(`${id}@${version}`) ?? null;
}

export function getProfileOrThrow(id: string, version: string): CountProfile {
  const profile = getProfile(id, version);
  if (!profile) {
    throw new Error(
      `Unknown count profile: ${id}@${version}. ` +
      `Fail-closed: cannot resolve endpoints without a registered profile.`
    );
  }
  return profile;
}

export function listProfiles(): CountProfile[] {
  return Array.from(registry.values());
}

export function clearRegistry(): void {
  registry.clear();
}
