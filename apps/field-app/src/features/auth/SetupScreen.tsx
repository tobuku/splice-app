import React, { useState } from 'react';
import { useAuth, hashPin } from './AuthContext.js';
import { db } from '../../persistence/db.js';
import type { UserRole } from '@splice/domain';

export function SetupScreen() {
  const { refreshUsers } = useAuth();
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('lead-splicer');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      setError('PIN must be 4-6 digits');
      return;
    }
    if (!/^\d+$/.test(pin)) {
      setError('PIN must be numeric only');
      return;
    }
    if (pin !== pinConfirm) {
      setError('PINs do not match');
      return;
    }

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
    } catch (err) {
      setError('Failed to create account');
    }
    setSubmitting(false);
  }

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Admin' },
    { value: 'lead-splicer', label: 'Lead Splicer' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-4">
      <h2 className="text-xl font-semibold text-gray-800">Welcome to Cable Splice Planner</h2>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        No accounts exist yet. Create the first account to get started.
      </p>

      <form onSubmit={handleCreate} className="w-full max-w-xs flex flex-col gap-3">
        <div>
          <label htmlFor="setup-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="setup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="setup-role" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="setup-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="setup-pin" className="block text-sm font-medium text-gray-700 mb-1">
            PIN (4-6 digits)
          </label>
          <input
            id="setup-pin"
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
          <label htmlFor="setup-pin-confirm" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm PIN
          </label>
          <input
            id="setup-pin-confirm"
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-brand-500 text-white rounded-lg font-medium touch-manipulation hover:bg-brand-600 active:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
