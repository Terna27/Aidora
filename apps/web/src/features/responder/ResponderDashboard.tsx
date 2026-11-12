import React, { useState, useEffect } from 'react';
import {
  Clock,
  Navigation,
  ShieldAlert,
  AlertCircle,
  Power,
} from 'lucide-react';
import { responderService } from '../../services/responderService';
import { ResponderProfile, IncomingOffer, ResponderActiveJourney } from '../../types/responder';
import { EmergencyState } from '../../types/emergency';

export const ResponderDashboard: React.FC = () => {
  const [profile, setProfile] = useState<ResponderProfile>(responderService.getProfile());
  const [pendingOffer, setPendingOffer] = useState<IncomingOffer | null>(
    responderService.getPendingOffer()
  );
  const [activeJourney, setActiveJourney] = useState<ResponderActiveJourney | null>(
    responderService.getActiveJourney()
  );
  const [handoverStaff, setHandoverStaff] = useState('Nurse Midwife Ngozi');
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = () => {
    setProfile(responderService.getProfile());
    setPendingOffer(responderService.getPendingOffer());
    setActiveJourney(responderService.getActiveJourney());
  };

  useEffect(() => {
    refresh();
    const unsub = responderService.subscribe(refresh);
    return () => unsub();
  }, []);

  const handleToggleOnline = () => {
    setErrorMessage(null);
    const nextAvailability = profile.availability === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    const res = responderService.setAvailability(nextAvailability);
    if (!res.success) {
      setErrorMessage(res.error || 'Cannot change availability');
    }
  };

  const handleVerificationChange = (status: ResponderProfile['verificationStatus']) => {
    responderService.setVerificationStatus(status);
  };

  const handleAcceptOffer = () => {
    setErrorMessage(null);
    const res = responderService.acceptOffer();
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to accept offer');
    }
  };

  const handleDeclineOffer = () => {
    responderService.declineOffer();
  };

  const handleAdvanceMilestone = (targetState: EmergencyState) => {
    setErrorMessage(null);
    const res = responderService.advanceMilestone(targetState);
    if (!res.success) {
      setErrorMessage(res.error || 'Cannot transition milestone');
    }
  };

  const handleCompleteHandover = () => {
    const res = responderService.completeHandover(
      activeJourney?.destinationFacility.name || 'Hospital Apex',
      handoverStaff
    );
    if (!res.success) {
      setErrorMessage(res.error || 'Handover failed');
    } else {
      setShowHandoverModal(false);
    }
  };

  const isVerified = profile.verificationStatus === 'VERIFIED';
  const isOnline = profile.availability === 'ONLINE';

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
        {/* Header with Status & Online Toggle */}
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
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Responder Tactical Portal
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: isVerified ? '#ecfdf3' : '#fffaeb',
                  color: isVerified ? '#027a48' : '#b54708',
                }}
              >
                {profile.verificationStatus}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0 0' }}>
              {profile.fullName} · {profile.vehicleType} ({profile.vehicleReg}) · Base: {profile.communityBase}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Online / Offline switch */}
            <button
              onClick={handleToggleOnline}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: isOnline ? '#12b76a' : '#0f1a2c',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: isOnline ? '0 0 0 3px rgba(18, 183, 106, 0.25)' : 'none',
              }}
            >
              <Power size={14} />
              <span>{isOnline ? 'ONLINE & READY' : 'OFFLINE'}</span>
            </button>
          </div>
        </div>

        {/* Error message banner */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef3f2',
              border: '1px solid #fecdca',
              borderRadius: '6px',
              padding: '10px 14px',
              color: '#b42318',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Verification Status Warning if not verified */}
        {!isVerified && (
          <div
            style={{
              backgroundColor: '#fffaeb',
              border: '1px solid #fedf89',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert color="#b54708" size={24} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#7e2e0d' }}>
                  Verification Status: {profile.verificationStatus}
                </div>
                <div style={{ fontSize: '12px', color: '#b54708' }}>
                  Only verified responders with approved vehicle safety and credentials may switch online to accept emergency dispatches.
                </div>
              </div>
            </div>

            {/* Verification switcher for testing */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => handleVerificationChange('VERIFIED')}
                style={{
                  backgroundColor: '#027a48',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '4px',
                }}
              >
                Set VERIFIED
              </button>
              <button
                onClick={() => handleVerificationChange('PENDING')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #d0d5dd',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                }}
              >
                Set PENDING
              </button>
            </div>
          </div>
        )}

        {/* Active Journey View */}
        {activeJourney ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '2px solid #175cd3',
              boxShadow: '0 4px 12px rgba(23, 92, 211, 0.12)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                backgroundColor: '#175cd3',
                color: '#ffffff',
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Navigation size={18} />
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  ACTIVE TRANSPORT MISSION #{activeJourney.emergencyId}
                </span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                State: {activeJourney.state === 'ACCEPTED' ? 'HEADING TO PICKUP' : activeJourney.state}
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Patient and Hospital details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>PICKUP POINT</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {activeJourney.pickupLocation.address}
                  </div>
                  {activeJourney.pickupLocation.landmark && (
                    <div style={{ fontSize: '11.5px', color: '#475467', marginTop: '2px' }}>
                      Landmark: {activeJourney.pickupLocation.landmark}
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#b42318', fontWeight: 600, marginTop: '6px' }}>
                    Complaint: {activeJourney.chiefComplaint}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>DESTINATION REFERRAL FACILITY</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {activeJourney.destinationFacility.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#475467', marginTop: '2px' }}>
                    {activeJourney.destinationFacility.address}
                  </div>
                  <div style={{ fontSize: '12px', color: '#175cd3', fontWeight: 600, marginTop: '6px' }}>
                    Triage Emergency Contact: {activeJourney.destinationFacility.contactPhone}
                  </div>
                </div>
              </div>

              {/* Milestones sequential button bar */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>
                  UPDATE OPERATIONAL MILESTONE
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {activeJourney.state === 'ACCEPTED' && (
                    <button
                      onClick={() => handleAdvanceMilestone('PICKUP_ARRIVED')}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '12.5px',
                      }}
                    >
                      1. Mark Arrived at Pickup
                    </button>
                  )}

                  {activeJourney.state === 'PICKUP_ARRIVED' && (
                    <button
                      onClick={() => handleAdvanceMilestone('PATIENT_ONBOARD')}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '12.5px',
                      }}
                    >
                      2. Confirm Patient Onboard
                    </button>
                  )}

                  {activeJourney.state === 'PATIENT_ONBOARD' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleAdvanceMilestone('HOSPITAL_SELECTED')}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #d0d5dd',
                          color: '#344054',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '12.5px',
                        }}
                      >
                        (Optional) Re-Confirm Hospital
                      </button>
                      <button
                        onClick={() => handleAdvanceMilestone('IN_TRANSIT')}
                        style={{
                          padding: '10px 18px',
                          backgroundColor: '#0f1a2c',
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '12.5px',
                        }}
                      >
                        3. Start In Transit to Facility
                      </button>
                    </div>
                  )}

                  {activeJourney.state === 'HOSPITAL_SELECTED' && (
                    <button
                      onClick={() => handleAdvanceMilestone('IN_TRANSIT')}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '12.5px',
                      }}
                    >
                      3. Start In Transit to Facility
                    </button>
                  )}

                  {activeJourney.state === 'IN_TRANSIT' && (
                    <button
                      onClick={() => handleAdvanceMilestone('ARRIVED')}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: '#0f1a2c',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '12.5px',
                      }}
                    >
                      4. Mark Arrived at Hospital Gate
                    </button>
                  )}

                  {activeJourney.state === 'ARRIVED' && (
                    <button
                      onClick={() => setShowHandoverModal(true)}
                      style={{
                        padding: '10px 18px',
                        backgroundColor: '#12b76a',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '12.5px',
                      }}
                    >
                      5. Complete Clinical Facility Handover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Incoming Offer Section */
          pendingOffer && isOnline && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '2px solid #df2b1a',
                padding: '20px',
                boxShadow: '0 4px 14px rgba(223, 43, 26, 0.15)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      backgroundColor: '#fef3f2',
                      color: '#df2b1a',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    INCOMING EMERGENCY OFFER
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    {pendingOffer.severity} PRIORITY
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#df2b1a', fontWeight: 700, fontSize: '12px' }}>
                  <Clock size={14} />
                  <span>Offer Expires Soon</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>CHIEF COMPLAINT</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {pendingOffer.chiefComplaint}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>PICKUP LOCATION</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {pendingOffer.pickupLocation.address}
                  </div>
                  {pendingOffer.pickupLocation.landmark && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Landmark: {pendingOffer.pickupLocation.landmark}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ESTIMATED TRAVEL</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#175cd3', marginTop: '2px' }}>
                    {pendingOffer.distanceKm} km · ~{pendingOffer.etaMinutes} min ETA
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={handleDeclineOffer}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #d0d5dd',
                    color: '#344054',
                    borderRadius: '5px',
                    fontWeight: 600,
                    fontSize: '12.5px',
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptOffer}
                  style={{
                    padding: '8px 24px',
                    backgroundColor: '#df2b1a',
                    color: '#ffffff',
                    borderRadius: '5px',
                    fontWeight: 700,
                    fontSize: '12.5px',
                  }}
                >
                  Accept & Start Journey
                </button>
              </div>
            </div>
          )
        )}

        {/* Responder Statistics & Compliance */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '7px', border: '1px solid #eaecf0', padding: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>COMPLETED TRANSPORTS</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              {profile.completedJourneys}
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '7px', border: '1px solid #eaecf0', padding: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>SAFETY & SATISFACTION RATING</span>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#12b76a', marginTop: '4px' }}>
              {profile.rating.toFixed(2)} ★
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '7px', border: '1px solid #eaecf0', padding: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>PRIMARY BASE ZONE</span>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              {profile.communityBase}
            </div>
          </div>
        </div>
      </div>

      {/* Handover Dialog Modal */}
      {showHandoverModal && (
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
              width: '420px',
              maxWidth: '90vw',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>
              Confirm Facility Handover
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>
              Operational handover requires transferring patient custody to the receiving clinical triage lead.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px' }}>
                Receiving Staff Name / Badge
              </label>
              <input
                type="text"
                value={handoverStaff}
                onChange={(e) => setHandoverStaff(e.target.value)}
                style={{ width: '100%', height: '32px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteHandover}
                style={{ padding: '6px 16px', backgroundColor: '#12b76a', color: '#ffffff', borderRadius: '4px', fontWeight: 600 }}
              >
                Sign Handover & Complete Mission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
