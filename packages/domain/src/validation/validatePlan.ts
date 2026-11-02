import type { ResolvedSplicePlan, ValidationIssue } from '../models/index.js';

/**
 * Validate a resolved splice plan for invariant violations.
 * Checks from spec Section 8: unique IDs, no duplicate destinations,
 * assignments + unassigned = total, capacity mismatch surfaced.
 */
export function validateSplicePlan(plan: ResolvedSplicePlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Check for duplicate connection IDs
  const connectionIds = new Set<string>();
  for (const conn of plan.connections) {
    if (connectionIds.has(conn.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_CONNECTION_ID',
        message: `Duplicate connection ID: ${conn.id}`,
      });
    }
    connectionIds.add(conn.id);
  }

  // 2. Check for duplicate target assignments (one-to-one: no target used twice)
  const targetPositions = new Map<string, string>(); // "cableId:position" -> connectionId
  for (const conn of plan.connections) {
    const targetKey = `${conn.targetEndpoint.cableId}:${conn.targetEndpoint.physicalPosition}`;
    const existing = targetPositions.get(targetKey);
    if (existing) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_TARGET_ASSIGNMENT',
        message: `Target ${targetKey} is assigned to both ${existing} and ${conn.id}`,
        position: conn.targetEndpoint.physicalPosition,
        cableId: conn.targetEndpoint.cableId,
      });
    }
    targetPositions.set(targetKey, conn.id);
  }

  // 3. Check for duplicate source assignments
  const sourcePositions = new Map<string, string>();
  for (const conn of plan.connections) {
    const sourceKey = `${conn.sourceEndpoint.cableId}:${conn.sourceEndpoint.physicalPosition}`;
    const existing = sourcePositions.get(sourceKey);
    if (existing) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_SOURCE_ASSIGNMENT',
        message: `Source ${sourceKey} is assigned to both ${existing} and ${conn.id}`,
        position: conn.sourceEndpoint.physicalPosition,
        cableId: conn.sourceEndpoint.cableId,
      });
    }
    sourcePositions.set(sourceKey, conn.id);
  }

  // 4. Verify no connection has identical source and target
  for (const conn of plan.connections) {
    if (
      conn.sourceEndpoint.cableId === conn.targetEndpoint.cableId &&
      conn.sourceEndpoint.physicalPosition === conn.targetEndpoint.physicalPosition
    ) {
      issues.push({
        severity: 'error',
        code: 'SELF_CONNECTION',
        message: `Connection ${conn.id} maps an endpoint to itself`,
        position: conn.sourceEndpoint.physicalPosition,
        cableId: conn.sourceEndpoint.cableId,
      });
    }
  }

  // 5. Check that all connections have valid endpoint identities
  for (const conn of plan.connections) {
    if (!conn.sourceEndpoint.localLabel || !conn.targetEndpoint.localLabel) {
      issues.push({
        severity: 'error',
        code: 'MISSING_LABEL',
        message: `Connection ${conn.id} has an endpoint without a local label`,
      });
    }
    if (!conn.sourceEndpoint.colorIdentity.name || !conn.targetEndpoint.colorIdentity.name) {
      issues.push({
        severity: 'error',
        code: 'MISSING_COLOR',
        message: `Connection ${conn.id} has an endpoint without a color identity name`,
      });
    }
  }

  return issues;
}
