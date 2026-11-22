import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { InvitationValidationResult } from '../../types/auth';
import {
  Ticket,
  CheckCircle2,
  AlertTriangle,
  } from 'lucide-react';

export const InvitationScreen: React.FC = () => {
  const { validateInvitation, acceptInvitation, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token: urlParamToken } = useParams<{ token?: string }>();

  const initialToken = urlParamToken || searchParams.get('token') || '';
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<InvitationValidationResult | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const checkToken = async (tok: string) => {
    if (!tok.trim()) return;
    setIsValidating(true);
    setSubmitError(null);
    try {
      const res = await validateInvitation(tok.trim());
      setValidationResult(res);
      if (res.invitedPhone) setPhoneNumber(res.invitedPhone);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      checkToken(initialToken);
    }
  }, [initialToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validationResult || !validationResult.valid) {
      setSubmitError('Cannot accept an invalid or expired invitation token.');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      setSubmitError('You must agree to organization staff terms.');
      return;
    }

    const res = await acceptInvitation({
      token: validationResult.token,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      password,
      confirmPassword,
      agreedToTerms,
    });

    if (res.success && res.session?.user) {
      const role = res.session.user.role;
      if (role === 'DISPATCHER') {
        navigate('/dispatcher', { replace: true });
      } else {
        navigate('/facility', { replace: true });
      }
    } else {
      setSubmitError(res.error || 'Failed to accept invitation.');
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
      }}
    >
      <div
        style={{
          width: '520px',
          maxWidth: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #eaecf0',
          boxShadow: '0 4px 16px rgba(16, 24, 40, 0.06)',
          padding: '28px 26px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#0f1a2c',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              marginBottom: '10px',
            }}
          >
            <Ticket size={20} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#101828', margin: 0 }}>
            Organization Invitation & Staff Token
          </h1>
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
            Hospital staff and dispatchers join through verified agency authorization
          </p>
        </div>

        {/* Step 1: Token Entry if not yet validated */}
        {!validationResult?.valid ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                Invitation Token / Authorization Code
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. HOSP-INV-VALID-2026 or DISP-AUTH-VALID-884"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  style={{
                    flex: 1,
                    height: '38px',
                    borderRadius: '6px',
                    border: '1px solid #d0d5dd',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => checkToken(tokenInput)}
                  disabled={isValidating || !tokenInput.trim()}
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    backgroundColor: '#0f1a2c',
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '12.5px',
                    cursor: isValidating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isValidating ? 'Checking...' : 'Verify Token'}
                </button>
              </div>
            </div>

            {/* Expired or Invalid Alert */}
            {validationResult && !validationResult.valid && (
              <div
                style={{
                  backgroundColor: '#fef3f2',
                  border: '1px solid #fecdca',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  color: '#b42318',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '16px',
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700 }}>Invalid or Expired Invitation</div>
                  <div style={{ marginTop: '2px' }}>
                    {validationResult.error || 'This token could not be verified by the organization registry.'}
                  </div>
                  <div style={{ marginTop: '6px', color: '#667085', fontSize: '11.5px' }}>
                    Hospital staff and dispatchers cannot register without an active token. Please request a new invitation from your hospital administrator or regional dispatch lead.
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          /* Step 2: Validated Invitation Confirmation & Account Creation */
          <div>
            {/* Organization Confirmation Card */}
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <CheckCircle2 size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Verified Organization Invitation
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  {validationResult.organizationName}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
                  Assigned Operational Role: <strong>{validationResult.assignedRole}</strong>
                </div>
              </div>
            </div>

            {submitError && (
              <div
                style={{
                  backgroundColor: '#fef3f2',
                  border: '1px solid #fecdca',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '14px',
                  color: '#b42318',
                  fontSize: '12px',
                }}
              >
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <FormField label="Your Full Name" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nurse Fatima Aliyu"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </FormField>

              <FormField label="Official Phone Number" required>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0805 111 2233"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormField label="Create Password" required>
                  <PasswordInput
                    required
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </FormField>

                <FormField label="Confirm Password" required>
                  <PasswordInput
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </FormField>
              </div>

              <div style={{ margin: '12px 0 18px 0' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: '#475467' }}>
                  <input
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    I confirm that I am the authorized staff member joining <strong>{validationResult.organizationName}</strong> under the role of <strong>{validationResult.assignedRole}</strong>.
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setValidationResult(null)}
                  style={{
                    height: '38px',
                    padding: '0 14px',
                    border: '1px solid #d0d5dd',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#344054',
                  }}
                >
                  Change Token
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    height: '38px',
                    backgroundColor: '#0f1a2c',
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Activating Membership...' : 'Accept Invitation & Enter Portal'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#667085' }}>
          Back to{' '}
          <Link to="/login" style={{ color: '#df2b1a', fontWeight: 700, textDecoration: 'none' }}>
            Login
          </Link>{' '}
          or{' '}
          <Link to="/register" style={{ color: '#175cd3', fontWeight: 600, textDecoration: 'none' }}>
            Register New Organization
          </Link>
        </div>
      </div>
    </div>
  );
};
