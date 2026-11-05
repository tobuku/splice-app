import { useEffect, useState } from 'react';
import { db } from '../../persistence/db.js';

export function DemoBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    db.jobs.get('demo-a-job').then((job) => {
      if (job) setVisible(true);
    });
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-2 mb-4 flex items-center justify-between text-sm">
      <span>Sample projects loaded. These contain fictional demo data.</span>
      <button
        className="ml-4 font-medium underline hover:no-underline"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demo data banner"
      >
        Dismiss
      </button>
    </div>
  );
}
