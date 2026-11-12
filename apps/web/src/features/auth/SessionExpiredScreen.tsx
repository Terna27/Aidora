import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Clock, LogIn } from 'lucide-react';

export const SessionExpiredScreen: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async () => {
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
          width: '420px',
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
            backgroundColor: '#fffaeb',
            color: '#b54708',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
          }}
        >
          <Clock size={24} />
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#101828', margin: 0 }}>
          Session Expired
        </h1>

        <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 20px 0', lineHeight: 1.5 }}>
          Your security authorization session has elapsed. Please sign in again to resume emergency coordination.
        </p>

        <button
          onClick={handleSignIn}
          style={{
            width: '100%',
            height: '40px',
            backgroundColor: '#0f1a2c',
            color: '#ffffff',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <LogIn size={15} />
          <span>Sign In Again</span>
        </button>
      </div>
    </div>
  );
};
