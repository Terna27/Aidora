import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FormField } from '../../components/forms/FormField';
import { PasswordInput } from '../../components/forms/PasswordInput';
import { VehicleCategory } from '../../types/auth';
import {
  HeartPulse,
  Bike,
  Building2,
  Ticket,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

type SelectedAccountType = 'PATIENT' | 'RESPONDER' | 'HOSPITAL' | 'INVITATION';

export const RegisterScreen: React.FC = () => {
  const { registerPatient, registerResponder, registerHospital, loading } = useAuth();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState<SelectedAccountType>('PATIENT');
  const [step, setStep] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Common fields
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Patient specific
  const [patientCommunity, setPatientCommunity] = useState('');

  // Responder specific
  const [responderCommunity, setResponderCommunity] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleCategory>('MOTORCYCLE');
  const [vehicleMakeModel, setVehicleMakeModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('');

  // Hospital specific
  const [hospitalName, setHospitalName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [hospitalCommunity, setHospitalCommunity] = useState('');
  const [lga, setLga] = useState('Abuja Municipal');
  const [state, setState] = useState('FCT');
  const [contactPhone, setContactPhone] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([
    'Obstetrics & Maternity',
    'Emergency Trauma',
  ]);

  const toggleCapability = (cap: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('You must agree to terms and privacy notice.');
      return;
    }

    const res = await registerPatient({
      fullName,
      phoneNumber,
      email: email || undefined,
      password,
      confirmPassword,
      communityOrVillage: patientCommunity,
      agreedToTerms,
    });

    if (res.success) {
      navigate('/patient', { replace: true });
    } else {
      setErrorMessage(res.error || 'Registration failed');
    }
  };

  const handleResponderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('You must agree to the operational driver agreement.');
      return;
    }

    const res = await registerResponder({
      fullName,
      phoneNumber,
      email: email || undefined,
      password,
      confirmPassword,
      communityBase: responderCommunity,
      vehicleType,
      vehicleMakeModel,
      licensePlate,
      vehicleColor,
      driverLicenseNumber,
      agreedToTerms,
    });

    if (res.success) {
      navigate('/responder', { replace: true });
    } else {
      setErrorMessage(res.error || 'Registration failed');
    }
  };

  const handleHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('You must agree to healthcare facility regulatory terms.');
      return;
    }

    const res = await registerHospital({
      hospitalName,
      licenseNumber,
      address: hospitalAddress,
      community: hospitalCommunity,
      lga,
      state,
      contactPhone,
      officialEmail,
      capabilities: selectedCapabilities,
      adminFullName: fullName,
      adminPhone: phoneNumber,
      adminEmail: email || officialEmail,
      password,
      confirmPassword,
      agreedToTerms,
    });

    if (res.success) {
      navigate('/account-status?status=pending_approval', { replace: true });
    } else {
      setErrorMessage(res.error || 'Registration failed');
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 42px)',
        backgroundColor: '#f6f7fb',
        padding: '32px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '580px',
          maxWidth: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #eaecf0',
          boxShadow: '0 4px 16px rgba(16, 24, 40, 0.06)',
          padding: '30px 28px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#101828', margin: 0 }}>
            Create Your Aidora Account
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Choose your role in the maternal emergency response network
          </p>
        </div>

        {/* Account Type Selector Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '22px' }}>
          <button
            type="button"
            onClick={() => {
              setAccountType('PATIENT');
              setStep(1);
              setErrorMessage(null);
            }}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: accountType === 'PATIENT' ? '2px solid #df2b1a' : '1px solid #e4e7ec',
              backgroundColor: accountType === 'PATIENT' ? '#fff5f5' : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: accountType === 'PATIENT' ? '#df2b1a' : '#f2f4f7',
                color: accountType === 'PATIENT' ? '#ffffff' : '#344054',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <HeartPulse size={16} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#101828' }}>Patient / Mother</div>
              <div style={{ fontSize: '11px', color: '#667085' }}>SOS transport & care</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setAccountType('RESPONDER');
              setStep(1);
              setErrorMessage(null);
            }}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: accountType === 'RESPONDER' ? '2px solid #df2b1a' : '1px solid #e4e7ec',
              backgroundColor: accountType === 'RESPONDER' ? '#fff5f5' : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: accountType === 'RESPONDER' ? '#df2b1a' : '#f2f4f7',
                color: accountType === 'RESPONDER' ? '#ffffff' : '#344054',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bike size={16} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#101828' }}>Emergency Driver</div>
              <div style={{ fontSize: '11px', color: '#667085' }}>Motorcycle, Tricycle, Taxi</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setAccountType('HOSPITAL');
              setStep(1);
              setErrorMessage(null);
            }}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: accountType === 'HOSPITAL' ? '2px solid #df2b1a' : '1px solid #e4e7ec',
              backgroundColor: accountType === 'HOSPITAL' ? '#fff5f5' : '#ffffff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: accountType === 'HOSPITAL' ? '#df2b1a' : '#f2f4f7',
                color: accountType === 'HOSPITAL' ? '#ffffff' : '#344054',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Building2 size={16} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#101828' }}>Hospital Facility</div>
              <div style={{ fontSize: '11px', color: '#667085' }}>Maternity & Triage Org</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/invite')}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
              backgroundColor: '#f8fafc',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#e2e8f0',
                color: '#344054',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ticket size={16} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>Have Invitation?</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Staff & Dispatch tokens</div>
            </div>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef3f2',
              border: '1px solid #fecdca',
              borderRadius: '6px',
              padding: '10px 12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#b42318',
              fontSize: '12px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form 1: Patient Registration */}
        {accountType === 'PATIENT' && (
          <form onSubmit={handlePatientSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="Full Name" required>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fatima Bello"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </FormField>

              <FormField label="Phone Number" required hint="Used for emergency calls and login">
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0803 123 4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                />
              </FormField>
            </div>

            <FormField label="Community / Residential Location" required hint="e.g. Karu Village, Area 11, Garki">
              <input
                type="text"
                required
                placeholder="Enter community, village or ward"
                value={patientCommunity}
                onChange={(e) => setPatientCommunity(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
              />
            </FormField>

            <FormField label="Email Address (Optional)">
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label="Password" required hint="Min 6 characters">
                <PasswordInput
                  required
                  placeholder="Create password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>

              <FormField label="Confirm Password" required>
                <PasswordInput
                  required
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </FormField>
            </div>

            <div style={{ margin: '14px 0 20px 0' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: '#475467' }}>
                <input
                  type="checkbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I agree to the Aidora maternal healthcare terms of service and consent to emergency SMS/voice alerts to my designated contacts.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '40px',
                backgroundColor: '#df2b1a',
                color: '#ffffff',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating Account...' : 'Complete Patient Registration'}
            </button>
          </form>
        )}

        {/* Form 2: Responder Progressive Registration */}
        {accountType === 'RESPONDER' && (
          <form onSubmit={handleResponderSubmit}>
            {/* Step Indicators */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '18px' }}>
              <span style={{ fontSize: '11px', fontWeight: step === 1 ? 700 : 500, color: step === 1 ? '#df2b1a' : '#64748b' }}>
                1. Personal Credentials
              </span>
              <ChevronRight size={14} color="#94a3b8" />
              <span style={{ fontSize: '11px', fontWeight: step === 2 ? 700 : 500, color: step === 2 ? '#df2b1a' : '#64748b' }}>
                2. Vehicle & Verification
              </span>
            </div>

            {step === 1 && (
              <>
                <FormField label="Full Legal Name" required>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chidi Okafor"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                  />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label="Phone Number" required hint="Used for emergency dispatch offers">
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0802 555 7890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>

                  <FormField label="Community Base / Operating Hub" required>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Garki Central, Area 1"
                      value={responderCommunity}
                      onChange={(e) => setResponderCommunity(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label="Password" required>
                    <PasswordInput
                      required
                      placeholder="Create password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Confirm Password" required>
                    <PasswordInput
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!fullName.trim() || !phoneNumber.trim() || !responderCommunity.trim() || !password) {
                        setErrorMessage('Please complete all required fields.');
                        return;
                      }
                      if (password !== confirmPassword) {
                        setErrorMessage('Passwords do not match.');
                        return;
                      }
                      setErrorMessage(null);
                      setStep(2);
                    }}
                    style={{
                      height: '38px',
                      padding: '0 20px',
                      backgroundColor: '#0f1a2c',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Next: Vehicle Details</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <FormField label="Vehicle Type" required>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {(['MOTORCYCLE', 'TRICYCLE', 'TAXI'] as VehicleCategory[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVehicleType(v)}
                        style={{
                          height: '36px',
                          borderRadius: '6px',
                          border: vehicleType === v ? '2px solid #df2b1a' : '1px solid #d0d5dd',
                          backgroundColor: vehicleType === v ? '#fef3f2' : '#ffffff',
                          color: vehicleType === v ? '#b42318' : '#344054',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <FormField label="Vehicle Make & Model" required hint="e.g. Bajaj Boxer 150">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bajaj Boxer 150"
                      value={vehicleMakeModel}
                      onChange={(e) => setVehicleMakeModel(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>

                  <FormField label="License Plate Number" required>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ABJ-882-MK"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                  <FormField label="Vehicle Color" required>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Black / Yellow"
                      value={vehicleColor}
                      onChange={(e) => setVehicleColor(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>

                  <FormField label="Driver's License Number" required>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DL-40918-ABJ"
                      value={driverLicenseNumber}
                      onChange={(e) => setDriverLicenseNumber(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>
                </div>

                {/* Important verification notice */}
                <div
                  style={{
                    backgroundColor: '#fffaeb',
                    border: '1px solid #fedf89',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    margin: '12px 0 16px 0',
                    fontSize: '11px',
                    color: '#7e2e0d',
                    lineHeight: 1.4,
                  }}
                >
                  <strong>Safety Notice:</strong> New responders enter as <strong>PENDING</strong> verification.
                  You will NOT appear online or receive emergency offers until physical vehicle and license inspection is completed by dispatch compliance.
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: '#475467' }}>
                    <input
                      type="checkbox"
                      required
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <span>
                      I certify that I provide rapid non-medical emergency transport. I am not a doctor or paramedic and will safely transfer patients to designated hospitals.
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      height: '38px',
                      padding: '0 14px',
                      border: '1px solid #d0d5dd',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#344054',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ChevronLeft size={14} />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      height: '38px',
                      padding: '0 24px',
                      backgroundColor: '#0f1a2c',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      border: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Submitting Application...' : 'Register as Responder'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Form 3: Hospital Organization Registration */}
        {accountType === 'HOSPITAL' && (
          <form onSubmit={handleHospitalSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '18px' }}>
              <span style={{ fontSize: '11px', fontWeight: step === 1 ? 700 : 500, color: step === 1 ? '#df2b1a' : '#64748b' }}>
                1. Facility Registry
              </span>
              <ChevronRight size={14} color="#94a3b8" />
              <span style={{ fontSize: '11px', fontWeight: step === 2 ? 700 : 500, color: step === 2 ? '#df2b1a' : '#64748b' }}>
                2. Administrator Contact
              </span>
            </div>

            {step === 1 && (
              <>
                <FormField label="Official Hospital / Maternity Facility Name" required>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex General Hospital & Maternal Center"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                  />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <FormField label="MOH Facility License ID" required hint="Issued by state Ministry of Health">
                    <input
                      type="text"
                      required
                      placeholder="e.g. MOH/FCT/2026/088"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>

                  <FormField label="Hospital Contact Phone" required>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0800 999 0001"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>
                </div>

                <FormField label="Facility Physical Address" required>
                  <input
                    type="text"
                    required
                    placeholder="Plot / Street / Community"
                    value={hospitalAddress}
                    onChange={(e) => setHospitalAddress(e.target.value)}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                  />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <FormField label="Community / Ward" required>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Central Zone"
                      value={hospitalCommunity}
                      onChange={(e) => setHospitalCommunity(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 8px', boxSizing: 'border-box' }}
                    />
                  </FormField>

                  <FormField label="LGA" required>
                    <input
                      type="text"
                      required
                      value={lga}
                      onChange={(e) => setLga(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 8px', boxSizing: 'border-box' }}
                    />
                  </FormField>

                  <FormField label="State" required>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 8px', boxSizing: 'border-box' }}
                    />
                  </FormField>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#344054', marginBottom: '6px' }}>
                    Facility Clinical Capabilities
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      'Obstetrics & Maternity',
                      'Emergency Trauma',
                      'Neonatal ICU',
                      'Emergency Surgical Suite',
                    ].map((cap) => {
                      const isSel = selectedCapabilities.includes(cap);
                      return (
                        <button
                          key={cap}
                          type="button"
                          onClick={() => toggleCapability(cap)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '5px',
                            border: isSel ? '1px solid #175cd3' : '1px solid #d0d5dd',
                            backgroundColor: isSel ? '#eff8ff' : '#ffffff',
                            color: isSel ? '#175cd3' : '#344054',
                            fontSize: '11px',
                            fontWeight: 600,
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>{cap}</span>
                          {isSel && <CheckCircle2 size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!hospitalName.trim() || !licenseNumber.trim() || !hospitalAddress.trim() || !contactPhone.trim()) {
                        setErrorMessage('Please complete all required facility fields.');
                        return;
                      }
                      setErrorMessage(null);
                      setStep(2);
                    }}
                    style={{
                      height: '38px',
                      padding: '0 20px',
                      backgroundColor: '#0f1a2c',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Next: Administrator Credentials</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <FormField label="Administrator Full Name" required hint="Hospital Medical Director or Lead Administrator">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Kelechi Okafor"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                  />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label="Admin Direct Phone" required>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0803 999 1234"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>

                  <FormField label="Official Hospital Email" required>
                    <input
                      type="email"
                      required
                      placeholder="admin@hospital.org"
                      value={officialEmail}
                      onChange={(e) => setOfficialEmail(e.target.value)}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #d0d5dd', padding: '0 10px', boxSizing: 'border-box' }}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label="Password" required>
                    <PasswordInput
                      required
                      placeholder="Create admin password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Confirm Password" required>
                    <PasswordInput
                      required
                      placeholder="Repeat admin password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </FormField>
                </div>

                <div
                  style={{
                    backgroundColor: '#eff8ff',
                    border: '1px solid #b2ddff',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    margin: '12px 0 16px 0',
                    fontSize: '11px',
                    color: '#175cd3',
                  }}
                >
                  <strong>Approval Notice:</strong> Healthcare facility registrations require authorization by the Ministry of Health and dispatch operations board before receiving active ambulance dispatches.
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: '#475467' }}>
                    <input
                      type="checkbox"
                      required
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <span>
                      I certify that I am authorized to register this medical facility. The facility agrees to accept maternal emergency admissions and report accurate triage bed telemetry.
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      height: '38px',
                      padding: '0 14px',
                      border: '1px solid #d0d5dd',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#344054',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ChevronLeft size={14} />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      height: '38px',
                      padding: '0 24px',
                      backgroundColor: '#0f1a2c',
                      color: '#ffffff',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      border: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {loading ? 'Submitting Application...' : 'Register Hospital Organization'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* Footer */}
        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#667085' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#df2b1a', fontWeight: 700, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
