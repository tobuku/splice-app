import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type {
  Cable,
  CableEnd,
  SpliceCase,
  SpliceOperationType,
} from '@splice/domain';
import { db } from '../../persistence/db.js';

const OP_OPTIONS: { value: SpliceOperationType; label: string; description: string }[] = [
  { value: 'straight', label: 'Straight', description: '1:1 position mapping' },
  { value: 'remap', label: 'Remap', description: 'Explicit crosswalk required' },
  { value: 'branch', label: 'Branch', description: 'One feeder to N distribution' },
  { value: 'mid-span', label: 'Mid-Span', description: 'Partial cable access' },
  { value: 'bridge-tap', label: 'Bridge Tap', description: 'Mark pairs as working/spare/bridged' },
  { value: 'spare-reserve', label: 'Spare/Reserve', description: 'Track spare pair assignments' },
];

export function SpliceDesignerScreen() {
  const { jobId, caseId } = useParams<{ jobId: string; caseId?: string }>();
  const navigate = useNavigate();

  const [operationType, setOperationType] = useState<SpliceOperationType>('straight');
  const [availableCables, setAvailableCables] = useState<Cable[]>([]);
  const [selectedEnds, setSelectedEnds] = useState<CableEndInput[]>([]);

  useEffect(() => {
    db.cables.toArray().then(setAvailableCables);
  }, []);

  interface CableEndInput {
    cableId: string;
    role: CableEnd['role'];
    rangeStart: string;
    rangeEnd: string;
  }

  function addCableEnd() {
    setSelectedEnds(prev => [
      ...prev,
      { cableId: '', role: 'peer', rangeStart: '1', rangeEnd: '' },
    ]);
  }

  function updateEnd(index: number, field: keyof CableEndInput, value: string) {
    setSelectedEnds(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index]!, [field]: value };

      // Auto-fill range end from cable nominal count
      if (field === 'cableId' && value) {
        const cable = availableCables.find(c => c.id === value);
        if (cable) {
          updated[index] = { ...updated[index]!, rangeEnd: String(cable.nominalCount) };
        }
      }

      return updated;
    });
  }

  function removeEnd(index: number) {
    setSelectedEnds(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedEnds.length < 2) return;

    const cableEnds: CableEnd[] = selectedEnds.map((end, i) => ({
      id: crypto.randomUUID(),
      cableId: end.cableId,
      role: operationType === 'branch'
        ? (i === 0 ? 'feeder' : 'distribution')
        : end.role,
      rangeStart: parseInt(end.rangeStart, 10) || 1,
      rangeEnd: parseInt(end.rangeEnd, 10) || 1,
    }));

    const now = new Date().toISOString();
    const spliceCase: SpliceCase = {
      id: caseId ?? crypto.randomUUID(),
      jobId: jobId!,
      operationType,
      cableEnds,
      createdAt: now,
      updatedAt: now,
    };

    await db.spliceCases.put(spliceCase);
    navigate(`/jobs/${jobId}/splice/${spliceCase.id}/plan`);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">New Splice Case</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Operation Type */}
        <div className="card space-y-2">
          <label className="block text-sm font-medium">Operation Type</label>
          <div className="grid grid-cols-2 gap-2">
            {OP_OPTIONS.map(op => (
              <button
                key={op.value}
                type="button"
                className={`p-3 rounded-lg text-left text-sm ${
                  operationType === op.value
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-50 border border-slate-200'
                }`}
                onClick={() => setOperationType(op.value)}
              >
                <div className="font-medium">{op.label}</div>
                <div className={`text-xs ${operationType === op.value ? 'text-white/80' : 'text-slate-500'}`}>
                  {op.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cable Ends */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Cable Ends</label>
            <button type="button" className="btn-secondary text-sm" onClick={addCableEnd}>
              + Add End
            </button>
          </div>

          {selectedEnds.length === 0 && (
            <p className="text-sm text-slate-500">
              Add at least 2 cable ends to create a splice.
            </p>
          )}

          {selectedEnds.map((end, i) => (
            <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {operationType === 'branch'
                    ? (i === 0 ? 'Feeder' : `Distribution ${i}`)
                    : `Cable End ${i + 1}`}
                </span>
                <button
                  type="button"
                  className="text-red-500 text-sm"
                  onClick={() => removeEnd(i)}
                >
                  Remove
                </button>
              </div>

              <select
                className="select-field"
                value={end.cableId}
                onChange={e => updateEnd(i, 'cableId', e.target.value)}
                required
              >
                <option value="">Select cable...</option>
                {availableCables.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.sheathId} ({c.media}, {c.nominalCount}{c.media === 'fiber' ? 'F' : ' pairs'})
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-500">Start</label>
                  <input
                    className="input-field text-sm"
                    type="number"
                    min="1"
                    value={end.rangeStart}
                    onChange={e => updateEnd(i, 'rangeStart', e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-500">End</label>
                  <input
                    className="input-field text-sm"
                    type="number"
                    min="1"
                    value={end.rangeEnd}
                    onChange={e => updateEnd(i, 'rangeEnd', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={selectedEnds.length < 2}
        >
          Generate Splice Plan
        </button>
      </form>
    </div>
  );
}
