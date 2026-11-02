import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { JobListScreen } from '../features/jobs/JobListScreen.js';
import { JobDetailScreen } from '../features/jobs/JobDetailScreen.js';
import { CableEntryScreen } from '../features/cable-inventory/CableEntryScreen.js';
import { SpliceDesignerScreen } from '../features/splice-designer/SpliceDesignerScreen.js';
import { SplicePlanViewScreen } from '../features/splice-designer/SplicePlanViewScreen.js';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/jobs" replace />} />
        <Route path="/jobs" element={<JobListScreen />} />
        <Route path="/jobs/:jobId" element={<JobDetailScreen />} />
        <Route path="/jobs/:jobId/cables/new" element={<CableEntryScreen />} />
        <Route path="/jobs/:jobId/cables/:cableId" element={<CableEntryScreen />} />
        <Route path="/jobs/:jobId/splice/new" element={<SpliceDesignerScreen />} />
        <Route path="/jobs/:jobId/splice/:caseId" element={<SpliceDesignerScreen />} />
        <Route path="/jobs/:jobId/splice/:caseId/plan" element={<SplicePlanViewScreen />} />
      </Routes>
    </Layout>
  );
}
