import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { Cable, ResolvedSplicePlan } from '@splice/domain';
import { buildSplicePlan, renderText } from '@splice/domain';
import { exportPlan } from '@splice/export-engine';
import { db } from '../../persistence/db.js';

/**
 * Share & Export screen.
 * Generate shareable text summaries, export files, and printable reports.
 * No backend required — all sharing is via export/copy.
 */
export function ShareScreen() {
  const { jobId, caseId } = useParams<{ jobId: string; caseId: string }>();
  const [plan, setPlan] = useState<ResolvedSplicePlan | null>(null);
  const [jobName, setJobName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!caseId || !jobId) return;
    loadData();
  }, [caseId, jobId]);

  async function loadData() {
    const job = await db.jobs.get(jobId!);
    if (job) setJobName(job.name);

    const sc = await db.spliceCases.get(caseId!);
    if (!sc) return;

    const cableIds = [...new Set(sc.cableEnds.map(e => e.cableId))];
    const loadedCables = await Promise.all(cableIds.map(cid => db.cables.get(cid)));
    const validCables = loadedCables.filter((c): c is Cable => c !== undefined);

    const result = buildSplicePlan({
      spliceCaseId: sc.id,
      operationType: sc.operationType,
      cables: validCables,
      cableEnds: sc.cableEnds,
      crosswalk: sc.crosswalk,
      exposedSubset: sc.exposedSubset,
    });

    setPlan(result);
  }

  const schedule = useMemo(() => plan ? renderText(plan) : null, [plan]);

  // Generate a text summary suitable for copying/sharing
  const textSummary = useMemo(() => {
    if (!plan || !schedule) return '';

    const lines: string[] = [
      `CABLE SPLICE PLAN`,
      `Job: ${jobName}`,
      `Plan ID: ${plan.id}`,
      `Status: ${plan.status.toUpperCase()}`,
      `Connections: ${plan.connections.length}`,
      `Unassigned: ${plan.unassignedSource.length + plan.unassignedTarget.length}`,
      ``,
      `--- SPLICE SCHEDULE ---`,
    ];

    for (const row of schedule.rows) {
      const src = row.sourceTip && row.sourceRing
        ? `${row.sourceSheath} P${row.sourcePosition} ${row.sourceTip}-${row.sourceRing}`
        : `${row.sourceSheath} F${row.sourcePosition} ${row.sourceColor}`;
      const tgt = row.targetTip && row.targetRing
        ? `${row.targetSheath} P${row.targetPosition} ${row.targetTip}-${row.targetRing}`
        : `${row.targetSheath} F${row.targetPosition} ${row.targetColor}`;
      const status = row.pairStatus ? ` [${row.pairStatus}]` : '';
      lines.push(`${src}  -->  ${tgt}${status}`);
    }

    if (plan.issues.length > 0) {
      lines.push('', '--- ISSUES ---');
      for (const issue of plan.issues) {
        lines.push(`[${issue.severity.toUpperCase()}] ${issue.message}`);
      }
    }

    lines.push('', `Generated: ${new Date().toISOString()}`);
    lines.push(`Hash: ${plan.hash}`);
    lines.push('', 'This plan is a reference aid. Verify cable identity before field execution.');

    return lines.join('\n');
  }, [plan, schedule, jobName]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(textSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = textSummary;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleExport(format: 'json' | 'csv') {
    if (!plan) return;
    const result = exportPlan(plan, format);
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  // Share via Web Share API if available
  async function handleNativeShare() {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `Splice Plan - ${jobName}`,
        text: textSummary,
      });
    } catch {
      // User cancelled share
    }
  }

  if (!plan) {
    return <div className="text-center py-8 text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Share Splice Plan</h2>

      {/* Summary stats */}
      <div className="card">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-slate-500">Job:</span> {jobName}</div>
          <div><span className="text-slate-500">Status:</span> <span className={`status-${plan.status}`}>{plan.status}</span></div>
          <div><span className="text-slate-500">Connections:</span> {plan.connections.length}</div>
          <div><span className="text-slate-500">Issues:</span> {plan.issues.length}</div>
        </div>
      </div>

      {/* Share actions */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700">Share with Crew</h3>

        <button
          className="btn-primary w-full py-3 text-base"
          onClick={copyToClipboard}
        >
          {copied ? 'Copied to Clipboard' : 'Copy Splice Schedule as Text'}
        </button>

        {'share' in navigator && (
          <button
            className="btn-secondary w-full py-3 text-base"
            onClick={handleNativeShare}
          >
            Share via Device
          </button>
        )}
      </div>

      {/* Export files */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700">Export Files</h3>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-secondary py-3" onClick={() => handleExport('csv')}>
            CSV
          </button>
          <button className="btn-secondary py-3" onClick={() => handleExport('json')}>
            JSON
          </button>
          <button className="btn-secondary py-3" onClick={handlePrint}>
            Print
          </button>
        </div>
      </div>

      {/* Text preview */}
      <details className="card" open>
        <summary className="text-sm font-medium cursor-pointer">Preview Text Output</summary>
        <pre className="mt-2 text-xs font-mono bg-slate-50 p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
          {textSummary}
        </pre>
      </details>

      {/* Revision info */}
      <div className="text-xs text-slate-400 text-center space-y-1">
        <p>Plan Hash: {plan.hash}</p>
        <p>Profiles: {Object.entries(plan.sourceProfileVersions).map(([k, v]) => `${k}@${v}`).join(', ')}</p>
        <p className="italic">
          Shared plans are static snapshots. Changes after export are not reflected.
        </p>
      </div>
    </div>
  );
}
