import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck } from 'lucide-react';

interface PendingOrg {
  id: string;
  name: string;
  license: string;
  lga: string;
  state: string;
  contact: string;
  date: string;
}

interface PendingDriver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehicleReg: string;
  licenseNumber: string;
  community: string;
}

export const AdminDashboard: React.FC = () => {
  const { session } = useAuth();

  const [pendingHospitals, setPendingHospitals] = useState<PendingOrg[]>([
    {
      id: 'org-hope-02',
      name: 'Hope Community Maternity Clinic',
      license: 'MOH/FCT/2026/412-PENDING',
      lga: 'Bwari',
      state: 'FCT',
      contact: 'Nurse Grace Eze (0809 333 4444)',
      date: 'Today, 09:30 AM',
    },
    {
      id: 'org-st-mary',
      name: 'St. Mary Rural Comprehensive Health Center',
      license: 'MOH/NS/2026/019',
      lga: 'Karu',
      state: 'Nasarawa',
      contact: 'Dr. John Danladi (0802 444 8899)',
      date: 'Yesterday, 04:15 PM',
    },
  ]);

  const [pendingResponders, setPendingResponders] = useState<PendingDriver[]>([
    {
      id: 'resp-pending',
      name: 'Sani Dauda',
      phone: '0802 111 2233',
      vehicleType: 'TAXI',
      vehicleReg: 'RSH-204-XY',
      licenseNumber: 'DL-90812-FCT',
      community: 'Lugbe Sector 1',
    },
    {
      id: 'resp-009',
      name: 'Bello Garba',
      phone: '0803 777 9900',
      vehicleType: 'MOTORCYCLE',
      vehicleReg: 'ABJ-319-QA',
      licenseNumber: 'DL-44102-FCT',
      community: 'Mpape Hills',
    },
  ]);

  const handleApproveHospital = (id: string) => {
    setPendingHospitals((prev) => prev.filter((h) => h.id !== id));
  };

  const handleRejectHospital = (id: string) => {
    setPendingHospitals((prev) => prev.filter((h) => h.id !== id));
  };

  const handleApproveDriver = (id: string) => {
    setPendingResponders((prev) => prev.filter((d) => d.id !== id));
  };

  const handleRejectDriver = (id: string) => {
    setPendingResponders((prev) => prev.filter((d) => d.id !== id));
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
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={22} color="#0f1a2c" />
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Platform Administration & Regulatory Oversight
              </h1>
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
              Ministry of Health credential verification, facility licensing & compliance authority
            </p>
          </div>

          <div
            style={{
              padding: '6px 12px',
              backgroundColor: '#0f1a2c',
              color: '#ffffff',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            Signed in: {session.user?.fullName} (Platform Administrator)
          </div>
        </div>

        {/* 1. Pending Hospital Applications */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '18px',
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Pending Hospital Facility Applications ({pendingHospitals.length})
              </h2>
              <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                Unapproved healthcare facilities cannot receive ambulance dispatches or appear on the emergency grid
              </p>
            </div>
          </div>

          <div style={{ border: '1px solid #eaecf0', borderRadius: '6px', overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr 130px',
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #eaecf0',
                fontSize: '10px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.5px',
              }}
            >
              <div>FACILITY NAME</div>
              <div>LICENSE ID</div>
              <div>LGA / STATE</div>
              <div>ADMIN CONTACT</div>
              <div style={{ textAlign: 'right' }}>ACTION</div>
            </div>

            <div>
              {pendingHospitals.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  No hospital applications currently pending approval.
                </div>
              ) : (
                pendingHospitals.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1.2fr 1fr 1.2fr 130px',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{h.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#475467' }}>
                      {h.license}
                    </div>
                    <div style={{ color: '#475467' }}>{h.lga}, {h.state}</div>
                    <div style={{ color: '#334155' }}>{h.contact}</div>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleRejectHospital(h.id)}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #fecdca',
                          backgroundColor: '#fef3f2',
                          color: '#b42318',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveHospital(h.id)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#12b76a',
                          color: '#ffffff',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 2. Pending Responder Verifications */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '18px',
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Pending Driver Credential Verifications ({pendingResponders.length})
              </h2>
              <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                Responders remain strictly OFFLINE until their driver's license and vehicle inspection pass review
              </p>
            </div>
          </div>

          <div style={{ border: '1px solid #eaecf0', borderRadius: '6px', overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr 1fr 130px',
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #eaecf0',
                fontSize: '10px',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.5px',
              }}
            >
              <div>DRIVER NAME</div>
              <div>PHONE</div>
              <div>VEHICLE</div>
              <div>DRIVER'S LICENSE</div>
              <div>COMMUNITY</div>
              <div style={{ textAlign: 'right' }}>ACTION</div>
            </div>

            <div>
              {pendingResponders.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  No responder credentials currently pending inspection.
                </div>
              ) : (
                pendingResponders.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr 1fr 130px',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{d.name}</div>
                    <div style={{ color: '#475467' }}>{d.phone}</div>
                    <div style={{ color: '#0f172a', fontWeight: 500 }}>
                      {d.vehicleType} ({d.vehicleReg})
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#475467' }}>
                      {d.licenseNumber}
                    </div>
                    <div style={{ color: '#475467' }}>{d.community}</div>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleRejectDriver(d.id)}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #fecdca',
                          backgroundColor: '#fef3f2',
                          color: '#b42318',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveDriver(d.id)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#12b76a',
                          color: '#ffffff',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Verify Driver
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
