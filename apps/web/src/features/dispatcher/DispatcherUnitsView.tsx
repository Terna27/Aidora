import React from 'react';
import { DispatcherUnit } from '../../types/dispatcher';

interface DispatcherUnitsViewProps {
  units: DispatcherUnit[];
}

export const DispatcherUnitsView: React.FC<DispatcherUnitsViewProps> = ({ units }) => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '7px',
        border: '1px solid #eaecf0',
        padding: '16px',
        width: '100%',
        minHeight: '480px',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#101828', margin: 0 }}>
          Fleet Units & Operational Readiness
        </h2>
        <p style={{ fontSize: '11.5px', color: '#667085', margin: '2px 0 0 0' }}>
          Registered responder fleet, current active duties, vehicle types, and real-time status
        </p>
      </div>

      <div
        style={{
          border: '1px solid #eaecf0',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr',
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #eaecf0',
            fontSize: '10px',
            fontWeight: 700,
            color: '#64748b',
            letterSpacing: '0.5px',
          }}
        >
          <div>UNIT NAME</div>
          <div>TYPE</div>
          <div>REGISTRATION</div>
          <div>DISTANCE / ETA</div>
          <div style={{ textAlign: 'right' }}>OPERATIONAL STATUS</div>
        </div>

        <div>
          {units.map((u) => {
            const isAvailable = u.status === 'AVAILABLE';
            const isReturning = u.status === 'RETURNING';

            return (
              <div
                key={u.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '11.5px',
                }}
              >
                <div style={{ fontWeight: 600, color: '#101828' }}>{u.name}</div>
                <div style={{ color: '#475467' }}>{u.type}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b' }}>
                  {u.regNumber}
                </div>
                <div style={{ color: '#334155' }}>
                  {u.distanceKm ? `${u.distanceKm.toFixed(1)} km` : u.etaMinutes ? `${u.etaMinutes} min ETA` : '—'}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      backgroundColor: isAvailable
                        ? '#ecfdf3'
                        : isReturning
                        ? '#fffaeb'
                        : '#eff8ff',
                      color: isAvailable
                        ? '#027a48'
                        : isReturning
                        ? '#b54708'
                        : '#175cd3',
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: isAvailable
                          ? '#12b76a'
                          : isReturning
                          ? '#f79009'
                          : '#175cd3',
                      }}
                    />
                    {u.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
