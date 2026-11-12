import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export const ResetPasswordScreen: React.FC = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token.trim()) {
      setErrorMessage('Verification OTP code is required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPassword({
        token: token.trim(),
        newPassword,
        confirmPassword,
      });

      if (res.success) {
        setIsSuccess(true);
      } else {
        setErrorMessage(res.error || 'Failed to reset password.');
      }
    } finally {
      setIsSubmitting(false);
    }
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
          padding: '28px 24px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#ecfdf3',
              color: '#027a48',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: '#101828', margin: 0 }}>
            Set New Password
          </h1>
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
            Enter your verification code and choose a new secure password
          </p>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '16px',
                color: '#166534',
                fontSize: '13px',
                lineHeight: 1.5,
                marginBottom: '18px',
              }}
            >
              <CheckCircle2 size={24} color="#16a34a" style={{ margin: '0 auto 6px auto', display: 'block' }} />
              <strong>Password Reset Successfully</strong>
              <div style={{ marginTop: '4px' }}>You can now sign in using your new credentials.</div>
            </div>

            <button
              onClick={() => navigate('/login')}
              style={{
                width: '100%',
                height: '38px',
                backgroundColor: '#0f1a2c',
                color: '#ffffff',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '12.5px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Sign In Now
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {errorMessage && (
              <div
                style={{
                  backgroundColor: '#fef3f2',
                  border: '1px solid #fecdca',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '14px',
                  color: '#b42318',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            <FormField label="Verification OTP Code" required hint="6-digit code received via SMS">
              <input
                type="text"
                required
                placeholder="e.g. 849201"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '6px',
                  border: '1px solid #d0d5dd',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  boxSizing: 'border-box',
                }}
              />
            </FormField>

            <FormField label="New Password" required hint="Minimum 6 characters">
              <PasswordInput
                required
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </FormField>

            <FormField label="Confirm New Password" required>
              <PasswordInput
                required
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </FormField>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                height: '40px',
                backgroundColor: '#0f1a2c',
                color: '#ffffff',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                marginTop: '6px',
              }}
            >
              {isSubmitting ? 'Resetting...' : 'Update Password'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px' }}>
          <Link to="/login" style={{ color: '#475467', textDecoration: 'none', fontWeight: 600 }}>
            Cancel & Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
};
