import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Radio, HeartPulse, Bike, Building2, ShieldCheck, LogOut, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

export const PortalNavbar: React.FC = () => {
  const { session, logout, isMockMode } = useAuth();
  const navigate = useNavigate();
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const online = await apiClient.checkBackendHealth();
      if (mounted) setIsBackendOnline(online);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const user = session.user;

  return (
    <header
      style={{
        height: '42px',
        backgroundColor: '#0a1220',
        borderBottom: '1px solid #1a273d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        color: '#94a3b8',
        fontSize: '12px',
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              backgroundColor: '#df2b1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '12px',
              lineHeight: 1,
            }}
          >
            +
          </div>
          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '13px', letterSpacing: '-0.2px' }}>
            Aidora Operations
          </span>
        </div>

        {/* Portal Nav Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <NavLink
            to="/dispatcher"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? '#1e293b' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              fontSize: '12px',
            })}
          >
            <Radio size={13} />
            <span>Dispatcher</span>
          </NavLink>

          <NavLink
            to="/patient"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? '#1e293b' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              fontSize: '12px',
            })}
          >
            <HeartPulse size={13} />
            <span>Patient</span>
          </NavLink>

          <NavLink
            to="/responder"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? '#1e293b' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              fontSize: '12px',
            })}
          >
            <Bike size={13} />
            <span>Responder</span>
          </NavLink>

          <NavLink
            to="/facility"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '4px',
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? '#1e293b' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? 600 : 500,
              fontSize: '12px',
            })}
          >
            <Building2 size={13} />
            <span>Facility</span>
          </NavLink>

          {/* Admin link if user is PLATFORM_ADMIN */}
          {user?.role === 'PLATFORM_ADMIN' && (
            <NavLink
              to="/admin"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '4px',
                color: isActive ? '#ffffff' : '#94a3b8',
                backgroundColor: isActive ? '#1e293b' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 500,
                fontSize: '12px',
              })}
            >
              <ShieldCheck size={13} />
              <span>Admin</span>
            </NavLink>
          )}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Backend & Mock Mode Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: isBackendOnline ? 'rgba(18, 183, 106, 0.15)' : 'rgba(247, 144, 9, 0.15)',
              color: isBackendOnline ? '#12b76a' : '#f79009',
              fontSize: '10.5px',
              fontWeight: 600,
            }}
            title={isBackendOnline ? 'Backend Online (Go API Server)' : 'Backend Offline / In-Memory Telemetry'}
          >
            {isBackendOnline ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
            <span>{isBackendOnline ? 'API Online' : 'Telemetry Fixture'}</span>
          </div>

          <div
            style={{
              padding: '2px 7px',
              borderRadius: '10px',
              backgroundColor: isMockMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(18, 183, 106, 0.15)',
              color: isMockMode ? '#60a5fa' : '#34d399',
              fontSize: '10.5px',
              fontWeight: 600,
            }}
            title={isMockMode ? 'Mock Auth Active: Identities are local test fixtures' : 'Production Auth Active'}
          >
            {isMockMode ? 'Mock Auth' : 'Prod Auth'}
          </div>
        </div>

        {/* User Identity or Sign In button */}
        {session.isAuthenticated && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
              <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '11.5px' }}>
                {user.fullName}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                {user.role} {user.organization ? `· ${user.organization.organizationName.slice(0, 16)}...` : ''}
              </span>
            </div>

            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                color: '#cbd5e1',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
              title="Sign Out"
            >
              <LogOut size={12} />
              <span>Sign out</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <NavLink
              to="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '4px',
                backgroundColor: '#1e293b',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '11.5px',
              }}
            >
              <LogIn size={12} />
              <span>Sign in</span>
            </NavLink>

            <NavLink
              to="/register"
              style={{
                padding: '4px 9px',
                borderRadius: '4px',
                backgroundColor: '#df2b1a',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '11.5px',
              }}
            >
              <span>Register</span>
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
};
