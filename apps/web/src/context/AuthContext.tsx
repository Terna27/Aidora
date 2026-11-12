import React, { createContext, useContext, useState, useEffect } from 'react';
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
} from '../types/auth';
import { authService } from '../services/auth/authService';

interface AuthContextValue {
  session: AuthSession;
  loading: boolean;
  isMockMode: boolean;
  login: (payload: LoginPayload) => Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  registerPatient: (payload: PatientRegisterPayload) => Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  registerResponder: (payload: ResponderRegisterPayload) => Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  registerHospital: (payload: HospitalRegisterPayload) => Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  validateInvitation: (token: string) => Promise<InvitationValidationResult>;
  acceptInvitation: (payload: AcceptInvitationPayload) => Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  registerDispatcherWithToken: (payload: DispatcherRegisterPayload) => Promise<{ success: boolean; session?: AuthSession; error?: string }>;
  forgotPassword: (payload: ForgotPasswordPayload) => Promise<{ success: boolean; message: string; error?: string }>;
  resetPassword: (payload: ResetPasswordPayload) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession>(() => authService.getCurrentSession());
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsub = authService.subscribe((updatedSession) => {
      setSession(updatedSession);
    });
    return () => unsub();
  }, []);

  const login = async (payload: LoginPayload) => {
    setLoading(true);
    try {
      return await authService.login(payload);
    } finally {
      setLoading(false);
    }
  };

  const registerPatient = async (payload: PatientRegisterPayload) => {
    setLoading(true);
    try {
      return await authService.registerPatient(payload);
    } finally {
      setLoading(false);
    }
  };

  const registerResponder = async (payload: ResponderRegisterPayload) => {
    setLoading(true);
    try {
      return await authService.registerResponder(payload);
    } finally {
      setLoading(false);
    }
  };

  const registerHospital = async (payload: HospitalRegisterPayload) => {
    setLoading(true);
    try {
      return await authService.registerHospital(payload);
    } finally {
      setLoading(false);
    }
  };

  const validateInvitation = async (token: string) => {
    return authService.validateInvitation(token);
  };

  const acceptInvitation = async (payload: AcceptInvitationPayload) => {
    setLoading(true);
    try {
      return await authService.acceptInvitation(payload);
    } finally {
      setLoading(false);
    }
  };

  const registerDispatcherWithToken = async (payload: DispatcherRegisterPayload) => {
    setLoading(true);
    try {
      return await authService.registerDispatcherWithToken(payload);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (payload: ForgotPasswordPayload) => {
    return authService.forgotPassword(payload);
  };

  const resetPassword = async (payload: ResetPasswordPayload) => {
    return authService.resetPassword(payload);
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        isMockMode: authService.isMockMode(),
        login,
        registerPatient,
        registerResponder,
        registerHospital,
        validateInvitation,
        acceptInvitation,
        registerDispatcherWithToken,
        forgotPassword,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
