/**
 * Unified Authentication Service for Aidora Web
 * Orchestrates authentication requests, enforcing strict separation
 * between production API contracts and isolated development fixtures.
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
} from '../../types/auth';
import { apiClient } from '../apiClient';
import { mockAuthAdapter } from './mockAuthAdapter';

const getEnvMockAuth = (): boolean => {
  try {
    // @ts-expect-error import.meta.env
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_ENABLE_MOCK_AUTH !== undefined) {
      // @ts-expect-error import.meta.env
      return import.meta.env.VITE_ENABLE_MOCK_AUTH === 'true';
    }
  } catch {
    // fall through
  }

  try {
    if (typeof process !== 'undefined' && process.env?.VITE_ENABLE_MOCK_AUTH !== undefined) {
      return process.env.VITE_ENABLE_MOCK_AUTH === 'true';
    }
  } catch {
    // fall through
  }

  // Default to true in development test mode
  return true;
};

export interface IAuthService {
  isMockMode(): boolean;
  setMockMode(enabled: boolean): void;
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
  private mockEnabled: boolean = getEnvMockAuth();
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

  public isMockMode(): boolean {
    return this.mockEnabled;
  }

  public setMockMode(enabled: boolean): void {
    this.mockEnabled = enabled;
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
    if (this.mockEnabled) {
      mockAuthAdapter.setSession(session);
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('aidline_web_session', JSON.stringify(session));
      } catch {
        // storage disabled or quota exceeded
      }
    }
    apiClient.setToken(session.token);
    this.notify();
  }

  public getCurrentSession(): AuthSession {
    if (this.mockEnabled) {
      return mockAuthAdapter.getCurrentSession();
    }

    if (this.memorySession) {
      // Check expiry
      if (this.memorySession.tokenExpiry && new Date(this.memorySession.tokenExpiry).getTime() < Date.now()) {
        this.logoutSync();
        return {
          user: null,
          token: null,
          tokenExpiry: null,
          isAuthenticated: false,
          isMock: false,
        };
      }
      return { ...this.memorySession };
    }

    return {
      user: null,
      token: null,
      tokenExpiry: null,
      isAuthenticated: false,
      isMock: this.mockEnabled,
    };
  }

  // ----------------------------------------------------------------------
  // Login
  // ----------------------------------------------------------------------
  public async login(
    payload: LoginPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    if (this.mockEnabled) {
      const res = await mockAuthAdapter.login(payload);
      if (res.success && res.session) {
        this.saveSession(res.session);
      }
      return res;
    }

    // Production flow: Never fake response if backend is missing!
    const response = await apiClient.request<{ token: string; user: AuthSession['user'] }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error: `SERVICE_UNAVAILABLE: Production authentication endpoints are currently unreachable (${response.error || 'Connection refused'}). Check your network or contact system administrator.`,
      };
    }

    const session: AuthSession = {
      user: response.data.user,
      token: response.data.token,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: false,
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
    if (this.mockEnabled) {
      const res = await mockAuthAdapter.registerPatient(payload);
      if (res.success && res.session) {
        this.saveSession(res.session);
      }
      return res;
    }

    const response = await apiClient.request<{ token: string; user: AuthSession['user'] }>(
      '/auth/register/patient',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error: `SERVICE_UNAVAILABLE: Production patient registration endpoint is unreachable (${response.error || 'Connection refused'}).`,
      };
    }

    const session: AuthSession = {
      user: response.data.user,
      token: response.data.token,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: false,
    };

    this.saveSession(session);
    return { success: true, session };
  }

  // ----------------------------------------------------------------------
  // Responder Registration
  // ----------------------------------------------------------------------
  public async registerResponder(
    payload: ResponderRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    if (this.mockEnabled) {
      const res = await mockAuthAdapter.registerResponder(payload);
      if (res.success && res.session) {
        this.saveSession(res.session);
      }
      return res;
    }

    const response = await apiClient.request<{ token: string; user: AuthSession['user'] }>(
      '/auth/register/responder',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error:
          response.error ||
          'SERVICE_UNAVAILABLE: Production responder registration endpoint is unreachable.',
      };
    }

    const session: AuthSession = {
      user: response.data.user,
      token: response.data.token,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: false,
    };

    this.saveSession(session);
    return { success: true, session };
  }

  // ----------------------------------------------------------------------
  // Hospital Registration
  // ----------------------------------------------------------------------
  public async registerHospital(
    payload: HospitalRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    if (this.mockEnabled) {
      const res = await mockAuthAdapter.registerHospital(payload);
      if (res.success && res.session) {
        this.saveSession(res.session);
      }
      return res;
    }

    const response = await apiClient.request<{ token: string; user: AuthSession['user'] }>(
      '/auth/register/hospital',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error:
          response.error ||
          'SERVICE_UNAVAILABLE: Production hospital organization registration endpoint is unreachable.',
      };
    }

    const session: AuthSession = {
      user: response.data.user,
      token: response.data.token,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: false,
    };

    this.saveSession(session);
    return { success: true, session };
  }

  // ----------------------------------------------------------------------
  // Invitations
  // ----------------------------------------------------------------------
  public async validateInvitation(token: string): Promise<InvitationValidationResult> {
    if (this.mockEnabled) {
      return mockAuthAdapter.validateInvitation(token);
    }

    const res = await apiClient.request<InvitationValidationResult>(
      `/auth/invitations/${encodeURIComponent(token)}`
    );

    if (!res.success || !res.data) {
      return {
        valid: false,
        token,
        organizationId: '',
        organizationName: '',
        organizationType: 'HOSPITAL',
        assignedRole: '',
        expiresAt: '',
        error: res.error || 'SERVICE_UNAVAILABLE: Unable to validate invitation token with production server.',
      };
    }

    return res.data;
  }

  public async acceptInvitation(
    payload: AcceptInvitationPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    if (this.mockEnabled) {
      const res = await mockAuthAdapter.acceptInvitation(payload);
      if (res.success && res.session) {
        this.saveSession(res.session);
      }
      return res;
    }

    const response = await apiClient.request<{ token: string; user: AuthSession['user'] }>(
      '/auth/invitations/accept',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error:
          response.error ||
          'SERVICE_UNAVAILABLE: Production invitation acceptance endpoint is unreachable.',
      };
    }

    const session: AuthSession = {
      user: response.data.user,
      token: response.data.token,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: false,
    };

    this.saveSession(session);
    return { success: true, session };
  }

  public async registerDispatcherWithToken(
    payload: DispatcherRegisterPayload
  ): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
    if (this.mockEnabled) {
      const res = await mockAuthAdapter.registerDispatcherWithToken(payload);
      if (res.success && res.session) {
        this.saveSession(res.session);
      }
      return res;
    }

    const response = await apiClient.request<{ token: string; user: AuthSession['user'] }>(
      '/auth/register/dispatcher',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error:
          response.error ||
          'SERVICE_UNAVAILABLE: Production dispatcher registration endpoint is unreachable.',
      };
    }

    const session: AuthSession = {
      user: response.data.user,
      token: response.data.token,
      tokenExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      isAuthenticated: true,
      isMock: false,
    };

    this.saveSession(session);
    return { success: true, session };
  }

  // ----------------------------------------------------------------------
  // Password Recovery
  // ----------------------------------------------------------------------
  public async forgotPassword(
    payload: ForgotPasswordPayload
  ): Promise<{ success: boolean; message: string; error?: string }> {
    if (this.mockEnabled) {
      return mockAuthAdapter.forgotPassword(payload);
    }

    const res = await apiClient.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.success) {
      return {
        success: false,
        message: '',
        error: res.error || 'SERVICE_UNAVAILABLE: Password recovery endpoint is unreachable.',
      };
    }

    return { success: true, message: res.data?.message || 'Password recovery instructions dispatched.' };
  }

  public async resetPassword(
    payload: ResetPasswordPayload
  ): Promise<{ success: boolean; error?: string }> {
    if (this.mockEnabled) {
      return mockAuthAdapter.resetPassword(payload);
    }

    const res = await apiClient.request<{ success: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.success) {
      return {
        success: false,
        error: res.error || 'SERVICE_UNAVAILABLE: Password reset endpoint is unreachable.',
      };
    }

    return { success: true };
  }

  // ----------------------------------------------------------------------
  // Logout
  // ----------------------------------------------------------------------
  private logoutSync(): void {
    this.memorySession = null;
    mockAuthAdapter.logout();
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem('aidline_web_session');
      } catch {
        // ignore
      }
    }
    apiClient.setToken(null);
    this.notify();
  }

  public async logout(): Promise<void> {
    if (!this.mockEnabled && this.memorySession?.token) {
      await apiClient.request('/auth/logout', { method: 'POST' });
    }
    this.logoutSync();
  }
}

export const authService = new AuthService();
