import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FormField } from '../../components/forms/FormField';
import { KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export const ForgotPasswordScreen: React.FC = () => {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Please enter your phone number or email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await forgotPassword({ identifier: identifier.trim() });
      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        setErrorMessage(res.error || 'Failed to initiate password reset.');
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
              backgroundColor: '#fef3f2',
              color: '#df2b1a',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            <KeyRound size={20} />
          </div>
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: '#101828', margin: 0 }}>
            Recover Your Password
          </h1>
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
            We'll dispatch an SMS OTP verification code to reset your account password
          </p>
        </div>

        {successMessage ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '14px',
                color: '#166534',
                fontSize: '12.5px',
                lineHeight: 1.5,
                marginBottom: '18px',
              }}
            >
              <CheckCircle2 size={24} color="#16a34a" style={{ margin: '0 auto 6px auto', display: 'block' }} />
              <strong>Instructions Dispatched</strong>
              <div>{successMessage}</div>
            </div>

            <button
              onClick={() => navigate('/reset-password')}
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
              Proceed to Enter Verification OTP
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

            <FormField label="Registered Phone Number or Email" required>
              <input
                type="text"
                required
                placeholder="e.g. 0803 123 4567"
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
                }}
              />
            </FormField>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: '100%',
                height: '40px',
                backgroundColor: '#df2b1a',
                color: '#ffffff',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                marginTop: '6px',
              }}
            >
              {isSubmitting ? 'Sending Instructions...' : 'Send Recovery OTP'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#475467',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={13} />
            <span>Back to Sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
