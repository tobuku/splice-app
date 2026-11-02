import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Cable, MediaType, CableOrientation } from '@splice/domain';
import { listProfiles } from '@splice/domain';
import { db } from '../../persistence/db.js';

export function CableEntryScreen() {
  const { jobId, cableId } = useParams<{ jobId: string; cableId?: string }>();
  const navigate = useNavigate();
  const isEdit = !!cableId;

  const [media, setMedia] = useState<MediaType>('copper');
  const [sheathId, setSheathId] = useState('');
  const [nominalCount, setNominalCount] = useState('');
  const [profileId, setProfileId] = useState('');
  const [endDesignation, setEndDesignation] = useState<'A' | 'Z'>('A');
  const [reversed, setReversed] = useState(false);
  const [construction, setConstruction] = useState('');

  const profiles = listProfiles().filter(p => p.medium === media);

  useEffect(() => {
    if (profiles.length > 0 && !profileId) {
      setProfileId(profiles[0]!.id);
    }
  }, [media, profiles.length]);

  useEffect(() => {
    if (cableId) {
      db.cables.get(cableId).then(cable => {
        if (cable) {
          setMedia(cable.media);
          setSheathId(cable.sheathId);
          setNominalCount(String(cable.nominalCount));
          setProfileId(cable.countProfileId);
          setEndDesignation(cable.orientation.end);
          setReversed(cable.orientation.reversed);
          setConstruction(cable.construction ?? '');
        }
      });
    }
  }, [cableId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const count = parseInt(nominalCount, 10);
    if (!sheathId.trim() || isNaN(count) || count < 1 || !profileId) return;

    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    const now = new Date().toISOString();
    const orientation: CableOrientation = {
      end: endDesignation,
      physicalDirection: 'ascending',
      reversed,
    };

    const cable: Cable = {
      id: cableId ?? crypto.randomUUID(),
      media,
      nominalCount: count,
      countProfileId: profileId,
      countProfileVersion: profile.version,
      sheathId: sheathId.trim(),
      orientation,
      construction: construction.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.cables.put(cable);
    navigate(`/jobs/${jobId}`);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{isEdit ? 'Edit Cable' : 'Add Cable'}</h2>

      <form onSubmit={handleSubmit} className="card space-y-4">
        {/* Media Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Cable Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg font-medium ${
                media === 'copper' ? 'bg-amber-100 text-amber-800 border-2 border-amber-500' : 'bg-slate-100'
              }`}
              onClick={() => setMedia('copper')}
            >
              Copper
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg font-medium ${
                media === 'fiber' ? 'bg-blue-100 text-blue-800 border-2 border-blue-500' : 'bg-slate-100'
              }`}
              onClick={() => setMedia('fiber')}
            >
              Fiber
            </button>
          </div>
        </div>

        {/* Sheath ID */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="sheath-id">
            Sheath / CA ID
          </label>
          <input
            id="sheath-id"
            className="input-field"
            value={sheathId}
            onChange={e => setSheathId(e.target.value)}
            placeholder={media === 'copper' ? 'e.g. CA-1234' : 'e.g. FO-5678'}
            required
          />
        </div>

        {/* Nominal Count */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="nominal-count">
            {media === 'copper' ? 'Pair Count' : 'Fiber Count'}
          </label>
          <input
            id="nominal-count"
            className="input-field"
            type="number"
            min="1"
            value={nominalCount}
            onChange={e => setNominalCount(e.target.value)}
            placeholder={media === 'copper' ? 'e.g. 25, 50, 100, 600' : 'e.g. 12, 48, 144, 864'}
            required
          />
        </div>

        {/* Count Profile */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="profile">
            Count Profile
          </label>
          <select
            id="profile"
            className="select-field"
            value={profileId}
            onChange={e => setProfileId(e.target.value)}
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.id} v{p.version}
              </option>
            ))}
          </select>
          {profiles.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              {profiles.find(p => p.id === profileId)?.provenance}
            </p>
          )}
        </div>

        {/* Orientation */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">End</label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm ${
                  endDesignation === 'A' ? 'bg-brand-500 text-white' : 'bg-slate-100'
                }`}
                onClick={() => setEndDesignation('A')}
              >
                A End
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm ${
                  endDesignation === 'Z' ? 'bg-brand-500 text-white' : 'bg-slate-100'
                }`}
                onClick={() => setEndDesignation('Z')}
              >
                Z End
              </button>
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Reversed</label>
            <button
              type="button"
              className={`w-full py-2 rounded-lg text-sm ${
                reversed ? 'bg-red-100 text-red-800 border-2 border-red-500' : 'bg-slate-100'
              }`}
              onClick={() => setReversed(!reversed)}
            >
              {reversed ? 'Yes - Reversed' : 'No - Normal'}
            </button>
          </div>
        </div>

        {/* Construction (optional) */}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="construction">
            Construction (optional)
          </label>
          <input
            id="construction"
            className="input-field"
            value={construction}
            onChange={e => setConstruction(e.target.value)}
            placeholder={media === 'copper' ? 'e.g. PIC, pulp, screened' : 'e.g. loose tube 12f, ribbon 24f'}
          />
        </div>

        <button type="submit" className="btn-primary w-full">
          {isEdit ? 'Update Cable' : 'Add Cable'}
        </button>
      </form>
    </div>
  );
}
