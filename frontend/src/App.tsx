import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import {
  OfficerLayout,
  PublicLayout,
} from './components/shared';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import type { UserRole } from './api/types';

import LoginPage from './pages/LoginPage';
import UploadPage from './pages/UploadPage';
import ReviewPage from './pages/ReviewPage';
import QueuePage from './pages/QueuePage';
import AdminPage from './pages/AdminPage';
import RecordDetailPage from './pages/RecordDetailPage';
import DiscrepancyPage from './pages/DiscrepancyPage';
import MultilingualPage from './pages/MultilingualPage';
import MapPage from './pages/MapPage';
import LookupPage from './pages/LookupPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';

/*
 * Route guard for the officer/reviewer/admin workspace.
 *
 * - Unauthenticated visitors are sent to /login.
 * - Authenticated users whose role isn't allowed for a given route
 *   are sent back to a route their role can access, instead of
 *   showing a broken/empty workspace page.
 */
function RequireAuth({
  allowedRoles,
  children,
}: {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-on-surface-variant">
        Verifying session…
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback =
      user.role === 'admin'
        ? '/admin'
        : user.role === 'reviewer'
          ? '/review'
          : user.role === 'officer'
            ? '/upload'
            : '/lookup';

    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ═══════════════════════════════════════
            PUBLIC / CITIZEN ROUTES
        ═══════════════════════════════════════ */}

        <Route element={<PublicLayout />}>

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

          <Route
            path="/lookup"
            element={<LookupPage />}
          />

        </Route>

        {/* ═══════════════════════════════════════
            OFFICER / REVIEWER / ADMIN WORKSPACE
        ═══════════════════════════════════════ */}

        <Route
          element={
            <RequireAuth allowedRoles={['officer', 'reviewer', 'admin']}>
              <OfficerLayout />
            </RequireAuth>
          }
        >

          <Route
            path="/upload"
            element={<UploadPage />}
          />

          <Route
            path="/review"
            element={<ReviewPage />}
          />

          <Route
            path="/queue"
            element={<QueuePage />}
          />

          <Route
            path="/records/:id"
            element={<RecordDetailPage />}
          />

          <Route
            path="/discrepancy/:id"
            element={<DiscrepancyPage />}
          />

          <Route
            path="/records/:id/multilingual"
            element={<MultilingualPage />}
          />

          <Route
            path="/map"
            element={<MapPage />}
          />

        </Route>

        {/* ═══════════════════════════════════════
            ADMIN-ONLY
        ═══════════════════════════════════════ */}

        <Route
          element={
            <RequireAuth allowedRoles={['admin']}>
              <OfficerLayout />
            </RequireAuth>
          }
        >

          <Route
            path="/admin"
            element={<AdminPage />}
          />

        </Route>

        {/* ═══════════════════════════════════════
            DEFAULT / UNKNOWN ROUTES
        ═══════════════════════════════════════ */}

        <Route
          path="/"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
