import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { UserRole } from '../../types/auth';
import { AlertCircle, Lock, Sparkles } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login, isMockMode, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || null;

  const getRoleDestination = (role: UserRole): string => {
    switch (role) {
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
        return '/patient';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Phone number or email address is required.');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    const res = await login({
      identifier: identifier.trim(),
      password,
      targetRole,
    });

    if (res.success && res.session?.user) {
      const dest = from || getRoleDestination(res.session.user.role);
      navigate(dest, { replace: true });
    } else {
      setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
    }
  };

  // Quick helper for development fixture fast-track
  const handleFastTrack = async (testId: string, role: UserRole) => {
    setIdentifier(testId);
    setPassword('secret123');
    setTargetRole(role);
    setErrorMessage(null);

    const res = await login({
      identifier: testId,
      password: 'secret123',
      targetRole: role,
    });

    if (res.success && res.session?.user) {
      navigate(getRoleDestination(res.session.user.role), { replace: true });
    } else {
      setErrorMessage(res.error || 'Fast-track failed');
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 42px)',
        backgroundColor: '#f6f7fb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '440px',
          maxWidth: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #eaecf0',
          boxShadow: '0 4px 16px rgba(16, 24, 40, 0.06)',
          padding: '28px 26px',
          boxSizing: 'border-box',
        }}
      >
        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#df2b1a',
              borderRadius: '7px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '22px',
              marginBottom: '10px',
            }}
          >
            +
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#101828', margin: 0 }}>
            Sign in to Aidora
          </h1>
          <p style={{ fontSize: '12.5px', color: '#667085', margin: '4px 0 0 0' }}>
            Emergency transport & maternal healthcare operations
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef3f2',
              border: '1px solid #fecdca',
              borderRadius: '6px',
              padding: '10px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#b42318',
              fontSize: '12px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <FormField label="Phone Number or Official Email" required>
            <input
              type="text"
              required
              placeholder="e.g. 0803 123 4567 or user@organization.org"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                borderRadius: '6px',
                border: '1px solid #d0d5dd',
                padding: '0 12px',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </FormField>

          <FormField label="Password" required>
            <PasswordInput
              required
              placeholder="Enter your account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#475467' }}>
              <input type="checkbox" defaultChecked />
              <span>Remember this browser</span>
            </label>

            <Link
              to="/forgot-password"
              style={{ fontSize: '11.5px', color: '#175cd3', textDecoration: 'none', fontWeight: 600 }}
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '40px',
              backgroundColor: '#0f1a2c',
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Lock size={14} />
            <span>{loading ? 'Authenticating...' : 'Sign in to Portal'}</span>
          </button>
        </form>

        {/* Links to Register and Invite */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #eaecf0',
            textAlign: 'center',
            fontSize: '12px',
            color: '#667085',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div>
            Need an account?{' '}
            <Link to="/register" style={{ color: '#df2b1a', fontWeight: 700, textDecoration: 'none' }}>
              Create Account
            </Link>
          </div>

          <div>
            Invited by a hospital or dispatch team?{' '}
            <Link to="/invite" style={{ color: '#175cd3', fontWeight: 600, textDecoration: 'none' }}>
              Accept Organization Invitation
            </Link>
          </div>
        </div>
      </div>

      {/* Development Fixture Fast-Track Banner (Only shown in mock mode) */}
      {isMockMode && (
        <div
          style={{
            width: '440px',
            maxWidth: '100%',
            marginTop: '16px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px dashed #d0d5dd',
            padding: '12px 14px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Sparkles size={14} color="#f79009" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#344054', textTransform: 'uppercase' }}>
              Development Test Identities (Fast-Track)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            <button
              onClick={() => handleFastTrack('08031234567', 'PATIENT')}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #e4e7ec',
                backgroundColor: '#f8fafc',
                textAlign: 'left',
              }}
            >
              🤰 <strong>Patient</strong> (Amina)
            </button>

            <button
              onClick={() => handleFastTrack('08025557890', 'RESPONDER')}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #e4e7ec',
                backgroundColor: '#f8fafc',
                textAlign: 'left',
              }}
            >
              🏍️ <strong>Responder</strong> (Verified)
            </button>

            <button
              onClick={() => handleFastTrack('08021112233', 'RESPONDER')}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #e4e7ec',
                backgroundColor: '#fffbeb',
                color: '#b45309',
                textAlign: 'left',
              }}
            >
              🚗 <strong>Responder</strong> (Pending)
            </button>

            <button
              onClick={() => handleFastTrack('08009990001', 'HOSPITAL_ADMIN')}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #e4e7ec',
                backgroundColor: '#f8fafc',
                textAlign: 'left',
              }}
            >
              🏥 <strong>Hospital</strong> (Approved)
            </button>

            <button
              onClick={() => handleFastTrack('08093334444', 'HOSPITAL_ADMIN')}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #e4e7ec',
                backgroundColor: '#fffbeb',
                color: '#b45309',
                textAlign: 'left',
              }}
            >
              🏥 <strong>Hospital</strong> (Pending)
            </button>

            <button
              onClick={() => handleFastTrack('08077778899', 'DISPATCHER')}
              style={{
                padding: '6px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid #e4e7ec',
                backgroundColor: '#f8fafc',
                textAlign: 'left',
              }}
            >
              📻 <strong>Dispatcher</strong> (N. Eze)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
