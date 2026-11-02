import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === '/jobs';

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
        <h1 className="text-lg font-semibold">Cable Splice Planner</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Offline indicator */}
      <OfflineIndicator />
    </div>
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
