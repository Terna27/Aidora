import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

export const UnauthorizedScreen: React.FC = () => {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const attemptedPath = (location.state as { attemptedPath?: string })?.attemptedPath || 'restricted area';

  const getAuthorizedHome = () => {
    if (!session.user) return '/login';
    switch (session.user.role) {
      case 'PATIENT':
        return '/patient';
      case 'RESPONDER':
        return '/responder';
      case 'HOSPITAL_ADMIN':
      case 'HOSPITAL_STAFF':
        return '/facility';
      case 'DISPATCHER':
        return '/dispatcher';
      case 'PLATFORM_ADMIN':
        return '/admin';
      default:
        return '/login';
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 42px)',
        backgroundColor: '#f6f7fb',
        padding: '32px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '460px',
          maxWidth: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #eaecf0',
          boxShadow: '0 4px 16px rgba(16, 24, 40, 0.06)',
          padding: '32px 28px',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: '#fef3f2',
            color: '#b42318',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
          }}
        >
          <ShieldAlert size={24} />
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#101828', margin: 0 }}>
          Access Restricted
        </h1>

        <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 16px 0', lineHeight: 1.5 }}>
          Your authenticated role (<strong>{session.user?.role || 'User'}</strong>) does not have authorization to access <code>{attemptedPath}</code>.
        </p>

        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #eaecf0',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '12px',
            color: '#344054',
            marginBottom: '20px',
            textAlign: 'left',
          }}
        >
          <div><strong>Signed in as:</strong> {session.user?.fullName} ({session.user?.phoneNumber})</div>
          <div><strong>Role:</strong> {session.user?.role}</div>
          {session.user?.organization && (
            <div><strong>Organization:</strong> {session.user.organization.organizationName}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => navigate(getAuthorizedHome(), { replace: true })}
            style={{
              height: '38px',
              padding: '0 18px',
              backgroundColor: '#0f1a2c',
              color: '#ffffff',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '12.5px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={14} />
            <span>Return to Your Portal</span>
          </button>

          <button
            onClick={handleLogout}
            style={{
              height: '38px',
              padding: '0 16px',
              border: '1px solid #d0d5dd',
              backgroundColor: '#ffffff',
              color: '#344054',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
