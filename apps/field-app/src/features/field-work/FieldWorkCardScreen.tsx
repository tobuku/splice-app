import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Cable, ResolvedSplicePlan } from '@splice/domain';
import { buildSplicePlan } from '@splice/domain';
import { db } from '../../persistence/db.js';

interface WorkCardState {
  plan: ResolvedSplicePlan;
  cables: Cable[];
  currentIndex: number;
  completedIds: Set<string>;
  flaggedIds: Set<string>;
}

/**
 * Mobile-optimized Field Work Card.
 * Shows one splice connection at a time with large touch targets.
 * Designed for a splicer working through their assigned range.
 */
export function FieldWorkCardScreen() {
  const { jobId, caseId } = useParams<{ jobId: string; caseId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<WorkCardState | null>(null);
  const [filterRange] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (!caseId) return;
    loadWorkData(caseId);
  }, [caseId]);

  async function loadWorkData(id: string) {
    const sc = await db.spliceCases.get(id);
    if (!sc) return;

    const cableIds = [...new Set(sc.cableEnds.map(e => e.cableId))];
    const loadedCables = await Promise.all(cableIds.map(cid => db.cables.get(cid)));
    const validCables = loadedCables.filter((c): c is Cable => c !== undefined);

    const plan = buildSplicePlan({
      spliceCaseId: sc.id,
      operationType: sc.operationType,
      cables: validCables,
      cableEnds: sc.cableEnds,
      crosswalk: sc.crosswalk,
      exposedSubset: sc.exposedSubset,
    });

    // Load saved completion state from localStorage
    const savedKey = `field-work-${id}`;
    const saved = localStorage.getItem(savedKey);
    const completedIds = new Set<string>();
    const flaggedIds = new Set<string>();
    if (saved) {
      const parsed = JSON.parse(saved);
      (parsed.completed || []).forEach((id: string) => completedIds.add(id));
      (parsed.flagged || []).forEach((id: string) => flaggedIds.add(id));
    }

    setState({
      plan,
      cables: validCables,
      currentIndex: 0,
      completedIds,
      flaggedIds,
    });
  }

  const saveProgress = useCallback((completedIds: Set<string>, flaggedIds: Set<string>) => {
    if (!caseId) return;
    const savedKey = `field-work-${caseId}`;
    localStorage.setItem(savedKey, JSON.stringify({
      completed: [...completedIds],
      flagged: [...flaggedIds],
      savedAt: new Date().toISOString(),
    }));
  }, [caseId]);

  if (!state) {
    return <div className="text-center py-8 text-slate-500">Loading work assignment...</div>;
  }

  const connections = filterRange
    ? state.plan.connections.filter(c =>
        c.sourceEndpoint.physicalPosition >= filterRange.start &&
        c.sourceEndpoint.physicalPosition <= filterRange.end
      )
    : state.plan.connections;

  const total = connections.length;
  const current = connections[state.currentIndex];
  const completedCount = connections.filter(c => state.completedIds.has(c.id)).length;
  const flaggedCount = connections.filter(c => state.flaggedIds.has(c.id)).length;

  if (!current) {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="text-2xl font-bold text-green-600">All Splices Complete</div>
        <p className="text-slate-500">{completedCount} of {total} connections spliced</p>
        {flaggedCount > 0 && (
          <p className="text-amber-600">{flaggedCount} flagged for review</p>
        )}
        <button
          className="btn-primary"
          onClick={() => navigate(`/jobs/${jobId}/splice/${caseId}/plan`)}
        >
          View Full Plan
        </button>
      </div>
    );
  }

  const isCompleted = state.completedIds.has(current.id);
  const isFlagged = state.flaggedIds.has(current.id);
  const src = current.sourceEndpoint;
  const tgt = current.targetEndpoint;

  function markSpliced() {
    if (!state || !current) return;
    const next = new Set(state.completedIds);
    next.add(current.id);
    saveProgress(next, state.flaggedIds);
    setState(prev => prev ? {
      ...prev,
      completedIds: next,
      currentIndex: Math.min(prev.currentIndex + 1, connections.length - 1),
    } : null);
  }

  function flagIssue() {
    if (!state || !current) return;
    const next = new Set(state.flaggedIds);
    if (next.has(current.id)) {
      next.delete(current.id);
    } else {
      next.add(current.id);
    }
    saveProgress(state.completedIds, next);
    setState(prev => prev ? { ...prev, flaggedIds: next } : null);
  }

  function goNext() {
    setState(prev => prev ? {
      ...prev,
      currentIndex: Math.min(prev.currentIndex + 1, connections.length - 1),
    } : null);
  }

  function goPrev() {
    setState(prev => prev ? {
      ...prev,
      currentIndex: Math.max(prev.currentIndex - 1, 0),
    } : null);
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="card p-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">
            Splice {state.currentIndex + 1} of {total}
          </span>
          <span className="text-green-600">{completedCount} done</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
        </div>
        {flaggedCount > 0 && (
          <div className="text-xs text-amber-600 mt-1">{flaggedCount} flagged</div>
        )}
      </div>

      {/* Source card */}
      <div className={`card border-l-4 ${isCompleted ? 'border-l-green-500 bg-green-50' : isFlagged ? 'border-l-amber-500 bg-amber-50' : 'border-l-blue-500'}`}>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Source</div>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded border-2 border-slate-300 flex-shrink-0"
            style={{ backgroundColor: src.colorIdentity.hexValue }}
            title={src.colorIdentity.name}
          />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold">{src.cableId}</div>
            <div className="text-base">
              {src.structurePath.length > 0 && (
                <span className="text-slate-600">{src.structurePath.join(' / ')} / </span>
              )}
              <span className="font-medium">
                {src.tipRing
                  ? `Pair ${src.physicalPosition}: ${src.tipRing.tip.name}-${src.tipRing.ring.name}`
                  : `Fiber ${src.physicalPosition}: ${src.colorIdentity.name}`
                }
              </span>
            </div>
            <div className="text-sm text-slate-500">{src.localLabel}</div>
          </div>
        </div>
      </div>

      {/* Connection arrow */}
      <div className="flex justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </div>

      {/* Target card */}
      <div className={`card border-l-4 ${isCompleted ? 'border-l-green-500 bg-green-50' : isFlagged ? 'border-l-amber-500 bg-amber-50' : 'border-l-blue-500'}`}>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Destination</div>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded border-2 border-slate-300 flex-shrink-0"
            style={{ backgroundColor: tgt.colorIdentity.hexValue }}
            title={tgt.colorIdentity.name}
          />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold">{tgt.cableId}</div>
            <div className="text-base">
              {tgt.structurePath.length > 0 && (
                <span className="text-slate-600">{tgt.structurePath.join(' / ')} / </span>
              )}
              <span className="font-medium">
                {tgt.tipRing
                  ? `Pair ${tgt.physicalPosition}: ${tgt.tipRing.tip.name}-${tgt.tipRing.ring.name}`
                  : `Fiber ${tgt.physicalPosition}: ${tgt.colorIdentity.name}`
                }
              </span>
            </div>
            <div className="text-sm text-slate-500">{tgt.localLabel}</div>
          </div>
        </div>
      </div>

      {/* Status badge */}
      {isCompleted && (
        <div className="text-center text-green-600 font-medium text-sm">Spliced</div>
      )}
      {isFlagged && !isCompleted && (
        <div className="text-center text-amber-600 font-medium text-sm">Flagged for Review</div>
      )}

      {/* Action buttons — large touch targets */}
      <div className="grid grid-cols-2 gap-3">
        <button
          className={`py-4 rounded-xl font-bold text-lg touch-manipulation ${
            isCompleted
              ? 'bg-green-100 text-green-700 border-2 border-green-300'
              : 'bg-green-500 text-white active:bg-green-700'
          }`}
          onClick={markSpliced}
        >
          {isCompleted ? 'Spliced' : 'Mark Spliced'}
        </button>
        <button
          className={`py-4 rounded-xl font-bold text-lg touch-manipulation ${
            isFlagged
              ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
              : 'bg-amber-500 text-white active:bg-amber-700'
          }`}
          onClick={flagIssue}
        >
          {isFlagged ? 'Unflag' : 'Report Issue'}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          className="btn-secondary flex-1 py-3 text-base"
          onClick={goPrev}
          disabled={state.currentIndex === 0}
        >
          Previous
        </button>
        <button
          className="btn-primary flex-1 py-3 text-base"
          onClick={goNext}
          disabled={state.currentIndex >= connections.length - 1}
        >
          Next Splice
        </button>
      </div>

      {/* Quick nav */}
      <details className="card">
        <summary className="text-sm font-medium cursor-pointer">Jump to splice...</summary>
        <div className="mt-2 flex gap-2 flex-wrap max-h-40 overflow-y-auto">
          {connections.map((c, i) => (
            <button
              key={c.id}
              className={`w-10 h-10 rounded text-xs font-mono touch-manipulation ${
                state.completedIds.has(c.id)
                  ? 'bg-green-100 text-green-700'
                  : state.flaggedIds.has(c.id)
                  ? 'bg-amber-100 text-amber-700'
                  : i === state.currentIndex
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setState(prev => prev ? { ...prev, currentIndex: i } : null)}
            >
              {c.sourceEndpoint.physicalPosition}
            </button>
          ))}
        </div>
      </details>

      {/* View full plan link */}
      <button
        className="btn-secondary w-full"
        onClick={() => navigate(`/jobs/${jobId}/splice/${caseId}/plan`)}
      >
        View Full Schedule
      </button>
    </div>
  );
}
