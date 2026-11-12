import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { authService } from '../src/services/auth/authService';
import { mockAuthAdapter } from '../src/services/auth/mockAuthAdapter';
import { responderService } from '../src/services/responderService';

describe('Aidora Web — Milestone 1: Identity & Authentication Test Suite', () => {
  beforeEach(async () => {
    authService.setMockMode(true);
    await authService.logout();
    responderService.resetToFixtures();
  });

  test('1. Patient registration validation enforces full name, phone, matching passwords, and terms', async () => {
    // Missing full name
    let res = await authService.registerPatient({
      fullName: '',
      phoneNumber: '08031112233',
      password: 'password123',
      confirmPassword: 'password123',
      communityOrVillage: 'Karu',
      agreedToTerms: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /full name is required/i);

    // Invalid phone number
    res = await authService.registerPatient({
      fullName: 'Fatima Bello',
      phoneNumber: '123',
      password: 'password123',
      confirmPassword: 'password123',
      communityOrVillage: 'Karu',
      agreedToTerms: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /valid phone number is required/i);

    // Password mismatch
    res = await authService.registerPatient({
      fullName: 'Fatima Bello',
      phoneNumber: '08031112233',
      password: 'password123',
      confirmPassword: 'differentPassword',
      communityOrVillage: 'Karu',
      agreedToTerms: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /passwords do not match/i);

    // Missing terms agreement
    res = await authService.registerPatient({
      fullName: 'Fatima Bello',
      phoneNumber: '08031112233',
      password: 'password123',
      confirmPassword: 'password123',
      communityOrVillage: 'Karu',
      agreedToTerms: false,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /terms/i);

    // Valid registration succeeds
    const valid = await authService.registerPatient({
      fullName: 'Fatima Bello',
      phoneNumber: '08031112233',
      password: 'password123',
      confirmPassword: 'password123',
      communityOrVillage: 'Karu Village',
      agreedToTerms: true,
    });
    assert.strictEqual(valid.success, true);
    assert.strictEqual(valid.session?.user?.role, 'PATIENT');
    assert.strictEqual(valid.session?.user?.fullName, 'Fatima Bello');
  });

  test('2. Responder registration validates vehicle & license info, and defaults strictly to PENDING verification', async () => {
    // Missing driver license
    let res = await authService.registerResponder({
      fullName: 'Musa Garba',
      phoneNumber: '08029998877',
      password: 'password123',
      confirmPassword: 'password123',
      communityBase: 'Garki 2',
      vehicleType: 'MOTORCYCLE',
      vehicleMakeModel: 'Bajaj Boxer 150',
      licensePlate: 'ABJ-123-XY',
      vehicleColor: 'Red',
      driverLicenseNumber: '',
      agreedToTerms: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /license number is required/i);

    // Valid responder registration
    const valid = await authService.registerResponder({
      fullName: 'Musa Garba',
      phoneNumber: '08029998877',
      password: 'password123',
      confirmPassword: 'password123',
      communityBase: 'Garki 2',
      vehicleType: 'MOTORCYCLE',
      vehicleMakeModel: 'Bajaj Boxer 150',
      licensePlate: 'ABJ-123-XY',
      vehicleColor: 'Red',
      driverLicenseNumber: 'DL-99182-ABJ',
      agreedToTerms: true,
    });
    assert.strictEqual(valid.success, true);
    assert.strictEqual(valid.session?.user?.role, 'RESPONDER');
    // Safety Invariant: New responders MUST NOT be verified merely because registration succeeded!
    assert.strictEqual(valid.session?.user?.verificationStatus, 'PENDING');
  });

  test('3. Hospital organization registration creates organization entity with PENDING_APPROVAL', async () => {
    // Missing MOH license ID
    let res = await authService.registerHospital({
      hospitalName: 'Grace Maternity Clinic',
      licenseNumber: '',
      address: 'Plot 10, Kubwa',
      community: 'Kubwa',
      lga: 'Bwari',
      state: 'FCT',
      contactPhone: '08001112222',
      officialEmail: 'info@gracematernity.org',
      capabilities: ['Obstetrics & Maternity'],
      adminFullName: 'Dr. Grace Eze',
      adminPhone: '08093334444',
      adminEmail: 'admin@gracematernity.org',
      password: 'password123',
      confirmPassword: 'password123',
      agreedToTerms: true,
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /license or registration id is required/i);

    // Valid hospital registration
    const valid = await authService.registerHospital({
      hospitalName: 'Grace Maternity Clinic',
      licenseNumber: 'MOH/FCT/2026/889',
      address: 'Plot 10, Kubwa',
      community: 'Kubwa',
      lga: 'Bwari',
      state: 'FCT',
      contactPhone: '08001112222',
      officialEmail: 'info@gracematernity.org',
      capabilities: ['Obstetrics & Maternity', 'Neonatal Care'],
      adminFullName: 'Dr. Grace Eze',
      adminPhone: '08093334444',
      adminEmail: 'admin@gracematernity.org',
      password: 'password123',
      confirmPassword: 'password123',
      agreedToTerms: true,
    });
    assert.strictEqual(valid.success, true);
    assert.strictEqual(valid.session?.user?.role, 'HOSPITAL_ADMIN');
    assert.ok(valid.session?.user?.organization);
    // Hospital must not be presented as operational until approved
    assert.strictEqual(valid.session?.user?.organization?.approvalStatus, 'PENDING_APPROVAL');
  });

  test('4. Hospital staff invitation acceptance binds organization and rejects expired/invalid tokens', async () => {
    // Invalid token check
    const invalidCheck = await authService.validateInvitation('INVALID-TOKEN-999');
    assert.strictEqual(invalidCheck.valid, false);
    assert.match(invalidCheck.error || '', /INVITATION_NOT_FOUND/);

    // Expired token check
    const expiredCheck = await authService.validateInvitation('HOSP-INV-EXPIRED-2025');
    assert.strictEqual(expiredCheck.valid, false);
    assert.match(expiredCheck.error || '', /INVITATION_EXPIRED/);

    // Attempting acceptance with expired token fails
    const expiredAccept = await authService.acceptInvitation({
      token: 'HOSP-INV-EXPIRED-2025',
      fullName: 'Nurse Mary',
      phoneNumber: '08051239988',
      password: 'password123',
      confirmPassword: 'password123',
      agreedToTerms: true,
    });
    assert.strictEqual(expiredAccept.success, false);
    assert.match(expiredAccept.error || '', /expired/i);

    // Valid invitation acceptance succeeds and pre-binds organization
    const validAccept = await authService.acceptInvitation({
      token: 'HOSP-INV-VALID-2026',
      fullName: 'Nurse Fatima Aliyu',
      phoneNumber: '08051112233',
      password: 'password123',
      confirmPassword: 'password123',
      agreedToTerms: true,
    });
    assert.strictEqual(validAccept.success, true);
    assert.strictEqual(validAccept.session?.user?.role, 'HOSPITAL_STAFF');
    assert.strictEqual(validAccept.session?.user?.organization?.organizationName, 'General Hospital Apex');
    assert.strictEqual(validAccept.session?.user?.organization?.membershipRole, 'Emergency Triage Nurse');
  });

  test('5. Dispatcher invitation and authorization token flow grants dispatch privileges', async () => {
    // Public registration without valid dispatch token is rejected
    const publicAttempt = await authService.registerDispatcherWithToken({
      authorizationToken: 'UNAUTHORIZED-CODE',
      fullName: 'John Dispatcher',
      phoneNumber: '08071234567',
      password: 'password123',
      confirmPassword: 'password123',
      dispatchRegion: 'Abuja Sector 1',
      agreedToTerms: true,
    });
    assert.strictEqual(publicAttempt.success, false);
    assert.match(publicAttempt.error || '', /UNAUTHORIZED_DISPATCH_REGISTRATION/);

    // Valid dispatch token succeeds
    const validDispatch = await authService.registerDispatcherWithToken({
      authorizationToken: 'DISP-AUTH-VALID-884',
      fullName: 'John Dispatcher',
      phoneNumber: '08071234567',
      password: 'password123',
      confirmPassword: 'password123',
      dispatchRegion: 'Abuja Sector 1',
      agreedToTerms: true,
    });
    assert.strictEqual(validDispatch.success, true);
    assert.strictEqual(validDispatch.session?.user?.role, 'DISPATCHER');
    assert.strictEqual(
      validDispatch.session?.user?.organization?.organizationName,
      'FCT Emergency Medical Dispatch Center'
    );
  });

  test('6. Login form validates format, credentials and rejects mismatching identities', async () => {
    // Empty identifier
    let res = await authService.login({ identifier: '', password: 'password123' });
    assert.strictEqual(res.success, false);

    // Short password
    res = await authService.login({ identifier: '08031234567', password: '123' });
    assert.strictEqual(res.success, false);

    // Non-existent user
    res = await authService.login({ identifier: '08099999999', password: 'password123' });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /invalid credentials/i);

    // Successful login for patient
    res = await authService.login({ identifier: '08031234567', password: 'secret123' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.session?.user?.fullName, 'Amina Bello');
  });

  test('7. Password confirmation is enforced across all registration types', async () => {
    const patientFail = await authService.registerPatient({
      fullName: 'Test Patient',
      phoneNumber: '08011223344',
      password: 'passWordA',
      confirmPassword: 'passWordB',
      communityOrVillage: 'Wuse',
      agreedToTerms: true,
    });
    assert.strictEqual(patientFail.success, false);
    assert.match(patientFail.error || '', /passwords do not match/i);

    const responderFail = await authService.registerResponder({
      fullName: 'Test Driver',
      phoneNumber: '08011223355',
      password: 'passWordA',
      confirmPassword: 'passWordB',
      communityBase: 'Wuse',
      vehicleType: 'TRICYCLE',
      vehicleMakeModel: 'TVS King',
      licensePlate: 'ABJ-901-TR',
      vehicleColor: 'Yellow',
      driverLicenseNumber: 'DL-9901-FCT',
      agreedToTerms: true,
    });
    assert.strictEqual(responderFail.success, false);
    assert.match(responderFail.error || '', /passwords do not match/i);
  });

  test('8. Role-based session identity confirms appropriate portal destination', async () => {
    // 1. Patient identity
    let res = await authService.login({ identifier: '08031234567', password: 'secret123' });
    assert.strictEqual(res.session?.user?.role, 'PATIENT');

    // 2. Responder identity
    res = await authService.login({ identifier: '08025557890', password: 'secret123' });
    assert.strictEqual(res.session?.user?.role, 'RESPONDER');

    // 3. Hospital Admin identity
    res = await authService.login({ identifier: '08009990001', password: 'secret123' });
    assert.strictEqual(res.session?.user?.role, 'HOSPITAL_ADMIN');

    // 4. Dispatcher identity
    res = await authService.login({ identifier: '08077778899', password: 'secret123' });
    assert.strictEqual(res.session?.user?.role, 'DISPATCHER');

    // 5. Platform Admin identity
    res = await authService.login({ identifier: 'admin@aidline.gov.ng', password: 'secret123' });
    assert.strictEqual(res.session?.user?.role, 'PLATFORM_ADMIN');
  });

  test('9. Protected route authorization blocks unauthenticated sessions', () => {
    const session = authService.getCurrentSession();
    assert.strictEqual(session.isAuthenticated, false);
    assert.strictEqual(session.user, null);
  });

  test('10. Unauthorized access is detected on role mismatch', async () => {
    // Patient attempting to sign in into hospital portal targetRole
    const res = await authService.login({
      identifier: '08031234567',
      password: 'secret123',
      targetRole: 'HOSPITAL_ADMIN',
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error || '', /account role mismatch/i);
  });

  test('11. Session expiry clears session and returns unauthenticated state', async () => {
    await authService.login({ identifier: '08031234567', password: 'secret123' });
    let session = authService.getCurrentSession();
    assert.strictEqual(session.isAuthenticated, true);

    // Simulate expired token in adapter
    mockAuthAdapter.setSession({
      ...session,
      tokenExpiry: new Date(Date.now() - 1000).toISOString(),
    });

    session = authService.getCurrentSession();
    assert.strictEqual(session.isAuthenticated, false);
    assert.strictEqual(session.user, null);
  });

  test('12. Logout cleans up session, memory, and tokens', async () => {
    await authService.login({ identifier: '08031234567', password: 'secret123' });
    assert.strictEqual(authService.getCurrentSession().isAuthenticated, true);

    await authService.logout();
    const cleanSession = authService.getCurrentSession();
    assert.strictEqual(cleanSession.isAuthenticated, false);
    assert.strictEqual(cleanSession.user, null);
    assert.strictEqual(cleanSession.token, null);
  });

  test('13. Hospital registration sets approvalStatus to PENDING_APPROVAL', async () => {
    const res = await authService.login({ identifier: '08093334444', password: 'secret123' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.session?.user?.organization?.approvalStatus, 'PENDING_APPROVAL');
  });

  test('14. Unverified responder cannot switch online in responder service', () => {
    // Unverified responder
    responderService.setVerificationStatus('PENDING');
    let toggle = responderService.setAvailability('ONLINE');
    assert.strictEqual(toggle.success, false);
    assert.match(toggle.error || '', /VERIFICATION_REQUIRED/);

    // Suspended responder
    responderService.setVerificationStatus('SUSPENDED');
    toggle = responderService.setAvailability('ONLINE');
    assert.strictEqual(toggle.success, false);
    assert.match(toggle.error || '', /VERIFICATION_REQUIRED/);

    // Only verified responder can switch online
    responderService.setVerificationStatus('VERIFIED');
    toggle = responderService.setAvailability('ONLINE');
    assert.strictEqual(toggle.success, true);
  });

  test('15. Production mode does NOT silently fall back to mock authentication', async () => {
    // Explicitly disable mock mode to simulate production
    authService.setMockMode(false);
    assert.strictEqual(authService.isMockMode(), false);

    const loginAttempt = await authService.login({
      identifier: '08031234567',
      password: 'secret123',
    });

    // In production without live backend auth endpoints, MUST return SERVICE_UNAVAILABLE error
    // It must NEVER invent a successful login or silently use mock identities!
    assert.strictEqual(loginAttempt.success, false);
    assert.match(loginAttempt.error || '', /SERVICE_UNAVAILABLE/);
  });
});
