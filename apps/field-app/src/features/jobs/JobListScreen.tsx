import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Job } from '@splice/domain';
import { db } from '../../persistence/db.js';

export function JobListScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    const all = await db.jobs.orderBy('updatedAt').reverse().toArray();
    setJobs(all);
  }

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const job: Job = {
      id: crypto.randomUUID(),
      name: name.trim(),
      location: location.trim() || undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await db.jobs.add(job);
    setName('');
    setLocation('');
    setShowForm(false);
    await loadJobs();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Jobs</h2>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ New Job'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createJob} className="card space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="job-name">
              Job Name
            </label>
            <input
              id="job-name"
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Main St Rearrangement"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="job-location">
              Location (optional)
            </label>
            <input
              id="job-location"
              className="input-field"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Pedestal 42, Main & 3rd"
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            Create Job
          </button>
        </form>
      )}

      {jobs.length === 0 && !showForm && (
        <div className="card text-center text-slate-500 py-8">
          No jobs yet. Tap "+ New Job" to get started.
        </div>
      )}

      <div className="space-y-2">
        {jobs.map(job => (
          <Link
            key={job.id}
            to={`/jobs/${job.id}`}
            className="card block hover:border-brand-500 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{job.name}</h3>
                {job.location && (
                  <p className="text-sm text-slate-500">{job.location}</p>
                )}
              </div>
              <span className={`status-${job.status === 'active' ? 'draft' : 'verified'}`}>
                {job.status}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
