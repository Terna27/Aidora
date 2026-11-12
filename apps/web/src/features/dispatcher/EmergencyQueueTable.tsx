import React from 'react';
import { DispatcherCase } from '../../types/dispatcher';

interface EmergencyQueueTableProps {
  cases: DispatcherCase[];
  selectedCaseId: string | null;
  onSelectCase: (caseItem: DispatcherCase) => void;
  onAssignUnit: (caseId: string, e: React.MouseEvent) => void;
}

export const EmergencyQueueTable: React.FC<EmergencyQueueTableProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onAssignUnit,
}) => {
  const formatWaiting = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const renderSeverityBadge = (severity: DispatcherCase['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span
            style={{
              backgroundColor: '#fef3f2',
              border: '1px solid #fecdca',
              color: '#b42318',
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 5.5px',
              borderRadius: '4px',
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}
          >
            Critical
          </span>
        );
      case 'URGENT':
        return (
          <span
            style={{
              backgroundColor: '#ffefc9',
              border: '1px solid #fedf89',
              color: '#7e2e0d',
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 5.5px',
              borderRadius: '4px',
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}
          >
            Urgent
          </span>
        );
      case 'STABLE':
        return (
          <span
            style={{
              backgroundColor: '#e8f0fd',
              border: '1px solid #b2ddff',
              color: '#084681',
              fontSize: '9px',
              fontWeight: 700,
              padding: '2px 5.5px',
              borderRadius: '4px',
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}
          >
            Stable
          </span>
        );
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '7px',
        border: '1px solid #eaecf0',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: '380px',
      }}
    >
      {/* Table Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '74px 1fr 88px 62px 104px',
          alignItems: 'center',
          padding: '9px 14px',
          borderBottom: '1px solid #eaecf0',
          backgroundColor: '#ffffff',
          color: '#667085',
          fontSize: '9.5px',
          fontWeight: 700,
          letterSpacing: '0.6px',
        }}
      >
        <div>SEVERITY</div>
        <div>EMERGENCY</div>
        <div>LOCATION</div>
        <div>WAITING</div>
        <div style={{ textAlign: 'right' }}>STATUS</div>
      </div>

      {/* Table Rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {cases.length === 0 ? (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              color: '#667085',
              fontSize: '12.5px',
            }}
          >
            No emergency cases matching criteria
          </div>
        ) : (
          cases.map((c, index) => {
            const isSelected = selectedCaseId === c.id;
            const isFirstUnassignedCritical =
              c.severity === 'CRITICAL' && c.status === 'UNASSIGNED' && index === 0;

            return (
              <div
                key={c.id}
                onClick={() => onSelectCase(c)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '74px 1fr 88px 62px 104px',
                  alignItems: 'center',
                  padding: '11px 14px',
                  borderBottom: '1px solid #f2f4f7',
                  backgroundColor: isSelected ? '#fff5f5' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#fafafa';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                {/* Severity */}
                <div>{renderSeverityBadge(c.severity)}</div>

                {/* Emergency (Title + secondary) */}
                <div style={{ paddingRight: '8px', overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#101828',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.title}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#667085',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '1px',
                    }}
                  >
                    {c.secondaryText}
                  </div>
                </div>

                {/* Location */}
                <div
                  style={{
                    fontSize: '11.5px',
                    color: '#475467',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.location}
                </div>

                {/* Waiting */}
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: c.severity === 'CRITICAL' ? 700 : 500,
                    color: c.severity === 'CRITICAL' ? '#b42318' : '#344054',
                    fontFamily: 'inherit',
                  }}
                >
                  {formatWaiting(c.waitingSeconds)}
                </div>

                {/* Status / Action */}
                <div style={{ textAlign: 'right' }}>
                  {c.status === 'EN_ROUTE' ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#084681',
                        letterSpacing: '-0.1px',
                      }}
                    >
                      {c.assignedUnitLabel || 'En route · 6 min'}
                    </span>
                  ) : isFirstUnassignedCritical ? (
                    <button
                      onClick={(e) => onAssignUnit(c.id, e)}
                      style={{
                        backgroundColor: '#df2b1a',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 9px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Assign unit
                    </button>
                  ) : (
                    <button
                      onClick={(e) => onAssignUnit(c.id, e)}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#344054',
                        border: '1px solid #d0d5dd',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 9px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Assign unit
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
