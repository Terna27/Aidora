import React, { createContext, useContext, useState, useEffect } from 'react';
import { PatientProfile, LoginCredentials, RegisterPayload } from '../types/auth';
import { EmergencyRequest } from '../types/emergency';
import { serviceRegistry } from '../services/serviceRegistry';

interface AuthContextValue {
  patient: PatientProfile | null;
  isAuthenticated: boolean;
  activeEmergency: EmergencyRequest | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshActiveEmergency: () => Promise<EmergencyRequest | null>;
  setActiveEmergency: (em: EmergencyRequest | null) => void;
  dismissActiveEmergency: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const profile = await serviceRegistry.authService.getProfile();
        setPatient(profile);
        if (profile) {
          const active = await serviceRegistry.emergencyService.getActiveEmergency(profile.id);
          setActiveEmergency(active);
        }
      } catch (e) {
        console.warn('Initial session restore error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const res = await serviceRegistry.authService.login(credentials);
    setPatient(res.patient);
    const active = await serviceRegistry.emergencyService.getActiveEmergency(res.patient.id);
    setActiveEmergency(active);
  };

  const loginAsDemo = async () => {
    const res = await serviceRegistry.authService.loginAsDemo();
    setPatient(res.patient);
    const active = await serviceRegistry.emergencyService.getActiveEmergency(res.patient.id);
    setActiveEmergency(active);
  };

  const register = async (payload: RegisterPayload) => {
    const res = await serviceRegistry.authService.register(payload);
    setPatient(res.patient);
    setActiveEmergency(null);
  };

  const logout = async () => {
    await serviceRegistry.authService.logout();
    setPatient(null);
    setActiveEmergency(null);
  };

  const refreshProfile = async () => {
    const profile = await serviceRegistry.authService.getProfile();
    setPatient(profile);
  };

  const refreshActiveEmergency = async () => {
    if (!patient) return null;
    const active = await serviceRegistry.emergencyService.getActiveEmergency(patient.id);
    setActiveEmergency(active);
    return active;
  };

  const dismissActiveEmergency = async () => {
    if (activeEmergency) {
      await serviceRegistry.emergencyService.dismissEmergency(activeEmergency.id);
      setActiveEmergency(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        patient,
        isAuthenticated: !!patient,
        activeEmergency,
        loading,
        login,
        loginAsDemo,
        register,
        logout,
        refreshProfile,
        refreshActiveEmergency,
        setActiveEmergency,
        dismissActiveEmergency,
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
