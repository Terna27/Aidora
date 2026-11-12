import React from 'react';
import { DispatcherCase } from '../../types/dispatcher';

interface SelectedCaseCardProps {
  selectedCase: DispatcherCase | null;
  onDispatch: (caseId: string) => void;
  isDispatching?: boolean;
}

export const SelectedCaseCard: React.FC<SelectedCaseCardProps> = ({
  selectedCase,
  onDispatch,
  isDispatching = false,
}) => {
  if (!selectedCase) {
    return (
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '7px',
          border: '1px solid #eaecf0',
          padding: '24px 16px',
          width: '100%',
          boxSizing: 'border-box',
          textAlign: 'center',
          color: '#667085',
          fontSize: '12px',
        }}
      >
        Select an emergency case to view live details
      </div>
    );
  }

  const renderBadge = (severity: DispatcherCase['severity']) => {
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

  const isEnRoute = selectedCase.status === 'EN_ROUTE';

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
        display: 'flex',
        flexDirection: 'column',
        gap: '11px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2
          style={{
            fontSize: '13.5px',
            fontWeight: 700,
            color: '#101828',
            margin: 0,
            letterSpacing: '-0.2px',
          }}
        >
          Selected case
        </h2>
        <div>{renderBadge(selectedCase.severity)}</div>
      </div>

      {/* Map Preview */}
      <div
        style={{
          height: '92px',
          backgroundColor: '#edf4fc',
          borderRadius: '5px',
          border: '1px solid #dce7f3',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Subtle grid background */}
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0, opacity: 0.65 }}
        >
          <defs>
            <pattern id="gridPattern" width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M 22 0 L 0 0 0 22" fill="none" stroke="#d5e3f3" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridPattern)" />
          {/* Subtle simulated road vectors */}
          <path d="M -10 30 Q 120 70 330 20" fill="none" stroke="#cfdfef" strokeWidth="2.5" />
          <path d="M 160 -10 Q 170 60 180 120" fill="none" stroke="#cfdfef" strokeWidth="2.5" />
        </svg>

        {/* Live map badge */}
        <div
          style={{
            position: 'absolute',
            top: '7px',
            right: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.94)',
            border: '1px solid #d0dbe7',
            borderRadius: '3px',
            padding: '1.5px 5px',
            fontSize: '8.5px',
            fontWeight: 600,
            color: '#344054',
            display: 'flex',
            alignItems: 'center',
            gap: '3.5px',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: '4.5px',
              height: '4.5px',
              borderRadius: '50%',
              backgroundColor: '#12b76a',
            }}
          />
          <span>Live map</span>
        </div>

        {/* Pulsating marker */}
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '52%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
          }}
        >
          <div
            className="pulse-ring"
            style={{
              position: 'absolute',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: 'rgba(223, 43, 26, 0.35)',
            }}
          />
          <div
            style={{
              width: '8.5px',
              height: '8.5px',
              borderRadius: '50%',
              backgroundColor: '#df2b1a',
              boxShadow: '0 0 0 2px #ffffff',
            }}
          />
        </div>
      </div>

      {/* 2x2 Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '9px 12px',
          marginTop: '1px',
        }}
      >
        <div>
          <div style={{ fontSize: '9.5px', color: '#667085', fontWeight: 500 }}>Reported by</div>
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#101828',
              marginTop: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {selectedCase.reportedBy}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9.5px', color: '#667085', fontWeight: 500 }}>Awake</div>
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: selectedCase.awake === 'No' ? 700 : 600,
              color: selectedCase.awake === 'No' ? '#df2b1a' : '#101828',
              marginTop: '1px',
            }}
          >
            {selectedCase.awake}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9.5px', color: '#667085', fontWeight: 500 }}>Blood group</div>
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#101828',
              marginTop: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {selectedCase.bloodGroup}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '9.5px', color: '#667085', fontWeight: 500 }}>Caller note</div>
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#101828',
              marginTop: '1px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={selectedCase.callerNote}
          >
            {selectedCase.callerNote}
          </div>
        </div>
      </div>

      {/* Dispatch Button */}
      <div style={{ marginTop: '3px' }}>
        {isEnRoute ? (
          <button
            disabled
            style={{
              width: '100%',
              height: '35px',
              backgroundColor: '#f2f4f7',
              color: '#084681',
              borderRadius: '5px',
              border: '1px solid #d0d5dd',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'not-allowed',
            }}
          >
            {selectedCase.assignedUnitLabel || 'Unit en route'}
          </button>
        ) : (
          <button
            onClick={() => onDispatch(selectedCase.id)}
            disabled={isDispatching}
            style={{
              width: '100%',
              height: '35px',
              backgroundColor: '#df2b1a',
              color: '#ffffff',
              borderRadius: '5px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#c82414';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#df2b1a';
            }}
          >
            {isDispatching ? 'Assigning unit...' : 'Dispatch nearest unit'}
          </button>
        )}
      </div>
    </div>
  );
};
