import React, { useState } from 'react';
import { useAuth, hashPin } from '../auth/AuthContext.js';
import { db } from '../../persistence/db.js';
import type { UserRole } from '@splice/domain';

export function CrewManagementScreen() {
  const { currentUser, refreshUsers, allUsers } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('field-splicer');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Only admin or lead-splicer can manage crew
  const canManage =
    currentUser?.role === 'admin' || currentUser?.role === 'lead-splicer';

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required'); return; }
    if (pin.length < 4 || pin.length > 6) { setError('PIN must be 4-6 digits'); return; }
    if (!/^\d+$/.test(pin)) { setError('PIN must be numeric only'); return; }
    if (pin !== pinConfirm) { setError('PINs do not match'); return; }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const pinHashed = await hashPin(pin);
      await db.users.add({
        id: crypto.randomUUID(),
        name: name.trim(),
        role,
        pinHash: pinHashed,
        createdAt: now,
        updatedAt: now,
      });
      await refreshUsers();
      setShowAddForm(false);
      setName('');
      setRole('field-splicer');
      setPin('');
      setPinConfirm('');
    } catch {
      setError('Failed to add user');
    }
    setSubmitting(false);
  }

  const roleBadge = (r: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      'lead-splicer': 'bg-blue-100 text-blue-800',
      'field-splicer': 'bg-green-100 text-green-800',
      viewer: 'bg-gray-100 text-gray-800',
    };
    return colors[r] ?? 'bg-gray-100 text-gray-800';
  };

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'lead-splicer', label: 'Lead Splicer' },
    { value: 'field-splicer', label: 'Field Splicer' },
    { value: 'viewer', label: 'Viewer' },
  ];

  if (!canManage) {
    return (
      <div className="text-center py-12 text-gray-500">
        You do not have permission to manage crew members.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Crew Management</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-brand-500 text-white text-sm rounded-lg touch-manipulation hover:bg-brand-600"
          >
            + Add User
          </button>
        )}
      </div>

      {/* Add user form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
          <h3 className="font-medium text-gray-800">New Crew Member</h3>

          <div>
            <label htmlFor="crew-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              id="crew-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Crew member name"
            />
          </div>

          <div>
            <label htmlFor="crew-role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              id="crew-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="crew-pin" className="block text-sm font-medium text-gray-700 mb-1">PIN (4-6 digits)</label>
            <input
              id="crew-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Enter PIN"
            />
          </div>

          <div>
            <label htmlFor="crew-pin-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm PIN</label>
            <input
              id="crew-pin-confirm"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Confirm PIN"
            />
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-brand-500 text-white rounded-lg font-medium touch-manipulation hover:bg-brand-600 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Member'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setError(''); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg touch-manipulation hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* User list */}
      <div className="flex flex-col gap-2">
        {allUsers.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg"
          >
            <div>
              <span className="font-medium text-gray-800">{u.name}</span>
              {u.id === currentUser?.id && (
                <span className="ml-2 text-xs text-gray-400">(you)</span>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(u.role)}`}>
              {u.role}
            </span>
          </div>
        ))}
        {allUsers.length === 0 && (
          <p className="text-center text-gray-400 py-8">No crew members yet.</p>
        )}
      </div>
    </div>
  );
}
