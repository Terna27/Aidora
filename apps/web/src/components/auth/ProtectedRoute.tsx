import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { session } = useAuth();
  const location = useLocation();

  // 1. Unauthenticated check
  if (!session.isAuthenticated || !session.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Session expiry check
  if (session.tokenExpiry && new Date(session.tokenExpiry).getTime() < Date.now()) {
    return <Navigate to="/session-expired" replace />;
  }

  // 3. Organization approval status check
  if (session.user.organization && session.user.organization.approvalStatus === 'PENDING_APPROVAL') {
    // If accessing facility dashboard while unapproved, show status page
    if (location.pathname.startsWith('/facility')) {
      return <Navigate to="/account-status?status=pending_approval" replace />;
    }
  }

  // 4. Account suspension check
  if (
    session.user.verificationStatus === 'SUSPENDED' ||
    session.user.organization?.approvalStatus === 'SUSPENDED'
  ) {
    return <Navigate to="/account-status?status=suspended" replace />;
  }

  // 5. Role authorization check
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = session.user.role;
    let isAuthorized = allowedRoles.includes(userRole);

    // Support both HOSPITAL_ADMIN and HOSPITAL_STAFF for facility routes
    if (
      !isAuthorized &&
      (userRole === 'HOSPITAL_ADMIN' || userRole === 'HOSPITAL_STAFF') &&
      (allowedRoles.includes('HOSPITAL_ADMIN') || allowedRoles.includes('HOSPITAL_STAFF'))
    ) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return <Navigate to="/unauthorized" state={{ attemptedPath: location.pathname }} replace />;
    }
  }

  return <>{children}</>;
};
