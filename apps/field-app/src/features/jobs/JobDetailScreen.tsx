import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Job, Cable, SpliceCase } from '@splice/domain';
import { db } from '../../persistence/db.js';

export function JobDetailScreen() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [cables, setCables] = useState<Cable[]>([]);
  const [spliceCases, setSpliceCases] = useState<SpliceCase[]>([]);

  useEffect(() => {
    if (!jobId) return;
    loadData(jobId);
  }, [jobId]);

  async function loadData(id: string) {
    const j = await db.jobs.get(id);
    setJob(j ?? null);

    // Load cables that belong to splice cases for this job
    const cases = await db.spliceCases.where('jobId').equals(id).toArray();
    setSpliceCases(cases);

    const cableIds = new Set(cases.flatMap(c => c.cableEnds.map(e => e.cableId)));
    const allCables = await db.cables.toArray();
    setCables(allCables.filter(c => cableIds.has(c.id)));

    // Also load any cables without a case
    const standaloneCables = allCables.filter(c => !cableIds.has(c.id));
    setCables(prev => [...prev, ...standaloneCables]);
  }

  if (!job) {
    return <div className="text-center py-8 text-slate-500">Loading job...</div>;
  }

  const opLabels: Record<string, string> = {
    'straight': 'Straight',
    'remap': 'Remap',
    'branch': 'Branch',
    'mid-span': 'Mid-Span',
    'bridge-tap': 'Bridge Tap',
    'spare-reserve': 'Spare/Reserve',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{job.name}</h2>
        {job.location && <p className="text-slate-500">{job.location}</p>}
      </div>

      {/* Cables Section */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">Cables</h3>
          <Link to={`/jobs/${jobId}/cables/new`} className="btn-primary text-sm">
            + Add Cable
          </Link>
        </div>

        {cables.length === 0 ? (
          <div className="card text-center text-slate-500 py-4">
            No cables added yet.
          </div>
        ) : (
          <div className="space-y-2">
            {cables.map(cable => (
              <Link
                key={cable.id}
                to={`/jobs/${jobId}/cables/${cable.id}`}
                className="card block"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{cable.sheathId}</span>
                    <span className="text-sm text-slate-500 ml-2">
                      {cable.media === 'copper' ? `${cable.nominalCount} pairs` : `${cable.nominalCount}F`}
                    </span>
                  </div>
                  <span className={`status-badge ${cable.media === 'copper' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                    {cable.media}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Splice Cases Section */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">Splice Cases</h3>
          <Link to={`/jobs/${jobId}/splice/new`} className="btn-primary text-sm">
            + New Splice
          </Link>
        </div>

        {spliceCases.length === 0 ? (
          <div className="card text-center text-slate-500 py-4">
            No splice cases yet. Add cables first, then create a splice.
          </div>
        ) : (
          <div className="space-y-2">
            {spliceCases.map(sc => (
              <Link
                key={sc.id}
                to={`/jobs/${jobId}/splice/${sc.id}/plan`}
                className="card block"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {opLabels[sc.operationType] ?? sc.operationType}
                    </span>
                    <span className="text-sm text-slate-500 ml-2">
                      {sc.cableEnds.length} cable ends
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
