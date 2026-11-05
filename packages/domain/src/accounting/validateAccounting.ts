// Accounting Validation
// Checks an AccountingSummary for integrity issues.

import type { AccountingSummary, ValidationIssue } from '../models/index.js';

/**
 * Validate an accounting summary for consistency and completeness.
 *
 * Checks:
 * 1. All positions accounted for (state counts sum to totalElements)
 * 2. Assignment counts sum to totalElements (no duplicates or gaps)
 * 3. Unresolved count is 0 for plans that claim verification
 * 4. Damaged or abandoned elements are not marked as assigned
 */
export function validateAccounting(
  summary: AccountingSummary,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check 1: state counts sum to totalElements
  const stateSum = Object.values(summary.byState).reduce((a, b) => a + b, 0);
  if (stateSum !== summary.totalElements) {
    issues.push({
      severity: 'error',
      code: 'ACCOUNTING_STATE_MISMATCH',
      message: `State counts sum to ${stateSum} but totalElements is ${summary.totalElements}. Missing or duplicate elements.`,
      cableId: summary.cableId,
    });
  }

  // Check 2: assignment counts sum to totalElements
  const assignmentSum = Object.values(summary.byAssignment).reduce((a, b) => a + b, 0);
  if (assignmentSum !== summary.totalElements) {
    issues.push({
      severity: 'error',
      code: 'ACCOUNTING_ASSIGNMENT_MISMATCH',
      message: `Assignment counts sum to ${assignmentSum} but totalElements is ${summary.totalElements}.`,
      cableId: summary.cableId,
    });
  }

  // Check 3: condition counts sum to totalElements
  const conditionSum = Object.values(summary.byCondition).reduce((a, b) => a + b, 0);
  if (conditionSum !== summary.totalElements) {
    issues.push({
      severity: 'error',
      code: 'ACCOUNTING_CONDITION_MISMATCH',
      message: `Condition counts sum to ${conditionSum} but totalElements is ${summary.totalElements}.`,
      cableId: summary.cableId,
    });
  }

  // Check 4: unresolved count should be 0 for verified plans
  if (summary.unresolvedCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'ACCOUNTING_UNRESOLVED_ELEMENTS',
      message: `${summary.unresolvedCount} element(s) are unresolved (unassigned, damaged, or abandoned).`,
      cableId: summary.cableId,
    });
  }

  // Check 5: damaged or abandoned elements should not be assigned
  const damagedCount = summary.byState['damaged'] ?? 0;
  const abandonedCount = summary.byState['abandoned'] ?? 0;
  const assignedCount = summary.byAssignment['assigned'] ?? 0;
  const totalActive = summary.totalElements
    - (summary.byState['unassigned'] ?? 0)
    - damagedCount
    - abandonedCount;

  // If there are more assigned than could be active, damaged/abandoned may be assigned
  if (assignedCount > totalActive && (damagedCount > 0 || abandonedCount > 0)) {
    issues.push({
      severity: 'error',
      code: 'ACCOUNTING_DAMAGED_ASSIGNED',
      message: `Damaged or abandoned elements appear to be assigned. ${assignedCount} assigned but only ${totalActive} active elements.`,
      cableId: summary.cableId,
    });
  }

  return issues;
}
