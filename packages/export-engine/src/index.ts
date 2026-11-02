import type { ResolvedSplicePlan } from '@splice/domain';
import { renderText } from '@splice/domain';

export type ExportFormat = 'json' | 'csv';

export interface ExportResult {
  format: ExportFormat;
  filename: string;
  content: string;
  mimeType: string;
}

/**
 * Export a resolved splice plan to JSON format.
 */
export function exportJSON(plan: ResolvedSplicePlan): ExportResult {
  const schedule = renderText(plan);
  return {
    format: 'json',
    filename: `splice-plan-${plan.id}.json`,
    content: JSON.stringify(schedule, null, 2),
    mimeType: 'application/json',
  };
}

/**
 * Export a resolved splice plan to CSV format.
 */
export function exportCSV(plan: ResolvedSplicePlan): ExportResult {
  const schedule = renderText(plan);

  const headers = [
    'Connection ID',
    'Source Sheath',
    'Source Position',
    'Source Label',
    'Source Group',
    'Source Color',
    'Source Tip',
    'Source Ring',
    'Target Sheath',
    'Target Position',
    'Target Label',
    'Target Group',
    'Target Color',
    'Target Tip',
    'Target Ring',
    'Status',
    'Pair Status',
  ];

  const rows = schedule.rows.map(row => [
    row.connectionId,
    row.sourceSheath,
    String(row.sourcePosition),
    row.sourceLabel,
    row.sourceGroup,
    row.sourceColor,
    row.sourceTip ?? '',
    row.sourceRing ?? '',
    row.targetSheath,
    String(row.targetPosition),
    row.targetLabel,
    row.targetGroup,
    row.targetColor,
    row.targetTip ?? '',
    row.targetRing ?? '',
    row.status,
    row.pairStatus ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return {
    format: 'csv',
    filename: `splice-plan-${plan.id}.csv`,
    content: csvContent,
    mimeType: 'text/csv',
  };
}

/**
 * Export a plan in the requested format.
 */
export function exportPlan(plan: ResolvedSplicePlan, format: ExportFormat): ExportResult {
  switch (format) {
    case 'json': return exportJSON(plan);
    case 'csv': return exportCSV(plan);
  }
}
