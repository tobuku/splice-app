import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Cable, ResolvedSplicePlan } from '@splice/domain';
import { buildSplicePlan, renderText, renderDiagram, validateSplicePlan } from '@splice/domain';
import { InteractiveSpliceDiagram } from '@splice/diagram-renderer';
import { exportPlan, type ExportFormat } from '@splice/export-engine';
import { db } from '../../persistence/db.js';

type ViewTab = 'schedule' | 'diagram' | 'issues';

export function SplicePlanViewScreen() {
  const { jobId, caseId } = useParams<{ jobId: string; caseId: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<ResolvedSplicePlan | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('schedule');

  useEffect(() => {
    if (!caseId) return;
    loadCase(caseId);
  }, [caseId]);

  async function loadCase(id: string) {
    const sc = await db.spliceCases.get(id);
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

    const extraIssues = validateSplicePlan(result);
    if (extraIssues.length > 0) {
      result.issues = [...result.issues, ...extraIssues];
    }

    setPlan(result);
    await db.plans.put(result);
  }

  const schedule = useMemo(() => plan ? renderText(plan) : null, [plan]);
  const diagram = useMemo(() => plan ? renderDiagram(plan) : null, [plan]);

  function handleExport(format: ExportFormat) {
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

  if (!plan || !schedule) {
    return <div className="text-center py-8 text-slate-500">Loading splice plan...</div>;
  }

  const tabs: { key: ViewTab; label: string; count?: number }[] = [
    { key: 'schedule', label: 'Schedule', count: schedule.rows.length },
    { key: 'diagram', label: 'Diagram' },
    { key: 'issues', label: 'Issues', count: plan.issues.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Splice Plan</h2>
          <p className="text-sm text-slate-500">
            {plan.connections.length} connections |{' '}
            {plan.unassignedSource.length + plan.unassignedTarget.length} unassigned
          </p>
        </div>
        <span className={`status-${plan.status}`}>{plan.status}</span>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          className="btn-primary flex-1 py-3 text-sm"
          onClick={() => navigate(`/jobs/${jobId}/splice/${caseId}/work`)}
        >
          Start Field Work
        </button>
        <button
          className="btn-secondary flex-1 py-3 text-sm"
          onClick={() => navigate(`/jobs/${jobId}/splice/${caseId}/share`)}
        >
          Share Plan
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white shadow-sm' : 'text-slate-600'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 text-xs text-slate-400">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Schedule View */}
      {activeTab === 'schedule' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-2 py-1 border-b">#</th>
                <th className="text-left px-2 py-1 border-b">Source</th>
                <th className="text-left px-2 py-1 border-b">Color</th>
                <th className="text-left px-2 py-1 border-b">Target</th>
                <th className="text-left px-2 py-1 border-b">Color</th>
                <th className="text-left px-2 py-1 border-b">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((row, i) => (
                <tr key={row.connectionId} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-2 py-1 border-b text-slate-400">{row.sourcePosition}</td>
                  <td className="px-2 py-1 border-b">
                    <span className="font-mono">{row.sourceSheath}</span>
                    <span className="text-slate-500 ml-1">{row.sourceGroup}</span>
                  </td>
                  <td className="px-2 py-1 border-b">
                    <span className="inline-flex items-center gap-1">
                      {row.sourceTip && row.sourceRing ? (
                        <>{row.sourceTip}-{row.sourceRing}</>
                      ) : (
                        row.sourceColor
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-1 border-b">
                    <span className="font-mono">{row.targetSheath}</span>
                    <span className="text-slate-500 ml-1">{row.targetGroup}</span>
                  </td>
                  <td className="px-2 py-1 border-b">
                    {row.targetTip && row.targetRing ? (
                      <>{row.targetTip}-{row.targetRing}</>
                    ) : (
                      row.targetColor
                    )}
                  </td>
                  <td className="px-2 py-1 border-b">
                    <span className={`status-${row.status}`}>{row.status}</span>
                    {row.pairStatus && (
                      <span className="ml-1 text-xs text-slate-500">({row.pairStatus})</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Diagram View — Interactive */}
      {activeTab === 'diagram' && diagram && (
        <InteractiveSpliceDiagram model={diagram} />
      )}

      {/* Issues View */}
      {activeTab === 'issues' && (
        <div className="space-y-2">
          {plan.issues.length === 0 ? (
            <div className="card text-center text-green-600 py-4">No issues found.</div>
          ) : (
            plan.issues.map((issue, i) => (
              <div
                key={i}
                className={`card border-l-4 ${
                  issue.severity === 'error'
                    ? 'border-l-red-500'
                    : issue.severity === 'warning'
                    ? 'border-l-amber-500'
                    : 'border-l-blue-500'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`text-xs font-medium uppercase ${
                    issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {issue.severity}
                  </span>
                  <span className="text-xs text-slate-400">[{issue.code}]</span>
                </div>
                <p className="text-sm mt-1">{issue.message}</p>
                {issue.suggestedAction && (
                  <p className="text-xs text-slate-500 mt-1">{issue.suggestedAction}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Export Actions */}
      <div className="card space-y-2">
        <h3 className="text-sm font-medium">Export</h3>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => handleExport('json')}>
            JSON
          </button>
          <button className="btn-secondary flex-1" onClick={() => handleExport('csv')}>
            CSV
          </button>
          <button className="btn-secondary flex-1" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      {/* Plan Metadata */}
      <div className="text-xs text-slate-400 text-center space-y-1">
        <p>Plan ID: {plan.id} | Hash: {plan.hash}</p>
        <p>Profiles: {Object.entries(plan.sourceProfileVersions).map(([k, v]) => `${k}@${v}`).join(', ')}</p>
        <p className="italic">
          This plan is a reference aid. Verify cable identity and physical markings before field execution.
        </p>
      </div>
    </div>
  );
}
