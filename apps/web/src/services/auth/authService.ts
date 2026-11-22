/**
 * Authentication Service for Aidora Web
 * Handles authentication through the AIDORA backend API.
 */

import {
  AuthSession,
  LoginPayload,
  PatientRegisterPayload,
  ResponderRegisterPayload,
  HospitalRegisterPayload,
  AcceptInvitationPayload,
  DispatcherRegisterPayload,
  InvitationValidationResult,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  BackendTokenPair,
  BackendUser,
  UserRole,
} from '../../types/auth';
import { apiClient } from '../apiClient';

export interface IAuthService {
  login(payload: LoginPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  registerPatient(payload: PatientRegisterPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  registerResponder(payload: ResponderRegisterPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  registerHospital(payload: HospitalRegisterPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  validateInvitation(token: string): Promise<InvitationValidationResult>;
  acceptInvitation(payload: AcceptInvitationPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  registerDispatcherWithToken(payload: DispatcherRegisterPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  forgotPassword(payload: ForgotPasswordPayload): Promise<{ success: boolean; message: string; error?: string }>;
  resetPassword(payload: ResetPasswordPayload): Promise<{ success: boolean; error?: string }>;
  getCurrentSession(): AuthSession;
  logout(): Promise<void>;
  subscribe(listener: (session: AuthSession) => void): () => void;
}

export class AuthService implements IAuthService {
  private listeners: ((session: AuthSession) => void)[] = [];
  private memorySession: AuthSession | null = null;

  constructor() {
    // Restore session if present in sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem('aidline_web_session');
        if (stored) {
          const parsed = JSON.parse(stored) as AuthSession;
          if (parsed.tokenExpiry && new Date(parsed.tokenExpiry).getTime() > Date.now()) {
            this.memorySession = parsed;
          } else {
            window.sessionStorage.removeItem('aidline_web_session');
          }
        }
      } catch {
        // ignore
      }
    }
  }

  public subscribe(listener: (session: AuthSession) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const session = this.getCurrentSession();
    for (const listener of this.listeners) {
      listener(session);
    }
  }

  private saveSession(session: AuthSession) {
    this.memorySession = session;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('aidline_web_session', JSON.stringify(session));
      } catch {
        // Storage disabled or quota exceeded
      }
    }

    apiClient.setToken(session.token);
    this.notify();
  }

  public getCurrentSession(): AuthSession {
    if (this.memorySession) {
      // Check expiry
      if (this.memorySession.tokenExpiry && new Date(this.memorySession.tokenExpiry).getTime() < Date.now()) {
        this.logoutSync();
        return {
          user: null,
          token: null,
          tokenExpiry: null,
          isAuthenticated: false,
        };
      }
      return { ...this.memorySession };
    }

    return {
      user: null,
      token: null,
      tokenExpiry: null,
      isAuthenticated: false,
    };
  }

  // ----------------------------------------------------------------------
  // Login
  // ----------------------------------------------------------------------
  public async login(
    payload: LoginPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    const response = await apiClient.request<BackendTokenPair>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({
          identifier: payload.identifier,
          password: payload.password,
        }),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Unable to log in. Please try again.',
      };
    }

    const backendUser = response.data.user;
    const primaryRole = backendUser.roles[0];

    if (!primaryRole) {
      return {
        success: false,
        error: 'The backend returned a user without an assigned role.',
      };
    }

    const session: AuthSession = {
      user: {
        id: backendUser.id,
        fullName: backendUser.fullName,
        email: backendUser.email,
        phoneNumber: backendUser.phoneNumber,
        roles: backendUser.roles,
        role: primaryRole as UserRole,
      },
      token: response.data.accessToken,
      tokenExpiry: response.data.accessExpiresAt,
      refreshToken: response.data.refreshToken,
      refreshTokenExpiry: response.data.refreshExpiresAt,
      isAuthenticated: true,
    };

    this.saveSession(session);

    return { success: true, session };
  }

  // ----------------------------------------------------------------------
  // Patient Registration
  // ----------------------------------------------------------------------
  public async registerPatient(
    payload: PatientRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    const response = await apiClient.request<BackendUser>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          fullName: payload.fullName,
          email: payload.email || undefined,
          phoneNumber: payload.phoneNumber || undefined,
          password: payload.password,
        }),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Unable to register. Please try again.',
      };
    }

    // Registration creates an unverified account, not an authenticated session.
    return { success: true };
  }

  // ----------------------------------------------------------------------
  // Responder Registration
  // ----------------------------------------------------------------------
  public async registerResponder(
    _payload: ResponderRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    return {
      success: false,
      error: 'Responder registration is not currently supported by the backend.',
    };
  }


  // ----------------------------------------------------------------------
  // Hospital Registration
  // ----------------------------------------------------------------------
  public async registerHospital(
    _payload: HospitalRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    return {
      success: false,
      error: 'Hospital registration is not currently supported by the backend.',
    };
  }

  // ----------------------------------------------------------------------
  // Invitations
  // ----------------------------------------------------------------------
  public async validateInvitation(
    _token: string
  ): Promise<InvitationValidationResult> {
    return {
      valid: false,
      token: _token,
      organizationId: '',
      organizationName: '',
      organizationType: 'HOSPITAL',
      assignedRole: '',
      expiresAt: '',
      error: 'Invitation validation is not currently supported by the backend.',
    };
  }
  public async acceptInvitation(
    _payload: AcceptInvitationPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    return {
      success: false,
      error: 'Invitation acceptance is not currently supported by the backend.',
    };
  }

  public async registerDispatcherWithToken(
    _payload: DispatcherRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    return {
      success: false,
      error: 'Dispatcher registration is not currently supported by the backend.',
    };
  }
  // ----------------------------------------------------------------------
  // Password Recovery
  // ----------------------------------------------------------------------
  public async forgotPassword(
    _payload: ForgotPasswordPayload
  ): Promise<{ success: boolean; message: string; error?: string }> {
    return {
      success: false,
      message: '',
      error: 'Password recovery is not currently available because the backend workflow has not been implemented.',
    };
  }

  public async resetPassword(
    _payload: ResetPasswordPayload
  ): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error: 'Password reset is not currently available because the backend workflow has not been implemented.',
    };
  }

  // ----------------------------------------------------------------------
  // Logout
  // ----------------------------------------------------------------------
  private logoutSync(): void {
    this.memorySession = null;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem('aidline_web_session');
      } catch {
        // Ignore storage errors.
      }
    }

    apiClient.setToken(null);
    this.notify();
  }

  public async logout(): Promise<void> {
    const session = this.memorySession;

    try {
      if (session?.token && session?.refreshToken) {
        await apiClient.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({
            refreshToken: session.refreshToken,
          }),
        });
      }
    } finally {
      this.logoutSync();
    }
  }
}

export const authService = new AuthService();
