import React from 'react';
import { Radio, Map, Users, Clock } from 'lucide-react';
import { DispatcherProfile } from '../../types/dispatcher';

export type DispatcherTab = 'live-queue' | 'map' | 'units' | 'history';

interface DispatcherSidebarProps {
  activeTab: DispatcherTab;
  onTabChange: (tab: DispatcherTab) => void;
  pendingCount: number;
  profile: DispatcherProfile;
  onToggleShift?: () => void;
}

export const DispatcherSidebar: React.FC<DispatcherSidebarProps> = ({
  activeTab,
  onTabChange,
  pendingCount,
  profile,
  onToggleShift,
}) => {
  const navItems: { id: DispatcherTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      id: 'live-queue',
      label: 'Live queue',
      icon: <Radio size={14} strokeWidth={2.4} />,
      badge: pendingCount,
    },
    {
      id: 'map',
      label: 'Map',
      icon: <Map size={14} strokeWidth={2.2} />,
    },
    {
      id: 'units',
      label: 'Units',
      icon: <Users size={14} strokeWidth={2.2} />,
    },
    {
      id: 'history',
      label: 'History',
      icon: <Clock size={14} strokeWidth={2.2} />,
    },
  ];

  return (
    <aside
      style={{
        width: '163px',
        minWidth: '163px',
        maxWidth: '163px',
        backgroundColor: '#0f1a2c',
        height: '100%',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 10px 14px 10px',
        boxSizing: 'border-box',
        color: '#ffffff',
        userSelect: 'none',
      }}
    >
      {/* Top Section */}
      <div>
        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '22px', paddingLeft: '4px' }}>
          <div
            style={{
              width: '22px',
              height: '22px',
              backgroundColor: '#df2b1a',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '15px',
              lineHeight: 1,
            }}
          >
            +
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.3px', color: '#ffffff' }}>
            Aidline
          </span>
          <span
            style={{
              backgroundColor: '#175cd3',
              color: '#ffffff',
              fontSize: '8.5px',
              fontWeight: 700,
              padding: '1.5px 4.5px',
              borderRadius: '3px',
              letterSpacing: '0.4px',
              marginLeft: '1px',
            }}
          >
            DISPATCH
          </span>
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '7px 9px',
                  borderRadius: '5px',
                  backgroundColor: isActive ? '#1c2c44' : 'transparent',
                  color: isActive ? '#ffffff' : '#8c9cb3',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
                  textAlign: 'left',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#152236';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#8c9cb3';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.85 }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#df2b1a',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    {item.badge}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Section */}
      <div
        onClick={onToggleShift}
        title="Click to toggle on-shift status"
        style={{
          backgroundColor: '#17263d',
          borderRadius: '6px',
          padding: '8px 9px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            backgroundColor: '#2d405d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '10px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {profile.initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {profile.name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4.5px' }}>
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: profile.isOnShift ? '#12b76a' : '#94a3b8',
              }}
            />
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 500,
                color: profile.isOnShift ? '#12b76a' : '#94a3b8',
              }}
            >
              {profile.isOnShift ? 'On shift' : 'Off shift'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
