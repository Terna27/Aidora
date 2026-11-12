import React from 'react';
import { Search, Plus } from 'lucide-react';

interface DispatcherHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewCaseClick: () => void;
}

export const DispatcherHeader: React.FC<DispatcherHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onNewCaseClick,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        width: '100%',
      }}
    >
      {/* Title & Subtitle */}
      <div>
        <h1
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#101828',
            margin: 0,
            lineHeight: 1.25,
            letterSpacing: '-0.3px',
          }}
        >
          Live queue
        </h1>
        <p
          style={{
            fontSize: '11.5px',
            color: '#667085',
            margin: '2px 0 0 0',
            fontWeight: 400,
          }}
        >
          Sorted by severity, then waiting time
        </p>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={13}
            color="#98a2b3"
            style={{
              position: 'absolute',
              left: '9px',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search cases..."
            style={{
              width: '144px',
              height: '32px',
              borderRadius: '6px',
              border: '1px solid #d0d5dd',
              paddingLeft: '28px',
              paddingRight: '8px',
              fontSize: '11.5px',
              color: '#101828',
              backgroundColor: '#ffffff',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#175cd3';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(23, 92, 211, 0.12)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#d0d5dd';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        <button
          onClick={onNewCaseClick}
          style={{
            height: '32px',
            backgroundColor: '#0f1a2c',
            color: '#ffffff',
            borderRadius: '6px',
            padding: '0 11px',
            fontSize: '11.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1a2c47';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#0f1a2c';
          }}
        >
          <Plus size={14} strokeWidth={2.4} />
          <span>New case</span>
        </button>
      </div>
    </div>
  );
};
