/**
 * Development Mock Authentication Adapter
 * Isolated from production mode. Provides realistic local simulation of
 * registration, login, invitation validation, and approval checks.
 */

import {
  UserProfile,
  PatientRegisterPayload,
  ResponderRegisterPayload,
  HospitalRegisterPayload,
  AcceptInvitationPayload,
  DispatcherRegisterPayload,
  InvitationValidationResult,
  LoginPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  AuthSession,
} from '../../types/auth';

export class MockAuthAdapter {
  // Pre-seeded identities
  private users: Record<string, UserProfile> = {
    'pat-001': {
      id: 'pat-001',
      fullName: 'Amina Bello',
      phoneNumber: '08031234567',
      email: 'amina.bello@example.com',
      role: 'PATIENT',
      communityOrVillage: 'Garki Central, Area 11',
      verificationStatus: 'VERIFIED',
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    },
    'resp-verified': {
      id: 'resp-verified',
      fullName: 'Chidi Okafor',
      phoneNumber: '08025557890',
      email: 'chidi.okafor@example.com',
      role: 'RESPONDER',
      communityOrVillage: 'Garki Central',
      verificationStatus: 'VERIFIED',
      responderVehicleType: 'MOTORCYCLE',
      responderVehicleReg: 'ABJ-882-MK',
      createdAt: '2026-10-15T09:00:00Z',
      updatedAt: '2026-11-11T14:30:00Z',
    },
    'resp-pending': {
      id: 'resp-pending',
      fullName: 'Sani Dauda',
      phoneNumber: '08021112233',
      role: 'RESPONDER',
      communityOrVillage: 'Lugbe Sector 1',
      verificationStatus: 'PENDING',
      responderVehicleType: 'TAXI',
      responderVehicleReg: 'RSH-204-XY',
      createdAt: '2026-11-12T08:00:00Z',
      updatedAt: '2026-11-12T08:00:00Z',
    },
    'hosp-approved': {
      id: 'hosp-approved',
      fullName: 'Dr. Kelechi Okafor',
      phoneNumber: '08009990001',
      email: 'admin@apexgeneral.org',
      role: 'HOSPITAL_ADMIN',
      communityOrVillage: 'Central Hospital Zone',
      verificationStatus: 'VERIFIED',
      organization: {
        organizationId: 'org-apex-01',
        organizationName: 'General Hospital Apex',
        organizationType: 'HOSPITAL',
        membershipRole: 'Chief Medical Director & Triage Lead',
        approvalStatus: 'APPROVED',
        licenseNumber: 'MOH/FCT/2024/091',
        lga: 'Abuja Municipal',
        state: 'FCT',
      },
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    },
    'hosp-pending': {
      id: 'hosp-pending',
      fullName: 'Nurse Grace Eze',
      phoneNumber: '08093334444',
      email: 'admin@hopematernity.ng',
      role: 'HOSPITAL_ADMIN',
      communityOrVillage: 'Kubwa Extension',
      verificationStatus: 'PENDING',
      organization: {
        organizationId: 'org-hope-02',
        organizationName: 'Hope Community Maternity Clinic',
        organizationType: 'HOSPITAL',
        membershipRole: 'Proprietor & Nurse Lead',
        approvalStatus: 'PENDING_APPROVAL',
        licenseNumber: 'MOH/FCT/2026/412-PENDING',
        lga: 'Bwari',
        state: 'FCT',
      },
      createdAt: '2026-11-12T09:30:00Z',
      updatedAt: '2026-11-12T09:30:00Z',
    },
    'disp-lead': {
      id: 'disp-lead',
      fullName: 'N. Eze',
      phoneNumber: '08077778899',
      email: 'n.eze@dispatch.aidline.org',
      role: 'DISPATCHER',
      communityOrVillage: 'FCT Dispatch Command Center',
      verificationStatus: 'VERIFIED',
      organization: {
        organizationId: 'org-fct-dispatch',
        organizationName: 'FCT Emergency Medical Dispatch Center',
        organizationType: 'DISPATCH_AGENCY',
        membershipRole: 'Senior Lead Dispatcher',
        approvalStatus: 'APPROVED',
      },
      createdAt: '2026-08-15T07:00:00Z',
      updatedAt: '2026-11-12T07:00:00Z',
    },
    'admin-root': {
      id: 'admin-root',
      fullName: 'Director Danjuma',
      phoneNumber: '08000000001',
      email: 'admin@aidline.gov.ng',
      role: 'PLATFORM_ADMIN',
      communityOrVillage: 'Operations HQ',
      verificationStatus: 'VERIFIED',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-11-12T00:00:00Z',
    },
  };

  // Valid invitations dictionary
  private invitations: Record<string, InvitationValidationResult> = {
    'HOSP-INV-VALID-2026': {
      valid: true,
      token: 'HOSP-INV-VALID-2026',
      organizationId: 'org-apex-01',
      organizationName: 'General Hospital Apex',
      organizationType: 'HOSPITAL',
      assignedRole: 'Emergency Triage Nurse',
      invitedEmail: 'nurse.fatima@apexgeneral.org',
      expiresAt: '2028-12-31T23:59:59Z',
    },
    'HOSP-INV-EXPIRED-2025': {
      valid: false,
      token: 'HOSP-INV-EXPIRED-2025',
      organizationId: 'org-apex-01',
      organizationName: 'General Hospital Apex',
      organizationType: 'HOSPITAL',
      assignedRole: 'Obstetrics Officer',
      expiresAt: '2025-01-01T00:00:00Z',
      error: 'INVITATION_EXPIRED: This hospital invitation has expired.',
    },
    'DISP-AUTH-VALID-884': {
      valid: true,
      token: 'DISP-AUTH-VALID-884',
      organizationId: 'org-fct-dispatch',
      organizationName: 'FCT Emergency Medical Dispatch Center',
      organizationType: 'DISPATCH_AGENCY',
      assignedRole: 'Regional Tactical Dispatcher',
      expiresAt: '2028-12-31T23:59:59Z',
    },
  };

  private currentSession: AuthSession = {
    user: null,
    token: null,
    tokenExpiry: null,
    isAuthenticated: false,
    isMock: true,
  };

  private cleanPhone(phone: string): string {
    return phone.replace(/[\s\-\(\)\+]/g, '');
  }

  // ----------------------------------------------------------------------
  // Login
  // ----------------------------------------------------------------------
  public async login(payload: LoginPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    const cleanId = this.cleanPhone(payload.identifier);
    if (!cleanId || cleanId.length < 5) {
      return { success: false, error: 'Please enter a valid phone number or email address.' };
    }
    if (!payload.password || payload.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // Match by phone or email
    const user = Object.values(this.users).find((u) => {
      const p = this.cleanPhone(u.phoneNumber);
      const isPhoneMatch = p.endsWith(cleanId) || cleanId.endsWith(p);
      const isEmailMatch = u.email && u.email.toLowerCase() === payload.identifier.toLowerCase().trim();
      return isPhoneMatch || isEmailMatch;
    });

    if (!user) {
      return {
        success: false,
        error: 'Invalid credentials. No registered account matches the provided identifier.',
      };
    }

    // If targetRole specified, check that user matches
    if (payload.targetRole && user.role !== payload.targetRole) {
      // Allow HOSPITAL_ADMIN and HOSPITAL_STAFF to share hospital portal
      const isBothHospital =
        (user.role === 'HOSPITAL_ADMIN' || user.role === 'HOSPITAL_STAFF') &&
        (payload.targetRole === 'HOSPITAL_ADMIN' || payload.targetRole === 'HOSPITAL_STAFF');
      if (!isBothHospital) {
        return {
          success: false,
          error: `Account role mismatch: this identity is registered as a ${user.role}, not a ${payload.targetRole}.`,
        };
      }
    }

    // Set 8-hour token expiry
    const expiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    this.currentSession = {
      user: { ...user },
      token: `mock-jwt-${user.id}-${Date.now()}`,
      tokenExpiry: expiry,
      isAuthenticated: true,
      isMock: true,
    };

    return { success: true, session: { ...this.currentSession } };
  }

  // ----------------------------------------------------------------------
  // Patient Registration
  // ----------------------------------------------------------------------
  public async registerPatient(
    payload: PatientRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    if (!payload.fullName || payload.fullName.trim().length < 2) {
      return { success: false, error: 'Full name is required (minimum 2 characters).' };
    }
    const cleanPhone = this.cleanPhone(payload.phoneNumber);
    if (!cleanPhone || cleanPhone.length < 8) {
      return { success: false, error: 'Valid phone number is required (at least 8 digits).' };
    }
    if (!payload.password || payload.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    if (payload.password !== payload.confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }
    if (!payload.communityOrVillage || !payload.communityOrVillage.trim()) {
      return { success: false, error: 'Community or village location is required.' };
    }
    if (!payload.agreedToTerms) {
      return { success: false, error: 'You must agree to the privacy notice and service terms.' };
    }

    // Check duplicate
    const existing = Object.values(this.users).find(
      (u) => this.cleanPhone(u.phoneNumber) === cleanPhone
    );
    if (existing) {
      return { success: false, error: 'An account with this phone number is already registered.' };
    }

    const newId = `pat-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();
    const newUser: UserProfile = {
      id: newId,
      fullName: payload.fullName.trim(),
      phoneNumber: payload.phoneNumber.trim(),
      email: payload.email?.trim() || undefined,
      role: 'PATIENT',
      communityOrVillage: payload.communityOrVillage.trim(),
      verificationStatus: 'VERIFIED',
      createdAt: now,
      updatedAt: now,
    };

    this.users[newId] = newUser;
    this.currentSession = {
      user: newUser,
      token: `mock-jwt-${newUser.id}-${Date.now()}`,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: true,
    };

    return { success: true, session: { ...this.currentSession } };
  }

  // ----------------------------------------------------------------------
  // Responder Registration
  // ----------------------------------------------------------------------
  public async registerResponder(
    payload: ResponderRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    if (!payload.fullName || payload.fullName.trim().length < 2) {
      return { success: false, error: 'Full name is required.' };
    }
    const cleanPhone = this.cleanPhone(payload.phoneNumber);
    if (!cleanPhone || cleanPhone.length < 8) {
      return { success: false, error: 'Valid phone number is required (at least 8 digits).' };
    }
    if (!payload.password || payload.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    if (payload.password !== payload.confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }
    if (!payload.communityBase || !payload.communityBase.trim()) {
      return { success: false, error: 'Community base operating area is required.' };
    }
    if (!payload.vehicleType) {
      return { success: false, error: 'Vehicle type selection is required.' };
    }
    if (!payload.vehicleMakeModel || !payload.licensePlate) {
      return { success: false, error: 'Vehicle make/model and license plate registration are required.' };
    }
    if (!payload.driverLicenseNumber || !payload.driverLicenseNumber.trim()) {
      return { success: false, error: "Driver's license number is required for verification." };
    }
    if (!payload.agreedToTerms) {
      return {
        success: false,
        error: 'You must agree to the operational transportation terms (confirming non-medical driver role).',
      };
    }

    const newId = `resp-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();
    // CRITICAL: Responder registration ALWAYS defaults to PENDING verification
    const newUser: UserProfile = {
      id: newId,
      fullName: payload.fullName.trim(),
      phoneNumber: payload.phoneNumber.trim(),
      email: payload.email?.trim() || undefined,
      role: 'RESPONDER',
      communityOrVillage: payload.communityBase.trim(),
      verificationStatus: 'PENDING',
      responderVehicleType: payload.vehicleType,
      responderVehicleReg: payload.licensePlate.trim().toUpperCase(),
      createdAt: now,
      updatedAt: now,
    };

    this.users[newId] = newUser;
    this.currentSession = {
      user: newUser,
      token: `mock-jwt-${newUser.id}-${Date.now()}`,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: true,
    };

    return { success: true, session: { ...this.currentSession } };
  }

  // ----------------------------------------------------------------------
  // Hospital Organization Registration
  // ----------------------------------------------------------------------
  public async registerHospital(
    payload: HospitalRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    if (!payload.hospitalName || payload.hospitalName.trim().length < 3) {
      return { success: false, error: 'Official hospital name is required.' };
    }
    if (!payload.licenseNumber || !payload.licenseNumber.trim()) {
      return { success: false, error: 'Ministry of Health facility license or registration ID is required.' };
    }
    if (!payload.address || !payload.lga || !payload.state) {
      return { success: false, error: 'Complete facility address, LGA and State are required.' };
    }
    if (!payload.contactPhone || !payload.officialEmail) {
      return { success: false, error: 'Facility contact phone and official email are required.' };
    }
    if (!payload.adminFullName || !payload.adminPhone) {
      return { success: false, error: 'Hospital organization administrator contact details are required.' };
    }
    if (!payload.password || payload.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    if (payload.password !== payload.confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }
    if (!payload.agreedToTerms) {
      return { success: false, error: 'You must agree to healthcare facility regulatory and compliance terms.' };
    }

    const orgId = `org-${Date.now().toString().slice(-4)}`;
    const adminId = `hosp-adm-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    // CRITICAL: Hospital registration creates organization application with PENDING_APPROVAL
    const newUser: UserProfile = {
      id: adminId,
      fullName: payload.adminFullName.trim(),
      phoneNumber: payload.adminPhone.trim(),
      email: payload.adminEmail.trim(),
      role: 'HOSPITAL_ADMIN',
      communityOrVillage: payload.community.trim(),
      verificationStatus: 'PENDING',
      organization: {
        organizationId: orgId,
        organizationName: payload.hospitalName.trim(),
        organizationType: 'HOSPITAL',
        membershipRole: 'Hospital Organization Administrator',
        approvalStatus: 'PENDING_APPROVAL',
        licenseNumber: payload.licenseNumber.trim(),
        lga: payload.lga.trim(),
        state: payload.state.trim(),
      },
      createdAt: now,
      updatedAt: now,
    };

    this.users[adminId] = newUser;
    this.currentSession = {
      user: newUser,
      token: `mock-jwt-${newUser.id}-${Date.now()}`,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: true,
    };

    return { success: true, session: { ...this.currentSession } };
  }

  // ----------------------------------------------------------------------
  // Invitation Validation & Acceptance (Hospital Staff & Dispatcher)
  // ----------------------------------------------------------------------
  public async validateInvitation(token: string): Promise<InvitationValidationResult> {
    if (!token || !token.trim()) {
      return {
        valid: false,
        token: '',
        organizationId: '',
        organizationName: '',
        organizationType: 'HOSPITAL',
        assignedRole: '',
        expiresAt: '',
        error: 'INVITATION_INVALID: Invitation token is missing or empty.',
      };
    }

    const found = this.invitations[token.trim()];
    if (!found) {
      return {
        valid: false,
        token: token.trim(),
        organizationId: '',
        organizationName: '',
        organizationType: 'HOSPITAL',
        assignedRole: '',
        expiresAt: '',
        error: 'INVITATION_NOT_FOUND: No active organization invitation matches this token.',
      };
    }

    if (new Date(found.expiresAt).getTime() < Date.now()) {
      return {
        ...found,
        valid: false,
        error: 'INVITATION_EXPIRED: This organization invitation has expired. Contact your facility administrator.',
      };
    }

    return { ...found };
  }

  public async acceptInvitation(
    payload: AcceptInvitationPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    const validRes = await this.validateInvitation(payload.token);
    if (!validRes.valid) {
      return { success: false, error: validRes.error || 'Invitation is invalid or expired.' };
    }

    if (!payload.fullName || payload.fullName.trim().length < 2) {
      return { success: false, error: 'Full name is required.' };
    }
    const cleanPhone = this.cleanPhone(payload.phoneNumber);
    if (!cleanPhone || cleanPhone.length < 8) {
      return { success: false, error: 'Valid phone number is required (at least 8 digits).' };
    }
    if (!payload.password || payload.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    if (payload.password !== payload.confirmPassword) {
      return { success: false, error: 'Passwords do not match.' };
    }
    if (!payload.agreedToTerms) {
      return { success: false, error: 'You must agree to organization staff terms.' };
    }

    const staffId = `staff-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    const isDispatch = validRes.organizationType === 'DISPATCH_AGENCY';
    const newUser: UserProfile = {
      id: staffId,
      fullName: payload.fullName.trim(),
      phoneNumber: payload.phoneNumber.trim(),
      role: isDispatch ? 'DISPATCHER' : 'HOSPITAL_STAFF',
      communityOrVillage: validRes.organizationName,
      verificationStatus: 'VERIFIED',
      organization: {
        organizationId: validRes.organizationId,
        organizationName: validRes.organizationName,
        organizationType: validRes.organizationType,
        membershipRole: validRes.assignedRole,
        approvalStatus: 'APPROVED',
      },
      createdAt: now,
      updatedAt: now,
    };

    this.users[staffId] = newUser;
    this.currentSession = {
      user: newUser,
      token: `mock-jwt-${newUser.id}-${Date.now()}`,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: true,
    };

    return { success: true, session: { ...this.currentSession } };
  }

  // ----------------------------------------------------------------------
  // Dispatcher Token Registration
  // ----------------------------------------------------------------------
  public async registerDispatcherWithToken(
    payload: DispatcherRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    const validRes = await this.validateInvitation(payload.authorizationToken);
    if (!validRes.valid || validRes.organizationType !== 'DISPATCH_AGENCY') {
      return {
        success: false,
        error:
          'UNAUTHORIZED_DISPATCH_REGISTRATION: Public registration cannot grant dispatcher privileges without valid regional agency authorization code.',
      };
    }

    return this.acceptInvitation({
      token: payload.authorizationToken,
      fullName: payload.fullName,
      phoneNumber: payload.phoneNumber,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
      agreedToTerms: payload.agreedToTerms,
    });
  }

  // ----------------------------------------------------------------------
  // Password Recovery
  // ----------------------------------------------------------------------
  public async forgotPassword(
    payload: ForgotPasswordPayload
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const clean = payload.identifier.trim();
    if (!clean) {
      return { success: false, message: '', error: 'Phone number or email is required.' };
    }
    return {
      success: true,
      message: `Password reset verification OTP has been dispatched to ${clean}. Valid for 10 minutes.`,
    };
  }

  public async resetPassword(
    payload: ResetPasswordPayload
  ): Promise<{ success: boolean; error?: string }> {
    if (!payload.token || payload.token.trim().length < 4) {
      return { success: false, error: 'Valid 4-digit verification OTP is required.' };
    }
    if (!payload.newPassword || payload.newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters.' };
    }
    if (payload.newPassword !== payload.confirmPassword) {
      return { success: false, error: 'New passwords do not match.' };
    }
    return { success: true };
  }

  // ----------------------------------------------------------------------
  // Session & Logout
  // ----------------------------------------------------------------------
  public getCurrentSession(): AuthSession {
    // Check expiry
    if (this.currentSession.tokenExpiry) {
      if (new Date(this.currentSession.tokenExpiry).getTime() < Date.now()) {
        this.logout();
      }
    }
    return { ...this.currentSession };
  }

  public setSession(session: AuthSession) {
    this.currentSession = { ...session };
  }

  public logout(): void {
    this.currentSession = {
      user: null,
      token: null,
      tokenExpiry: null,
      isAuthenticated: false,
      isMock: true,
    };
  }
}

export const mockAuthAdapter = new MockAuthAdapter();
