import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  MapPin,
  UserPlus,
  Trash2,
  Radio,
} from 'lucide-react';
import { patientService } from '../../services/patientService';
import { EmergencyRecord, EmergencyLocation } from '../../types/emergency';
import { PatientProfile } from '../../types/patient';

export const PatientDashboard: React.FC = () => {
  const [profile, setProfile] = useState<PatientProfile>(patientService.getProfile());
  const [activeEmergency, setActiveEmergency] = useState<EmergencyRecord | null>(
    patientService.getActiveEmergency()
  );
  const [history, setHistory] = useState<EmergencyRecord[]>(patientService.getHistory());

  // SOS Form state
  const [chiefComplaint, setChiefComplaint] = useState('Severe Pregnancy / Contractions Alert');
  const [locationType, setLocationType] = useState<'GPS' | 'MANUAL'>('MANUAL');
  const [address, setAddress] = useState('Plot 14, Ahmadu Bello Way, Area 11');
  const [landmark, setLandmark] = useState('Opposite Central Bank Staff Quarters');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [sosError, setSosError] = useState<string | null>(null);

  // New contact modal state
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Cancel dialog
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('Accidental trigger / Patient stabilized');

  const refresh = () => {
    setProfile(patientService.getProfile());
    setActiveEmergency(patientService.getActiveEmergency());
    setHistory(patientService.getHistory());
  };

  useEffect(() => {
    refresh();
    const unsub = patientService.subscribe(refresh);
    return () => unsub();
  }, []);

  const handleAcquireGPS = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      setLocationType('MANUAL');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationType('GPS');
        setAddress('GPS Geolocation Acquired');
        setIsLocating(false);
      },
      () => {
        // Fallback to manual safely without fabricating
        setLocationType('MANUAL');
        setGpsCoords(undefined);
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const handleTriggerSOS = async () => {
    setSosError(null);
    const loc: EmergencyLocation = {
      address,
      landmark,
      type: locationType,
      coords: locationType === 'GPS' ? gpsCoords : undefined,
    };

    const res = await patientService.triggerSOS({
      chiefComplaint,
      location: loc,
      notes: 'Triggered from Patient Browser Portal',
    });

    if (!res.success) {
      setSosError(res.error || 'Failed to dispatch SOS');
    }
  };

  const handleCancelEmergency = async () => {
    const res = await patientService.cancelEmergency(cancelReason);
    if (!res.success) {
      alert(res.error);
    } else {
      setShowCancelPrompt(false);
    }
  };

  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) return;
    patientService.addContact({
      name: contactName.trim(),
      relationship: contactRelation.trim() || 'Emergency Contact',
      phone: contactPhone.trim(),
    });
    setContactName('');
    setContactRelation('');
    setContactPhone('');
    setShowAddContact(false);
  };

  const handleRemoveContact = (id: string) => {
    patientService.removeContact(id);
  };

  // Helper to render journey progression
  const getStateStep = (state: string) => {
    const steps = [
      'CREATED',
      'DISPATCHING',
      'ACCEPTED',
      'PICKUP_ARRIVED',
      'PATIENT_ONBOARD',
      'IN_TRANSIT',
      'ARRIVED',
      'COMPLETED',
    ];
    return steps.indexOf(state);
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
        {/* Top Header */}
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
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Patient Emergency Portal
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0 0' }}>
              Immediate emergency transport coordination, midwife connectivity, and live dispatch
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                backgroundColor: '#f1f5f9',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
              }}
            >
              Patient: <span style={{ color: '#0f172a' }}>{profile.fullName}</span> ({profile.phone})
            </div>
          </div>
        </div>

        {/* Active Emergency Alert or SOS Panic Trigger */}
        {activeEmergency ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '2px solid #df2b1a',
              boxShadow: '0 4px 12px rgba(223, 43, 26, 0.12)',
              overflow: 'hidden',
            }}
          >
            {/* Banner */}
            <div
              style={{
                backgroundColor: '#df2b1a',
                color: '#ffffff',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Radio className="pulse-ring" size={18} />
                <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.3px' }}>
                  ACTIVE EMERGENCY DISPATCH IN PROGRESS
                </span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.25)', padding: '2px 8px', borderRadius: '4px' }}>
                Case #{activeEmergency.id}
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Stepper */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>
                  OPERATIONAL JOURNEY MILESTONES
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  {[
                    { key: 'DISPATCHING', label: '1. Dispatching' },
                    { key: 'ACCEPTED', label: '2. En Route' },
                    { key: 'PICKUP_ARRIVED', label: '3. Arrived' },
                    { key: 'PATIENT_ONBOARD', label: '4. Onboard' },
                    { key: 'IN_TRANSIT', label: '5. In Transit' },
                    { key: 'ARRIVED', label: '6. Hospital' },
                  ].map((step, idx) => {
                    const currentIdx = getStateStep(activeEmergency.state);
                    const stepIdx = getStateStep(step.key);
                    const isDone = currentIdx >= stepIdx && currentIdx !== -1;
                    const isCurrent = activeEmergency.state === step.key;

                    return (
                      <div
                        key={step.key}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          zIndex: 2,
                          flex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: isDone ? '#12b76a' : '#e2e8f0',
                            color: isDone ? '#ffffff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            border: isCurrent ? '3px solid #df2b1a' : 'none',
                          }}
                        >
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: isCurrent ? 700 : 500,
                            color: isCurrent ? '#0f172a' : '#64748b',
                            textAlign: 'center',
                          }}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Responder & Location Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '14px',
                  backgroundColor: '#f8fafc',
                  padding: '14px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>CHIEF COMPLAINT</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {activeEmergency.chiefComplaint}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>PICKUP LOCATION</div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {activeEmergency.location.address}
                  </div>
                  {activeEmergency.location.landmark && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Landmark: {activeEmergency.location.landmark}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ASSIGNED UNIT / ETA</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#175cd3', marginTop: '2px' }}>
                    {activeEmergency.assignedResponderName
                      ? `${activeEmergency.assignedResponderName} (${activeEmergency.assignedVehicleType || 'Ambulance'})`
                      : 'Searching nearest unit...'}
                  </div>
                  {activeEmergency.etaMinutes && (
                    <div style={{ fontSize: '11px', color: '#027a48', fontWeight: 600 }}>
                      ETA: ~{activeEmergency.etaMinutes} minutes
                    </div>
                  )}
                </div>
              </div>

              {/* Actions & Simulation controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Advance for testing */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {activeEmergency.state === 'DISPATCHING' && (
                    <button
                      onClick={() => patientService.advanceState('ACCEPTED', 'Responder accepted emergency call')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      Simulate Responder Acceptance
                    </button>
                  )}
                  {activeEmergency.state === 'ACCEPTED' && (
                    <button
                      onClick={() => patientService.advanceState('PICKUP_ARRIVED', 'Responder arrived at pickup')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      Simulate Responder Arrival
                    </button>
                  )}
                  {activeEmergency.state === 'PICKUP_ARRIVED' && (
                    <button
                      onClick={() => patientService.advanceState('PATIENT_ONBOARD', 'Patient safely onboarded')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      Simulate Patient Onboard
                    </button>
                  )}
                  {activeEmergency.state === 'PATIENT_ONBOARD' && (
                    <button
                      onClick={() => patientService.advanceState('IN_TRANSIT', 'En route to hospital')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      Simulate In Transit
                    </button>
                  )}
                  {activeEmergency.state === 'IN_TRANSIT' && (
                    <button
                      onClick={() => patientService.advanceState('ARRIVED', 'Arrived at General Hospital Apex')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      Simulate Facility Arrival
                    </button>
                  )}
                  {activeEmergency.state === 'ARRIVED' && (
                    <button
                      onClick={() => patientService.advanceState('COMPLETED', 'Handover completed to triage team')}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#12b76a',
                        color: '#ffffff',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      Complete Handover
                    </button>
                  )}
                </div>

                {/* Cancel Emergency button (with permission guard) */}
                <div>
                  {['CREATED', 'DISPATCHING', 'ACCEPTED', 'PICKUP_ARRIVED'].includes(
                    activeEmergency.state
                  ) ? (
                    <button
                      onClick={() => setShowCancelPrompt(true)}
                      style={{
                        padding: '6px 14px',
                        border: '1px solid #fecdca',
                        backgroundColor: '#fef3f2',
                        color: '#b42318',
                        borderRadius: '5px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                      }}
                    >
                      Cancel Emergency
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      (Cancellation locked: patient is onboard)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Panic SOS Trigger Section */
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'center' }}>
              <div>
                <span
                  style={{
                    backgroundColor: '#fef3f2',
                    color: '#df2b1a',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  Urgent Response Trigger
                </span>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '8px 0 6px 0' }}>
                  Request Emergency Transport
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                  Dispatches closest verified ambulance or rapid responder directly to your location.
                  Authorized emergency contacts and nearest referral hospital will be alerted simultaneously.
                </p>

                {sosError && (
                  <div
                    style={{
                      backgroundColor: '#fef3f2',
                      border: '1px solid #fecdca',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#b42318',
                      fontSize: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    {sosError}
                  </div>
                )}

                {/* Complaint selection */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Emergency Reason
                  </label>
                  <select
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      padding: '0 10px',
                    }}
                  >
                    <option value="Severe Pregnancy / Contractions Alert">Pregnancy / Labor Complications</option>
                    <option value="Severe Bleeding / Hemorrhage">Severe Bleeding / Hemorrhage</option>
                    <option value="Severe Shortness of Breath / Asthma">Respiratory Distress / Asthma</option>
                    <option value="Unconscious / Unresponsive">Unconscious / Unresponsive</option>
                    <option value="Severe Injury / Road Accident">Accident / Physical Trauma</option>
                  </select>
                </div>

                {/* Location type & inputs */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      Pickup Location
                    </label>
                    <button
                      type="button"
                      onClick={handleAcquireGPS}
                      disabled={isLocating}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: '#175cd3',
                        fontWeight: 600,
                      }}
                    >
                      <MapPin size={12} />
                      {isLocating ? 'Acquiring GPS...' : 'Use My GPS Location'}
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Enter street name, area, or compound"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setLocationType('MANUAL');
                      setGpsCoords(undefined);
                    }}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      padding: '0 10px',
                      boxSizing: 'border-box',
                      marginBottom: '8px',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Nearest landmark (e.g. Near Market Gate, Mosque, Primary School)"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      padding: '0 10px',
                      boxSizing: 'border-box',
                    }}
                  />
                  {locationType === 'GPS' && (
                    <div style={{ fontSize: '11px', color: '#12b76a', fontWeight: 600, marginTop: '4px' }}>
                      ✓ Precise GPS coordinates attached: ({gpsCoords?.lat.toFixed(4)}, {gpsCoords?.lng.toFixed(4)})
                    </div>
                  )}
                </div>
              </div>

              {/* Big Panic Button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  onClick={handleTriggerSOS}
                  style={{
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    backgroundColor: '#df2b1a',
                    color: '#ffffff',
                    border: '8px solid rgba(223, 43, 26, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 10px 25px rgba(223, 43, 26, 0.4)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
                >
                  <AlertTriangle size={42} strokeWidth={2.4} />
                  <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '1px' }}>
                    SEND SOS
                  </span>
                  <span style={{ fontSize: '10.5px', opacity: 0.9 }}>One-Tap Emergency</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column: Contacts & Patient Medical Profile */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Emergency Contacts */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Emergency Contacts ({profile.emergencyContacts.length})
                </h3>
                <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Auto-alerted via SMS/call on dispatch
                </p>
              </div>
              <button
                onClick={() => setShowAddContact(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  backgroundColor: '#0f1a2c',
                  color: '#ffffff',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                <UserPlus size={13} />
                <span>Add</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profile.emergencyContacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                      {c.name} {c.isPrimary && <span style={{ color: '#175cd3', fontSize: '10px' }}>(Primary)</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {c.relationship} · {c.phone}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveContact(c.id)}
                    style={{ color: '#94a3b8', padding: '4px' }}
                    title="Remove contact"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Profile */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '18px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 14px 0' }}>
              Patient Clinical Summary
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>BLOOD GROUP</span>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '2px 0 0 0' }}>
                  {profile.bloodGroup}
                </p>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>GESTATIONAL AGE</span>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '2px 0 0 0' }}>
                  {profile.gestationalAgeWeeks ? `${profile.gestationalAgeWeeks} Weeks` : 'N/A'}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '12px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
              <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>ALLERGIES & MEDICAL NOTES</span>
              <p style={{ fontSize: '12px', color: '#334155', margin: '3px 0 0 0', lineHeight: 1.4 }}>
                {profile.medicalNotes || 'None recorded'}
              </p>
            </div>
          </div>
        </div>

        {/* Emergency History */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '18px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 12px 0' }}>
            Past Emergency Dispatches ({history.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((h) => (
              <div
                key={h.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{h.chiefComplaint}</span>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {new Date(h.createdAt).toLocaleDateString()} · {h.location.address}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      backgroundColor: h.state === 'COMPLETED' ? '#ecfdf3' : '#fef3f2',
                      color: h.state === 'COMPLETED' ? '#027a48' : '#b42318',
                    }}
                  >
                    {h.state}
                  </span>
                  {h.destinationFacility && (
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      {h.destinationFacility.name}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddContact && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '20px',
              width: '380px',
              maxWidth: '90vw',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px 0' }}>
              Add Emergency Contact
            </h3>
            <form onSubmit={handleAddContactSubmit}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  style={{ width: '100%', height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px' }}>
                  Relationship
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sister, Midwife, Neighbor"
                  value={contactRelation}
                  onChange={(e) => setContactRelation(e.target.value)}
                  style={{ width: '100%', height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+234 800 000 0000"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={{ width: '100%', height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '6px 14px', backgroundColor: '#0f1a2c', color: '#ffffff', borderRadius: '4px', fontWeight: 600 }}
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Prompt Modal */}
      {showCancelPrompt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '20px',
              width: '400px',
              maxWidth: '90vw',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px 0', color: '#b42318' }}>
              Cancel Active Emergency?
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>
              Are you sure? Once cancelled, responding units will be stood down.
            </p>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px' }}>
                Cancellation Reason
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ width: '100%', height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowCancelPrompt(false)}
                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleCancelEmergency}
                style={{ padding: '6px 14px', backgroundColor: '#df2b1a', color: '#ffffff', borderRadius: '4px', fontWeight: 600 }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
