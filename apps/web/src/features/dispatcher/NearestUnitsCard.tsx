import React from 'react';
import { DispatcherUnit } from '../../types/dispatcher';

interface NearestUnitsCardProps {
  units: DispatcherUnit[];
}

export const NearestUnitsCard: React.FC<NearestUnitsCardProps> = ({ units }) => {
  // Show top 3 nearest units matching screenshot
  const displayUnits = units.slice(0, 3);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '7px',
        border: '1px solid #eaecf0',
        padding: '13px 14px',
        width: '100%',
        boxSizing: 'border-box',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
      }}
    >
      <h3
        style={{
          fontSize: '13.5px',
          fontWeight: 700,
          color: '#101828',
          margin: '0 0 10px 0',
          letterSpacing: '-0.2px',
        }}
      >
        Nearest available
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {displayUnits.map((unit) => {
          const isReturning = unit.status === 'RETURNING' || unit.isReturning;
          const dotColor = isReturning ? '#f79009' : '#12b76a';

          return (
            <div
              key={unit.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#101828',
                  }}
                >
                  {unit.name}
                </span>
              </div>

              <div>
                {isReturning ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: '#b54708',
                    }}
                  >
                    Returning
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#667085',
                    }}
                  >
                    [x] km
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
