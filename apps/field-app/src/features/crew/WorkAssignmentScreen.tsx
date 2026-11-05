import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { db } from '../../persistence/db.js';
import type { WorkAssignment, SpliceCase, WorkAssignmentStatus } from '@splice/domain';

export function WorkAssignmentScreen() {
  const { currentUser, allUsers } = useAuth();
  const [spliceCases, setSpliceCases] = useState<SpliceCase[]>([]);
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [error, setError] = useState('');

  // Form state for new assignment
  const [assignUserId, setAssignUserId] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage =
    currentUser?.role === 'admin' || currentUser?.role === 'lead-splicer';

  const loadData = useCallback(async () => {
    const cases = await db.spliceCases.toArray();
    setSpliceCases(cases);

    if (selectedCaseId) {
      const a = await db.workAssignments
        .where('spliceCaseId')
        .equals(selectedCaseId)
        .toArray();
      setAssignments(a);
    } else {
      const a = await db.workAssignments.toArray();
      setAssignments(a);
    }
  }, [selectedCaseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function validateNoOverlap(start: number, end: number, caseId: string): string | null {
    const caseAssignments = assignments.filter((a) => a.spliceCaseId === caseId);
    for (const a of caseAssignments) {
      if (start <= a.assignedRangeEnd && end >= a.assignedRangeStart) {
        const overlap = allUsers.find((u) => u.id === a.userId);
        return `Overlaps with ${overlap?.name ?? 'unknown user'} (pairs ${a.assignedRangeStart}-${a.assignedRangeEnd})`;
      }
    }
    return null;
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedCaseId) { setError('Select a splice case first'); return; }
    if (!assignUserId) { setError('Select a splicer'); return; }

    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
      setError('Invalid range. Start must be >= 1, end must be >= start.');
      return;
    }

    const overlapMsg = validateNoOverlap(start, end, selectedCaseId);
    if (overlapMsg) {
      setError(overlapMsg);
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      await db.workAssignments.add({
        id: crypto.randomUUID(),
        projectId: spliceCases.find((c) => c.id === selectedCaseId)?.jobId ?? '',
        spliceCaseId: selectedCaseId,
        userId: assignUserId,
        assignedRangeStart: start,
        assignedRangeEnd: end,
        status: 'assigned' as WorkAssignmentStatus,
        assignedBy: currentUser?.id ?? '',
        assignedAt: now,
        notes: notes.trim() || undefined,
      });
      await loadData();
      setAssignUserId('');
      setRangeStart('');
      setRangeEnd('');
      setNotes('');
    } catch {
      setError('Failed to create assignment');
    }
    setSubmitting(false);
  }

  const getUserName = (userId: string) =>
    allUsers.find((u) => u.id === userId)?.name ?? 'Unknown';

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      assigned: 'bg-yellow-100 text-yellow-800',
      'in-progress': 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      verified: 'bg-purple-100 text-purple-800',
    };
    return colors[status] ?? 'bg-gray-100 text-gray-800';
  };

  const splicers = allUsers.filter(
    (u) => u.role === 'field-splicer' || u.role === 'lead-splicer',
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-800">Work Assignments</h2>

      {/* Splice case selector */}
      <div>
        <label htmlFor="assign-case" className="block text-sm font-medium text-gray-700 mb-1">
          Splice Case
        </label>
        <select
          id="assign-case"
          value={selectedCaseId}
          onChange={(e) => setSelectedCaseId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All cases</option>
          {spliceCases.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.operationType} -- {sc.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>

      {/* New assignment form (lead-splicer+) */}
      {canManage && selectedCaseId && (
        <form
          onSubmit={handleAssign}
          className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3"
        >
          <h3 className="font-medium text-gray-800">Assign Range</h3>

          <div>
            <label htmlFor="assign-user" className="block text-sm font-medium text-gray-700 mb-1">
              Splicer
            </label>
            <select
              id="assign-user"
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select splicer...</option>
              {splicers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="assign-start" className="block text-sm font-medium text-gray-700 mb-1">
                Start
              </label>
              <input
                id="assign-start"
                type="number"
                inputMode="numeric"
                min="1"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="1"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="assign-end" className="block text-sm font-medium text-gray-700 mb-1">
                End
              </label>
              <input
                id="assign-end"
                type="number"
                inputMode="numeric"
                min="1"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="assign-notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <input
              id="assign-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Any notes about this assignment"
            />
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 bg-brand-500 text-white rounded-lg font-medium touch-manipulation hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? 'Assigning...' : 'Assign Range'}
          </button>
        </form>
      )}

      {/* Assignment list */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-gray-600">
          Current Assignments {assignments.length > 0 && `(${assignments.length})`}
        </h3>
        {assignments.map((a) => (
          <div
            key={a.id}
            className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">{getUserName(a.userId)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(a.status)}`}>
                {a.status}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Pairs {a.assignedRangeStart} - {a.assignedRangeEnd}
              <span className="text-gray-400 ml-2">
                ({a.assignedRangeEnd - a.assignedRangeStart + 1} pairs)
              </span>
            </div>
            {a.notes && (
              <div className="text-xs text-gray-400">{a.notes}</div>
            )}
          </div>
        ))}
        {assignments.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            {selectedCaseId ? 'No assignments for this splice case.' : 'No assignments yet.'}
          </p>
        )}

        {/* Summary per splicer */}
        {assignments.length > 0 && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Summary by Splicer</h4>
            {Array.from(
              assignments.reduce((map, a) => {
                const name = getUserName(a.userId);
                const count = a.assignedRangeEnd - a.assignedRangeStart + 1;
                map.set(name, (map.get(name) ?? 0) + count);
                return map;
              }, new Map<string, number>()),
            ).map(([name, count]) => (
              <div key={name} className="flex justify-between text-sm">
                <span>{name}</span>
                <span className="text-gray-500">{count} pairs</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
