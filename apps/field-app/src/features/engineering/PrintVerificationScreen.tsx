import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ValidationIssue } from '@splice/domain';
import { db } from '../../persistence/db.js';

interface PrintEntry {
  cableId: string;
  sheathId: string;
  printCount: number;
  fieldCount: number;
  status: 'match' | 'mismatch' | 'unverified';
  notes: string;
}

interface PrintVerification {
  id: string;
  jobId: string;
  printReference: string;
  printRevision: string;
  entries: PrintEntry[];
  attachmentNames: string[];
  verifiedBy: string;
  verifiedAt: string | null;
  status: 'pending' | 'verified' | 'discrepancy';
}

/**
 * Engineering Print Verification screen.
 * Lead Splicer compares cable counts from engineering prints against field-verified data.
 * Any discrepancy blocks plan approval until resolved.
 */
export function PrintVerificationScreen() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [, setCables] = useState<{ id: string }[]>([]);
  const [verification, setVerification] = useState<PrintVerification>({
    id: crypto.randomUUID(),
    jobId: jobId || '',
    printReference: '',
    printRevision: '',
    entries: [],
    attachmentNames: [],
    verifiedBy: '',
    verifiedAt: null,
    status: 'pending',
  });
  const [csvImport, setCsvImport] = useState('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);

  useEffect(() => {
    if (!jobId) return;
    db.cables.where('id').above('').toArray().then(allCables => {
      // Filter cables for this job (cables don't have jobId directly, so load all and match via splice cases)
      setCables(allCables);
      setVerification(prev => ({
        ...prev,
        entries: allCables.map(c => ({
          cableId: c.id,
          sheathId: c.sheathId,
          printCount: 0,
          fieldCount: c.nominalCount,
          status: 'unverified' as const,
          notes: '',
        })),
      }));
    });
  }, [jobId]);

  function updateEntry(index: number, field: keyof PrintEntry, value: string | number) {
    setVerification(prev => {
      const entries = [...prev.entries];
      const existing = entries[index];
      if (!existing) return prev;
      entries[index] = { ...existing, [field]: value };

      // Auto-determine match status
      if (field === 'printCount' || field === 'fieldCount') {
        const e = entries[index]!;
        const pc = field === 'printCount' ? Number(value) : e.printCount;
        const fc = field === 'fieldCount' ? Number(value) : e.fieldCount;
        if (pc === 0) {
          e.status = 'unverified';
        } else if (pc === fc) {
          e.status = 'match';
        } else {
          e.status = 'mismatch';
        }
      }

      return { ...prev, entries };
    });
  }

  function handleCsvImport() {
    if (!csvImport.trim()) return;
    const lines = csvImport.trim().split('\n');
    const newIssues: ValidationIssue[] = [];

    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length < 2) continue;

      const sheathId = parts[0] ?? '';
      const printCount = parseInt(parts[1] ?? '', 10);
      if (isNaN(printCount)) {
        newIssues.push({
          severity: 'warning',
          code: 'IMPORT_PARSE',
          message: `Could not parse count for "${sheathId}": "${parts[1]}"`,
        });
        continue;
      }

      const entryIndex = verification.entries.findIndex(e => e?.sheathId === sheathId);
      if (entryIndex >= 0) {
        updateEntry(entryIndex, 'printCount', printCount);
      } else {
        newIssues.push({
          severity: 'warning',
          code: 'IMPORT_UNKNOWN_CABLE',
          message: `Cable "${sheathId}" from import not found in project inventory.`,
        });
      }
    }

    setIssues(newIssues);
    setCsvImport('');
  }

  function runVerification() {
    const newIssues: ValidationIssue[] = [];

    for (const entry of verification.entries) {
      if (entry.printCount === 0) {
        newIssues.push({
          severity: 'warning',
          code: 'UNVERIFIED_COUNT',
          message: `Cable ${entry.sheathId}: engineering print count not entered.`,
          cableId: entry.cableId,
          suggestedAction: 'Enter the count from the engineering print.',
        });
      } else if (entry.printCount !== entry.fieldCount) {
        newIssues.push({
          severity: 'error',
          code: 'COUNT_MISMATCH',
          message: `Cable ${entry.sheathId}: print says ${entry.printCount}, field has ${entry.fieldCount}.`,
          cableId: entry.cableId,
          suggestedAction: 'Verify physical cable count. Update print or cable entry.',
        });
      }
    }

    const hasMismatch = verification.entries.some(e => e.status === 'mismatch');
    const allVerified = verification.entries.every(e => e.status === 'match');

    setIssues(newIssues);
    setVerification(prev => ({
      ...prev,
      status: hasMismatch ? 'discrepancy' : allVerified ? 'verified' : 'pending',
      verifiedAt: allVerified ? new Date().toISOString() : null,
    }));
  }

  const matchCount = verification.entries.filter(e => e.status === 'match').length;
  const mismatchCount = verification.entries.filter(e => e.status === 'mismatch').length;
  const unverifiedCount = verification.entries.filter(e => e.status === 'unverified').length;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Engineering Print Verification</h2>

      {/* Print reference */}
      <div className="card space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Print Reference</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g., WO-2024-1234"
            value={verification.printReference}
            onChange={e => setVerification(prev => ({ ...prev, printReference: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Print Revision</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g., Rev B"
            value={verification.printRevision}
            onChange={e => setVerification(prev => ({ ...prev, printRevision: e.target.value }))}
          />
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center p-3">
          <div className="text-2xl font-bold text-green-600">{matchCount}</div>
          <div className="text-xs text-slate-500">Verified</div>
        </div>
        <div className="card text-center p-3">
          <div className="text-2xl font-bold text-red-600">{mismatchCount}</div>
          <div className="text-xs text-slate-500">Mismatch</div>
        </div>
        <div className="card text-center p-3">
          <div className="text-2xl font-bold text-slate-400">{unverifiedCount}</div>
          <div className="text-xs text-slate-500">Pending</div>
        </div>
      </div>

      {/* CSV Import */}
      <details className="card">
        <summary className="text-sm font-medium cursor-pointer">Import from CSV</summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-500">Format: sheathId,count (one per line)</p>
          <textarea
            className="input-field text-sm font-mono"
            rows={4}
            placeholder={"C-101,25\nC-102,25\nF-201,144"}
            value={csvImport}
            onChange={e => setCsvImport(e.target.value)}
          />
          <button className="btn-secondary text-sm" onClick={handleCsvImport}>
            Import
          </button>
        </div>
      </details>

      {/* Cable verification table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left px-2 py-1">Cable</th>
              <th className="text-right px-2 py-1">Print Count</th>
              <th className="text-right px-2 py-1">Field Count</th>
              <th className="text-center px-2 py-1">Status</th>
              <th className="text-left px-2 py-1">Notes</th>
            </tr>
          </thead>
          <tbody>
            {verification.entries.map((entry, i) => (
              <tr
                key={entry.cableId}
                className={entry.status === 'mismatch' ? 'bg-red-50' : entry.status === 'match' ? 'bg-green-50' : ''}
              >
                <td className="px-2 py-1 font-mono">{entry.sheathId}</td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    className="w-20 text-right border border-slate-300 rounded px-1 py-0.5 text-sm"
                    value={entry.printCount || ''}
                    onChange={e => updateEntry(i, 'printCount', parseInt(e.target.value, 10) || 0)}
                    min={0}
                  />
                </td>
                <td className="px-2 py-1 text-right font-medium">{entry.fieldCount}</td>
                <td className="px-2 py-1 text-center">
                  <span className={`status-${entry.status === 'match' ? 'verified' : entry.status === 'mismatch' ? 'blocked' : 'draft'}`}>
                    {entry.status}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded px-1 py-0.5 text-sm"
                    placeholder="Notes..."
                    value={entry.notes}
                    onChange={e => updateEntry(i, 'notes', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-1">
          {issues.map((issue, i) => (
            <div
              key={i}
              className={`card border-l-4 p-2 ${
                issue.severity === 'error' ? 'border-l-red-500 bg-red-50' : 'border-l-amber-500 bg-amber-50'
              }`}
            >
              <span className="text-xs font-medium uppercase">{issue.severity}</span>
              <p className="text-sm">{issue.message}</p>
              {issue.suggestedAction && (
                <p className="text-xs text-slate-500">{issue.suggestedAction}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={runVerification}>
          Run Verification
        </button>
        <button
          className="btn-secondary flex-1"
          onClick={() => navigate(`/jobs/${jobId}`)}
        >
          Back to Job
        </button>
      </div>

      {verification.status === 'verified' && (
        <div className="card bg-green-50 border-green-200 text-center">
          <p className="text-green-700 font-medium">All cable counts verified against engineering print.</p>
          <p className="text-xs text-green-600">
            Print: {verification.printReference} {verification.printRevision} | Verified: {verification.verifiedAt}
          </p>
        </div>
      )}

      {verification.status === 'discrepancy' && (
        <div className="card bg-red-50 border-red-200 text-center">
          <p className="text-red-700 font-medium">Discrepancies found. Resolve before approving splice plans.</p>
        </div>
      )}
    </div>
  );
}
