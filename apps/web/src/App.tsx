import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PortalNavbar } from './components/PortalNavbar';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Operational Portals
import { DispatcherDashboard } from './features/dispatcher/DispatcherDashboard';
import { PatientDashboard } from './features/patient/PatientDashboard';
import { ResponderDashboard } from './features/responder/ResponderDashboard';
import { FacilityDashboard } from './features/facility/FacilityDashboard';
import { AdminDashboard } from './features/admin/AdminDashboard';

// Authentication Screens
import { LoginScreen } from './features/auth/LoginScreen';
import { RegisterScreen } from './features/auth/RegisterScreen';
import { InvitationScreen } from './features/auth/InvitationScreen';
import { ForgotPasswordScreen } from './features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './features/auth/ResetPasswordScreen';
import { UnauthorizedScreen } from './features/auth/UnauthorizedScreen';
import { SessionExpiredScreen } from './features/auth/SessionExpiredScreen';
import { AccountStatusScreen } from './features/auth/AccountStatusScreen';

const RootRedirect: React.FC = () => {
  const { session } = useAuth();
  if (!session.isAuthenticated || !session.user) {
    return <Navigate to="/login" replace />;
  }
  switch (session.user.role) {
    case 'PATIENT':
      return <Navigate to="/patient" replace />;
    case 'RESPONDER':
      return <Navigate to="/responder" replace />;
    case 'HOSPITAL_ADMIN':
    case 'HOSPITAL_STAFF':
      return <Navigate to="/facility" replace />;
    case 'DISPATCHER':
      return <Navigate to="/dispatcher" replace />;
    case 'PLATFORM_ADMIN':
      return <Navigate to="/admin" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
          <PortalNavbar />
          <Routes>
            {/* Root Route */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public Authentication Routes */}
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />
            <Route path="/invite" element={<InvitationScreen />} />
            <Route path="/invite/:token" element={<InvitationScreen />} />
            <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
            <Route path="/reset-password" element={<ResetPasswordScreen />} />
            <Route path="/unauthorized" element={<UnauthorizedScreen />} />
            <Route path="/session-expired" element={<SessionExpiredScreen />} />
            <Route path="/account-status" element={<AccountStatusScreen />} />

            {/* Protected Role-Based Portals */}
            <Route
              path="/dispatcher"
              element={
                <ProtectedRoute allowedRoles={['DISPATCHER', 'PLATFORM_ADMIN']}>
                  <DispatcherDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/patient"
              element={
                <ProtectedRoute allowedRoles={['PATIENT', 'PLATFORM_ADMIN']}>
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/responder"
              element={
                <ProtectedRoute allowedRoles={['RESPONDER', 'PLATFORM_ADMIN']}>
                  <ResponderDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/facility"
              element={
                <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'PLATFORM_ADMIN']}>
                  <FacilityDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
