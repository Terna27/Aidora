import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { CaseIntakePayload } from '../../types/dispatcher';
import { EmergencySeverity } from '../../types/emergency';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CaseIntakePayload) => Promise<{ success: boolean; error?: string }>;
}

export const NewCaseModal: React.FC<NewCaseModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [severity, setSeverity] = useState<EmergencySeverity>('CRITICAL');
  const [title, setTitle] = useState('');
  const [secondaryText, setSecondaryText] = useState('');
  const [location, setLocation] = useState('');
  const [reportedBy, setReportedBy] = useState('Bystander');
  const [awake, setAwake] = useState<'Yes' | 'No' | 'Unknown'>('No');
  const [bloodGroup, setBloodGroup] = useState('Not on file');
  const [callerNote, setCallerNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Emergency title/chief complaint is required');
      return;
    }
    if (!location.trim()) {
      setError('Location / Area is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await onSubmit({
      severity,
      title: title.trim(),
      secondaryText: secondaryText.trim() || title.trim(),
      location: location.trim(),
      reportedBy,
      awake,
      bloodGroup,
      callerNote: callerNote.trim() || 'Logged via Dispatcher Console',
    });

    setIsSubmitting(false);
    if (res.success) {
      setTitle('');
      setSecondaryText('');
      setLocation('');
      setCallerNote('');
      onClose();
    } else {
      setError(res.error || 'Failed to create case');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 26, 44, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '460px',
          maxWidth: '90vw',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #eaecf0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0f1a2c',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '3px',
                backgroundColor: '#df2b1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              +
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Log New Emergency Case</span>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#98a2b3', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '18px' }}>
          {error && (
            <div
              style={{
                backgroundColor: '#fef3f2',
                border: '1px solid #fecdca',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#b42318',
                fontSize: '11.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '14px',
              }}
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Severity selector */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#344054', marginBottom: '5px' }}>
              Severity Level
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {(['CRITICAL', 'URGENT', 'STABLE'] as EmergencySeverity[]).map((sev) => {
                const isSelected = severity === sev;
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    style={{
                      height: '32px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: isSelected
                        ? sev === 'CRITICAL'
                          ? '2px solid #df2b1a'
                          : sev === 'URGENT'
                          ? '2px solid #f79009'
                          : '2px solid #175cd3'
                        : '1px solid #d0d5dd',
                      backgroundColor: isSelected
                        ? sev === 'CRITICAL'
                          ? '#fef3f2'
                          : sev === 'URGENT'
                          ? '#fffaeb'
                          : '#eff8ff'
                        : '#ffffff',
                      color:
                        sev === 'CRITICAL'
                          ? '#b42318'
                          : sev === 'URGENT'
                          ? '#b54708'
                          : '#175cd3',
                    }}
                  >
                    {sev}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chief Complaint / Title */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#344054', marginBottom: '4px' }}>
              Emergency Title / Chief Complaint *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Unconscious / Male, not responding"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                borderRadius: '5px',
                border: '1px solid #d0d5dd',
                padding: '0 10px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Secondary Details */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#344054', marginBottom: '4px' }}>
              Clinical Symptoms / Secondary Note
            </label>
            <input
              type="text"
              placeholder="e.g. Inhaler not helping, breathing shallow"
              value={secondaryText}
              onChange={(e) => setSecondaryText(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                borderRadius: '5px',
                border: '1px solid #d0d5dd',
                padding: '0 10px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Location */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#344054', marginBottom: '4px' }}>
              Location / Area / Landmark *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. [Area A] or Area 1 Market, Garki"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                borderRadius: '5px',
                border: '1px solid #d0d5dd',
                padding: '0 10px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 2-column info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#344054', marginBottom: '4px' }}>
                Reported By
              </label>
              <select
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                style={{
                  width: '100%',
                  height: '32px',
                  borderRadius: '5px',
                  border: '1px solid #d0d5dd',
                  padding: '0 8px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="Bystander">Bystander</option>
                <option value="Self">Self</option>
                <option value="Family">Family</option>
                <option value="Health Worker">Health Worker</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#344054', marginBottom: '4px' }}>
                Patient Awake?
              </label>
              <select
                value={awake}
                onChange={(e) => setAwake(e.target.value as 'Yes' | 'No' | 'Unknown')}
                style={{
                  width: '100%',
                  height: '32px',
                  borderRadius: '5px',
                  border: '1px solid #d0d5dd',
                  padding: '0 8px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="No">No (Unresponsive)</option>
                <option value="Yes">Yes (Awake)</option>
                <option value="Unknown">Unknown</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#344054', marginBottom: '4px' }}>
                Blood Group
              </label>
              <input
                type="text"
                placeholder="e.g. O+ or Not on file"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                style={{
                  width: '100%',
                  height: '32px',
                  borderRadius: '5px',
                  border: '1px solid #d0d5dd',
                  padding: '0 8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#344054', marginBottom: '4px' }}>
                Caller Note
              </label>
              <input
                type="text"
                placeholder="e.g. Collapsed near taxi rank"
                value={callerNote}
                onChange={(e) => setCallerNote(e.target.value)}
                style={{
                  width: '100%',
                  height: '32px',
                  borderRadius: '5px',
                  border: '1px solid #d0d5dd',
                  padding: '0 8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '32px',
                padding: '0 14px',
                borderRadius: '5px',
                border: '1px solid #d0d5dd',
                backgroundColor: '#ffffff',
                color: '#344054',
                fontSize: '11.5px',
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                height: '32px',
                padding: '0 16px',
                borderRadius: '5px',
                backgroundColor: '#df2b1a',
                color: '#ffffff',
                fontSize: '11.5px',
                fontWeight: 600,
              }}
            >
              {isSubmitting ? 'Logging...' : 'Submit Case to Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
