import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Clock,
  ShieldAlert,
  LogOut,
  RefreshCw,
} from 'lucide-react';

export const AccountStatusScreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get('status') || 'pending_approval';
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const isSuspended = statusParam === 'suspended' || session.user?.verificationStatus === 'SUSPENDED';

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
          width: '520px',
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
        {isSuspended ? (
          <>
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#fef3f2',
                color: '#b42318',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <ShieldAlert size={26} />
            </div>

            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#101828', margin: 0 }}>
              Account Suspended
            </h1>

            <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 20px 0', lineHeight: 1.5 }}>
              This account or organization has been suspended by dispatch regulatory compliance.
              Access to emergency dispatches and operational coordination is currently restricted.
            </p>

            <div
              style={{
                backgroundColor: '#fef3f2',
                border: '1px solid #fecdca',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '12px',
                color: '#7a271a',
                textAlign: 'left',
                marginBottom: '20px',
              }}
            >
              <div><strong>Account Name:</strong> {session.user?.fullName}</div>
              <div><strong>Status:</strong> SUSPENDED</div>
              <div><strong>Contact:</strong> compliance@aidora.org or call +234 800 AIDORA</div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#fffaeb',
                color: '#b54708',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Clock size={26} />
            </div>

            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#101828', margin: 0 }}>
              Application Under Review
            </h1>

            <p style={{ fontSize: '13px', color: '#64748b', margin: '8px 0 20px 0', lineHeight: 1.5 }}>
              Your healthcare facility registration application has been submitted and is currently pending verification
              by the Ministry of Health and regional emergency dispatch authority.
            </p>

            {session.user?.organization && (
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #eaecf0',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  fontSize: '12px',
                  color: '#344054',
                  textAlign: 'left',
                  marginBottom: '20px',
                }}
              >
                <div><strong>Facility:</strong> {session.user.organization.organizationName}</div>
                <div><strong>License ID:</strong> {session.user.organization.licenseNumber || 'Under Review'}</div>
                <div><strong>LGA / State:</strong> {session.user.organization.lga}, {session.user.organization.state}</div>
                <div style={{ marginTop: '6px', color: '#b54708', fontWeight: 600 }}>
                  Current Status: PENDING APPROVAL
                </div>
              </div>
            )}

            <div
              style={{
                backgroundColor: '#eff8ff',
                border: '1px solid #b2ddff',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '11.5px',
                color: '#175cd3',
                lineHeight: 1.4,
                marginBottom: '20px',
                textAlign: 'left',
              }}
            >
              <strong>What happens next?</strong> Once health ministry officials verify your facility license, bed telemetry, and maternity triage setup, you will receive an activation SMS/email granting full operational access to the Facility Portal.
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              height: '38px',
              padding: '0 16px',
              border: '1px solid #d0d5dd',
              backgroundColor: '#ffffff',
              color: '#344054',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            <span>Check Status</span>
          </button>

          <button
            onClick={handleLogout}
            style={{
              height: '38px',
              padding: '0 18px',
              backgroundColor: '#0f1a2c',
              color: '#ffffff',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '12.5px',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
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
