import { useState } from 'react';
import { useAuth } from './AuthContext.js';
import type { User } from '@splice/domain';

export function LoginScreen() {
  const { allUsers, login } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(
    allUsers.length === 1 ? (allUsers[0] ?? null) : null,
  );
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selectedUser) return;
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    setSubmitting(true);
    setError('');
    const ok = await login(selectedUser.id, pin);
    if (!ok) {
      setError('Incorrect PIN');
      setPin('');
    }
    setSubmitting(false);
  }

  function handleKeypadPress(digit: string) {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
    }
  }

  function handleBackspace() {
    setPin((prev) => prev.slice(0, -1));
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800',
      'lead-splicer': 'bg-blue-100 text-blue-800',
      'field-splicer': 'bg-green-100 text-green-800',
      viewer: 'bg-gray-100 text-gray-800',
    };
    return colors[role] ?? 'bg-gray-100 text-gray-800';
  };

  // User selection
  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-6">
        <h2 className="text-xl font-semibold text-gray-800">Select User</h2>
        <div className="w-full max-w-xs flex flex-col gap-2">
          {allUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm touch-manipulation hover:bg-gray-50 active:bg-gray-100"
            >
              <span className="font-medium">{u.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(u.role)}`}>
                {u.role}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // PIN entry
  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-4">
      {allUsers.length > 1 && (
        <button
          onClick={() => {
            setSelectedUser(null);
            setPin('');
            setError('');
          }}
          className="self-start text-sm text-brand-600 hover:underline touch-manipulation"
        >
          &larr; Back to user list
        </button>
      )}

      <h2 className="text-xl font-semibold text-gray-800">{selectedUser.name}</h2>
      <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadge(selectedUser.role)}`}>
        {selectedUser.role}
      </span>

      <p className="text-sm text-gray-500">Enter your PIN</p>

      {/* PIN dots */}
      <div className="flex gap-3 my-2" aria-live="polite">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 ${
              i < pin.length ? 'bg-brand-500 border-brand-500' : 'border-gray-300'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      {/* Numeric keypad */}
      <div className="grid grid-cols-3 gap-2 w-64">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            onClick={() => handleKeypadPress(d)}
            disabled={submitting}
            className="h-14 text-xl font-semibold bg-white border border-gray-200 rounded-lg shadow-sm touch-manipulation hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <button
          onClick={handleBackspace}
          disabled={submitting}
          className="h-14 text-lg bg-white border border-gray-200 rounded-lg shadow-sm touch-manipulation hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
          aria-label="Backspace"
        >
          &#9003;
        </button>
        <button
          onClick={() => handleKeypadPress('0')}
          disabled={submitting}
          className="h-14 text-xl font-semibold bg-white border border-gray-200 rounded-lg shadow-sm touch-manipulation hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || pin.length < 4}
          className="h-14 text-lg font-semibold bg-brand-500 text-white rounded-lg shadow-sm touch-manipulation hover:bg-brand-600 active:bg-brand-700 disabled:opacity-50"
          aria-label="Submit PIN"
        >
          Go
        </button>
      </div>
    </div>
  );
}
