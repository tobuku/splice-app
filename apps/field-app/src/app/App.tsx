import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout.js';
import { AuthProvider, useAuth } from '../features/auth/AuthContext.js';
import { LoginScreen } from '../features/auth/LoginScreen.js';
import { SetupScreen } from '../features/auth/SetupScreen.js';
import { JobListScreen } from '../features/jobs/JobListScreen.js';
import { JobDetailScreen } from '../features/jobs/JobDetailScreen.js';
import { CableEntryScreen } from '../features/cable-inventory/CableEntryScreen.js';
import { SpliceDesignerScreen } from '../features/splice-designer/SpliceDesignerScreen.js';
import { SplicePlanViewScreen } from '../features/splice-designer/SplicePlanViewScreen.js';
import { FieldWorkCardScreen } from '../features/field-work/FieldWorkCardScreen.js';
import { PrintVerificationScreen } from '../features/engineering/PrintVerificationScreen.js';
import { ShareScreen } from '../features/sharing/ShareScreen.js';
import { CrewManagementScreen } from '../features/crew/CrewManagementScreen.js';
import { WorkAssignmentScreen } from '../features/crew/WorkAssignmentScreen.js';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, needsSetup } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (needsSetup) {
    return <SetupScreen />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

function RequireRole({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: string[];
}) {
  const { currentUser } = useAuth();
  if (!currentUser || !roles.includes(currentUser.role)) {
    return (
      <div className="text-center py-12 text-gray-500">
        You do not have permission to access this page.
      </div>
    );
  }
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <Layout>
        <RequireAuth>
          <Routes>
            <Route path="/" element={<Navigate to="/jobs" replace />} />
            <Route path="/jobs" element={<JobListScreen />} />
            <Route path="/jobs/:jobId" element={<JobDetailScreen />} />
            <Route path="/jobs/:jobId/cables/new" element={<CableEntryScreen />} />
            <Route path="/jobs/:jobId/cables/:cableId" element={<CableEntryScreen />} />
            <Route path="/jobs/:jobId/splice/new" element={<SpliceDesignerScreen />} />
            <Route path="/jobs/:jobId/splice/:caseId" element={<SpliceDesignerScreen />} />
            <Route path="/jobs/:jobId/splice/:caseId/plan" element={<SplicePlanViewScreen />} />
            <Route path="/jobs/:jobId/splice/:caseId/work" element={<FieldWorkCardScreen />} />
            <Route path="/jobs/:jobId/splice/:caseId/share" element={<ShareScreen />} />
            <Route path="/jobs/:jobId/verify" element={
              <RequireRole roles={['admin', 'lead-splicer']}>
                <PrintVerificationScreen />
              </RequireRole>
            } />
            <Route
              path="/crew"
              element={
                <RequireRole roles={['admin', 'lead-splicer']}>
                  <CrewManagementScreen />
                </RequireRole>
              }
            />
            <Route
              path="/assignments"
              element={
                <RequireRole roles={['admin', 'lead-splicer']}>
                  <WorkAssignmentScreen />
                </RequireRole>
              }
            />
          </Routes>
        </RequireAuth>
      </Layout>
    </AuthProvider>
  );
}
