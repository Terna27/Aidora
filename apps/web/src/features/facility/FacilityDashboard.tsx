import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { facilityService } from '../../services/facilityService';
import { FacilityDashboardData } from '../../types/facility';

export const FacilityDashboard: React.FC = () => {
  const [data, setData] = useState<FacilityDashboardData>(facilityService.getDashboardData());

  const refresh = () => {
    setData(facilityService.getDashboardData());
  };

  useEffect(() => {
    refresh();
    const unsub = facilityService.subscribe(refresh);
    return () => unsub();
  }, []);

  const handleAdmit = (emergencyId: string) => {
    facilityService.admitTransfer(emergencyId);
  };

  const handleAdjustBeds = (delta: number) => {
    facilityService.updateAvailableBeds(delta);
  };

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: '24px',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            padding: '18px 22px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 color="#175cd3" size={22} />
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {data.facility.name} — Triage & Intake Command
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0 0' }}>
              {data.facility.address} · Lead: {data.onDutyLead} · Tel: {data.facility.contactPhone}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                backgroundColor: '#ecfdf3',
                color: '#027a48',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              Emergency Department Active
            </span>
          </div>
        </div>

        {/* Capacity Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '7px', border: '1px solid #eaecf0', padding: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>AVAILABLE BEDS</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '26px', fontWeight: 700, color: '#12b76a' }}>
                {data.availableBeds}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>/ {data.facility.totalBeds} total</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              <button
                onClick={() => handleAdjustBeds(-1)}
                style={{
                  padding: '2px 8px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                -1 Bed
              </button>
              <button
                onClick={() => handleAdjustBeds(1)}
                style={{
                  padding: '2px 8px',
                  border: '1px solid #d0d5dd',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                +1 Bed
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '7px', border: '1px solid #eaecf0', padding: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>OCCUPANCY RATE</span>
            <div style={{ fontSize: '26px', fontWeight: 700, color: data.occupancyRate > 90 ? '#df2b1a' : '#0f1a2c', marginTop: '4px' }}>
              {data.occupancyRate}%
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '7px', border: '1px solid #eaecf0', padding: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>INBOUND AMBULANCES</span>
            <div style={{ fontSize: '26px', fontWeight: 700, color: '#175cd3', marginTop: '4px' }}>
              {data.incomingTransfers.length}
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '7px', border: '1px solid #eaecf0', padding: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>TRAUMA & MATERNITY</span>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#027a48', marginTop: '8px' }}>
              LEVEL 1 READY
            </div>
          </div>
        </div>

        {/* Inbound Transfers Table */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '18px',
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
          }}
        >
          <div style={{ marginBottom: '14px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Live Inbound Emergency Transfers ({data.incomingTransfers.length})
            </h2>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
              Real-time telemetry and responder ETA for active ambulance and motor-medic convoys
            </p>
          </div>

          <div style={{ border: '1px solid #eaecf0', borderRadius: '6px', overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 1.2fr 1.2fr 1fr 110px 100px',
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #eaecf0',
                fontSize: '10px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.5px',
              }}
            >
              <div>SEVERITY</div>
              <div>PATIENT / COMPLAINT</div>
              <div>RESPONDER & UNIT</div>
              <div>STATUS</div>
              <div>ETA</div>
              <div style={{ textAlign: 'right' }}>ACTION</div>
            </div>

            <div>
              {data.incomingTransfers.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                  No inbound emergency transfers currently en route to this facility
                </div>
              ) : (
                data.incomingTransfers.map((item) => (
                  <div
                    key={item.emergencyId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1.2fr 1.2fr 1fr 110px 100px',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '11.5px',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          backgroundColor: item.severity === 'CRITICAL' ? '#fef3f2' : '#fffaeb',
                          color: item.severity === 'CRITICAL' ? '#b42318' : '#b54708',
                          border: `1px solid ${item.severity === 'CRITICAL' ? '#fecdca' : '#fedf89'}`,
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '9.5px',
                          fontWeight: 700,
                        }}
                      >
                        {item.severity}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.patientName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{item.chiefComplaint}</div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{item.responderName}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>{item.vehicleType}</div>
                    </div>

                    <div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          backgroundColor: '#eff8ff',
                          color: '#175cd3',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      ~{item.etaMinutes} min
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleAdmit(item.emergencyId)}
                        style={{
                          backgroundColor: '#0f1a2c',
                          color: '#ffffff',
                          padding: '5px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Admit Patient
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
