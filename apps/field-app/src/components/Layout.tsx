import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.js';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === '/jobs';

  // useAuth may not be available if Layout renders before AuthProvider.
  // Since App.tsx wraps Layout inside AuthProvider, this is safe.
  let authContext: ReturnType<typeof useAuth> | null = null;
  try {
    authContext = useAuth();
  } catch {
    // Not yet inside AuthProvider -- render without user info
  }

  const currentUser = authContext?.currentUser ?? null;
  const canManageCrew =
    currentUser?.role === 'admin' || currentUser?.role === 'lead-splicer';

  const roleBadgeColor: Record<string, string> = {
    admin: 'bg-red-200 text-red-900',
    'lead-splicer': 'bg-blue-200 text-blue-900',
    'field-splicer': 'bg-green-200 text-green-900',
    viewer: 'bg-gray-200 text-gray-900',
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="bg-brand-500 text-white px-4 py-3 flex items-center gap-3 safe-area-top">
        {!isHome && (
          <Link
            to="/jobs"
            className="text-white/80 hover:text-white touch-manipulation"
            aria-label="Back to jobs"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        )}
        <h1 className="text-lg font-semibold flex-1">Cable Splice Planner</h1>

        {/* User info */}
        {currentUser && (
          <div className="flex items-center gap-2">
            <span className="text-sm hidden sm:inline">{currentUser.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleBadgeColor[currentUser.role] ?? 'bg-gray-200 text-gray-900'}`}
            >
              {currentUser.role}
            </span>
          </div>
        )}
      </header>

      {/* Navigation bar (when authenticated) */}
      {currentUser && (
        <nav className="bg-white border-b border-gray-200 px-4 py-1 flex items-center gap-4 text-sm overflow-x-auto">
          <NavLink to="/jobs" current={location.pathname}>
            Jobs
          </NavLink>
          {canManageCrew && (
            <>
              <NavLink to="/crew" current={location.pathname}>
                Crew
              </NavLink>
              <NavLink to="/assignments" current={location.pathname}>
                Assignments
              </NavLink>
            </>
          )}
          <div className="flex-1" />
          {authContext && (
            <button
              onClick={authContext.logout}
              className="text-gray-400 hover:text-gray-600 text-xs touch-manipulation py-1"
            >
              Logout
            </button>
          )}
        </nav>
      )}

      {/* Main content */}
      <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Offline indicator */}
      <OfflineIndicator />
    </div>
  );
}

function NavLink({
  to,
  current,
  children,
}: {
  to: string;
  current: string;
  children: React.ReactNode;
}) {
  const isActive = current === to || current.startsWith(to + '/');
  return (
    <Link
      to={to}
      className={`py-2 border-b-2 touch-manipulation whitespace-nowrap ${
        isActive
          ? 'border-brand-500 text-brand-600 font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </Link>
  );
}

function OfflineIndicator() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-amber-500 text-white text-center py-1 text-sm font-medium">
      Offline mode -- data saved locally
    </div>
  );
}
