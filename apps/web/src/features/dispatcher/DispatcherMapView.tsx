import React from 'react';
import { DispatcherCase, DispatcherUnit } from '../../types/dispatcher';

interface DispatcherMapViewProps {
  cases: DispatcherCase[];
  units: DispatcherUnit[];
  onSelectCase: (c: DispatcherCase) => void;
}

export const DispatcherMapView: React.FC<DispatcherMapViewProps> = ({ cases, units, onSelectCase }) => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '7px',
        border: '1px solid #eaecf0',
        padding: '16px',
        width: '100%',
        minHeight: '480px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#101828', margin: 0 }}>
            Operational Geospatial Map
          </h2>
          <p style={{ fontSize: '11.5px', color: '#667085', margin: '2px 0 0 0' }}>
            Live fleet tracking, active incidents, and response zone coverage
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#df2b1a' }} />
            Active Incident ({cases.length})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#12b76a' }} />
            Available Unit ({units.filter((u) => u.status === 'AVAILABLE').length})
          </span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: '380px',
          backgroundColor: '#edf4fc',
          borderRadius: '6px',
          border: '1px solid #dce7f3',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Radar Map Grid */}
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <pattern id="fullMapGrid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#d5e3f3" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#fullMapGrid)" />
          {/* Simulated highway arterials */}
          <path d="M 0 140 C 250 120, 450 320, 800 280" fill="none" stroke="#cfdfef" strokeWidth="4" />
          <path d="M 280 0 C 300 180, 500 240, 520 450" fill="none" stroke="#cfdfef" strokeWidth="4" />
          <path d="M 120 400 L 700 80" fill="none" stroke="#dbe7f4" strokeWidth="2" strokeDasharray="4 4" />
        </svg>

        {/* Incidents Pins */}
        {cases.map((c, i) => {
          const posX = 20 + ((i * 24 + 18) % 65);
          const posY = 25 + ((i * 31 + 12) % 55);
          return (
            <div
              key={c.id}
              onClick={() => onSelectCase(c)}
              style={{
                position: 'absolute',
                top: `${posY}%`,
                left: `${posX}%`,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 10,
              }}
              title={`${c.title} (${c.location})`}
            >
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${c.severity === 'CRITICAL' ? '#df2b1a' : '#f79009'}`,
                  borderRadius: '3px',
                  padding: '1px 5px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: c.severity === 'CRITICAL' ? '#df2b1a' : '#b54708',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  whiteSpace: 'nowrap',
                  marginBottom: '2px',
                }}
              >
                {c.severity} · {c.location}
              </div>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#df2b1a',
                  boxShadow: '0 0 0 3px rgba(223, 43, 26, 0.3)',
                }}
              />
            </div>
          );
        })}

        {/* Units Pins */}
        {units.map((u, i) => {
          const posX = 15 + ((i * 29 + 35) % 70);
          const posY = 15 + ((i * 21 + 45) % 65);
          const isReturning = u.status === 'RETURNING';
          return (
            <div
              key={u.id}
              style={{
                position: 'absolute',
                top: `${posY}%`,
                left: `${posX}%`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 9,
              }}
              title={`${u.name} (${u.status})`}
            >
              <div
                style={{
                  backgroundColor: '#0f1a2c',
                  color: '#ffffff',
                  borderRadius: '3px',
                  padding: '1px 5px',
                  fontSize: '9px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  marginBottom: '2px',
                }}
              >
                {u.name}
              </div>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isReturning ? '#f79009' : '#12b76a',
                  boxShadow: '0 0 0 2px #ffffff',
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
