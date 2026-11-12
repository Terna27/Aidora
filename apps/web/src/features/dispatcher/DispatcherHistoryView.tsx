import React from 'react';

export const DispatcherHistoryView: React.FC = () => {
  const pastCases = [
    {
      id: 'disp-hist-101',
      date: 'Today, 06:14 AM',
      title: 'Pediatric seizure / High fever',
      location: 'Kubwa Extension',
      severity: 'CRITICAL',
      duration: '14 min to handover',
      unit: 'Ambulance [UNIT 1]',
      hospital: 'General Hospital Apex',
      status: 'HANDOVER_COMPLETED',
    },
    {
      id: 'disp-hist-102',
      date: 'Today, 05:22 AM',
      title: 'Road traffic collision / 2 casualties',
      location: 'Airport Expressway Km 12',
      severity: 'CRITICAL',
      duration: '21 min to handover',
      unit: 'Rapid response [UNIT 4]',
      hospital: 'National Trauma Center',
      status: 'HANDOVER_COMPLETED',
    },
    {
      id: 'disp-hist-103',
      date: 'Yesterday, 11:45 PM',
      title: 'Post-partum hemorrhage alert',
      location: 'Maitama District',
      severity: 'URGENT',
      duration: '18 min to handover',
      unit: 'Ambulance [UNIT 5]',
      hospital: 'Apex Maternity Wing',
      status: 'HANDOVER_COMPLETED',
    },
  ];

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
          Emergency Dispatch Logs & Operational Audit History
        </h2>
        <p style={{ fontSize: '11.5px', color: '#667085', margin: '2px 0 0 0' }}>
          Historical triage interventions, verified response times, and facility transfers
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
            gridTemplateColumns: '120px 1.4fr 1fr 1fr 1fr',
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #eaecf0',
            fontSize: '10px',
            fontWeight: 700,
            color: '#64748b',
            letterSpacing: '0.5px',
          }}
        >
          <div>TIME</div>
          <div>INCIDENT DETAILS</div>
          <div>LOCATION</div>
          <div>DISPATCHED UNIT</div>
          <div style={{ textAlign: 'right' }}>FACILITY HANDOVER</div>
        </div>

        <div>
          {pastCases.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1.4fr 1fr 1fr 1fr',
                alignItems: 'center',
                padding: '12px 14px',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '11.5px',
              }}
            >
              <div style={{ color: '#64748b', fontSize: '11px' }}>{c.date}</div>
              <div>
                <div style={{ fontWeight: 600, color: '#101828' }}>{c.title}</div>
                <div style={{ fontSize: '10.5px', color: '#12b76a' }}>{c.duration}</div>
              </div>
              <div style={{ color: '#475467' }}>{c.location}</div>
              <div style={{ color: '#334155', fontWeight: 500 }}>{c.unit}</div>
              <div style={{ textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>
                {c.hospital}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
