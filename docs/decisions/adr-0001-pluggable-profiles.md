# ADR-0001: Pluggable Count Profiles

## Status
Accepted

## Context
Copper and fiber cables use different numbering conventions depending on manufacturer,
vintage, region, and company standards. Legacy cables may use non-standard count sequences
that differ from the standard 25-pair or TIA-598 12-color schemes.

The engine must never guess at a count convention. Unknown or legacy conventions must
fail closed rather than producing incorrect splice instructions.

## Decision
Implement a `CountProfile` interface with a `ProfileRegistry` pattern:

1. Each profile is a named, versioned object implementing `resolveEndpoint()`,
   `totalCapacity()`, and `groupBoundaries()`.
2. Profiles are registered at startup. The engine fails with an explicit error
   if a requested profile ID/version is not found.
3. Standard profiles (copper-standard-25, fiber-tia598-12) ship as built-in
   implementations with cited provenance.
4. Legacy/custom profiles can be added later without changing the engine.
5. Cross-profile splicing (remap) requires an explicit crosswalk table mapping
   source positions to target positions. The engine blocks without one.

## Consequences
- Adding a new cable convention is a matter of implementing the interface and registering it
- No code change needed in the mapping engine for new conventions
- Fail-closed behavior means the app will refuse to generate plans for unknown profiles
  rather than producing wrong output
- Legacy profiles require verified reference data before they can be implemented
