import React from 'react';
import { DispatcherStats } from '../../types/dispatcher';

interface DispatcherStatCardsProps {
  stats: DispatcherStats;
}

export const DispatcherStatCards: React.FC<DispatcherStatCardsProps> = ({ stats }) => {
  const cards = [
    {
      label: 'Critical waiting',
      value: stats.criticalWaiting,
      color: '#df2b1a',
    },
    {
      label: 'Urgent waiting',
      value: stats.urgentWaiting,
      color: '#f79009',
    },
    {
      label: 'Units en route',
      value: stats.unitsEnRoute,
      color: '#0f1a2c',
    },
    {
      label: 'Units available',
      value: stats.unitsAvailable,
      color: '#12b76a',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '18px',
        width: '100%',
      }}
    >
      {cards.map((card, idx) => (
        <div
          key={idx}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '7px',
            border: '1px solid #eaecf0',
            padding: '12px 16px',
            height: '78px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#667085',
              letterSpacing: '-0.1px',
            }}
          >
            {card.label}
          </span>
          <span
            style={{
              fontSize: '26px',
              fontWeight: 700,
              color: card.color,
              lineHeight: 1,
              letterSpacing: '-0.5px',
            }}
          >
            {card.value}
          </span>
        </div>
      ))}
    </div>
  );
};
