import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  ResponderProfile,
  AvailabilityStatus,
  EmergencyOffer,
  ResponderStats,
  ResponderRegisterPayload,
} from '../types/responder';
import { EmergencyRequest, EmergencyState } from '../types/emergency';
import { serviceRegistry } from '../services/serviceRegistry';

interface ResponderAuthContextValue {
  responder: ResponderProfile | null;
  isAuthenticated: boolean;
  availability: AvailabilityStatus;
  activeOffer: EmergencyOffer | null;
  activeJourney: EmergencyRequest | null;
  stats: ResponderStats | null;
  loading: boolean;
  login: (phoneNumber: string, password?: string) => Promise<void>;
  loginAsDemo: (responderId?: string) => Promise<void>;
  register: (payload: ResponderRegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  toggleAvailability: (forcedStatus?: AvailabilityStatus) => Promise<void>;
  acceptOffer: (offerId: string) => Promise<EmergencyRequest>;
  declineOffer: (offerId: string, reason?: string) => Promise<void>;
  advanceJourneyState: (targetState: EmergencyState) => Promise<EmergencyRequest>;
  completeHandover: (handoverNotes?: string) => Promise<EmergencyRequest>;
  dismissCompletedJourney: () => void;
  refreshState: () => Promise<void>;
  triggerMockOffer: () => Promise<EmergencyOffer>;
}

const ResponderAuthContext = createContext<ResponderAuthContextValue | undefined>(undefined);

export const ResponderAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [responder, setResponder] = useState<ResponderProfile | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('OFFLINE');
  const [activeOffer, setActiveOffer] = useState<EmergencyOffer | null>(null);
  const [activeJourney, setActiveJourney] = useState<EmergencyRequest | null>(null);
  const [stats, setStats] = useState<ResponderStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshState = async () => {
    if (!responder) return;
    try {
      const avail = await serviceRegistry.responderJourneyService.getAvailability(responder.id);
      setAvailability(avail);

      const journey = await serviceRegistry.responderJourneyService.getActiveJourney(responder.id);
      setActiveJourney(journey);

      const offer = await serviceRegistry.responderJourneyService.getIncomingOffer(responder.id);
      setActiveOffer(offer);

      const st = await serviceRegistry.responderJourneyService.getResponderStats(responder.id);
      setStats(st);
    } catch (e) {
      console.warn('Responder state sync error:', e);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const profile = await serviceRegistry.responderAuthService.getProfile();
        setResponder(profile);
        if (profile) {
          const avail = await serviceRegistry.responderJourneyService.getAvailability(profile.id);
          setAvailability(avail);
          const journey = await serviceRegistry.responderJourneyService.getActiveJourney(profile.id);
          setActiveJourney(journey);
          const offer = await serviceRegistry.responderJourneyService.getIncomingOffer(profile.id);
          setActiveOffer(offer);
          const st = await serviceRegistry.responderJourneyService.getResponderStats(profile.id);
          setStats(st);
        }
      } catch (e) {
        console.warn('Responder session restore error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (phoneNumber: string, password?: string) => {
    const res = await serviceRegistry.responderAuthService.login(phoneNumber, password);
    setResponder(res.responder);
    const avail = await serviceRegistry.responderJourneyService.getAvailability(res.responder.id);
    setAvailability(avail);
    const journey = await serviceRegistry.responderJourneyService.getActiveJourney(res.responder.id);
    setActiveJourney(journey);
    const offer = await serviceRegistry.responderJourneyService.getIncomingOffer(res.responder.id);
    setActiveOffer(offer);
    const st = await serviceRegistry.responderJourneyService.getResponderStats(res.responder.id);
    setStats(st);
  };

  const loginAsDemo = async (responderId = 'resp-201') => {
    if (process.env.EXPO_PUBLIC_USE_MOCK === 'false') {
      throw new Error(
        'Demo account fast-track is restricted to mock development mode and strictly unavailable in production.'
      );
    }
    const res = await serviceRegistry.responderAuthService.loginAsDemo(responderId);
    setResponder(res.responder);
    const avail = await serviceRegistry.responderJourneyService.getAvailability(res.responder.id);
    setAvailability(avail);
    const journey = await serviceRegistry.responderJourneyService.getActiveJourney(res.responder.id);
    setActiveJourney(journey);
    const offer = await serviceRegistry.responderJourneyService.getIncomingOffer(res.responder.id);
    setActiveOffer(offer);
    const st = await serviceRegistry.responderJourneyService.getResponderStats(res.responder.id);
    setStats(st);
  };

  const register = async (payload: ResponderRegisterPayload) => {
    const res = await serviceRegistry.responderAuthService.register(payload);
    setResponder(res.responder);
    setAvailability('OFFLINE');
    setActiveJourney(null);
    setActiveOffer(null);
  };

  const logout = async () => {
    await serviceRegistry.responderAuthService.logout();
    setResponder(null);
    setAvailability('OFFLINE');
    setActiveOffer(null);
    setActiveJourney(null);
  };

  const toggleAvailability = async (forcedStatus?: AvailabilityStatus) => {
    if (!responder) return;
    const target = forcedStatus ? forcedStatus : availability === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    const updated = await serviceRegistry.responderJourneyService.setAvailability(
      responder.id,
      target,
      responder.verificationStatus
    );
    setAvailability(updated);
    if (updated === 'ONLINE') {
      const offer = await serviceRegistry.responderJourneyService.getIncomingOffer(responder.id);
      setActiveOffer(offer);
      if (offer) {
        serviceRegistry.notificationService.notifyOffer(offer);
      }
    } else {
      setActiveOffer(null);
    }
  };

  const acceptOffer = async (offerId: string) => {
    if (!responder) throw new Error('Unauthenticated');
    const journey = await serviceRegistry.responderJourneyService.acceptOffer(offerId, responder.id);
    setActiveJourney(journey);
    setActiveOffer(null);
    serviceRegistry.notificationService.notifyStateChange('ACCEPTED', 'Emergency ride accepted. Heading to pickup.');
    return journey;
  };

  const declineOffer = async (offerId: string, reason?: string) => {
    if (!responder) return;
    await serviceRegistry.responderJourneyService.declineOffer(offerId, responder.id, reason);
    setActiveOffer(null);
  };

  const advanceJourneyState = async (targetState: EmergencyState) => {
    if (!responder || !activeJourney) throw new Error('No active journey');
    const updated = await serviceRegistry.responderJourneyService.advanceJourneyState(
      activeJourney.id,
      responder.id,
      targetState
    );
    setActiveJourney({ ...updated });
    serviceRegistry.notificationService.notifyStateChange(targetState);
    return updated;
  };

  const completeHandover = async (handoverNotes?: string) => {
    if (!responder || !activeJourney) throw new Error('No active journey');
    const completed = await serviceRegistry.responderJourneyService.completeHandover(
      activeJourney.id,
      responder.id,
      handoverNotes
    );
    // Keep completed journey on screen until dismissed
    setActiveJourney({ ...completed });
    const st = await serviceRegistry.responderJourneyService.getResponderStats(responder.id);
    setStats(st);
    serviceRegistry.notificationService.notifyStateChange('COMPLETED', 'Handover successfully recorded with clinic staff.');
    return completed;
  };

  const dismissCompletedJourney = () => {
    setActiveJourney(null);
  };

  const triggerMockOffer = async () => {
    if (!responder) throw new Error('Unauthenticated');
    const offer = await serviceRegistry.responderJourneyService.triggerMockOffer(responder.id);
    setActiveOffer(offer);
    serviceRegistry.notificationService.notifyOffer(offer);
    return offer;
  };

  return (
    <ResponderAuthContext.Provider
      value={{
        responder,
        isAuthenticated: !!responder,
        availability,
        activeOffer,
        activeJourney,
        stats,
        loading,
        login,
        loginAsDemo,
        register,
        logout,
        toggleAvailability,
        acceptOffer,
        declineOffer,
        advanceJourneyState,
        completeHandover,
        dismissCompletedJourney,
        refreshState,
        triggerMockOffer,
      }}
    >
      {children}
    </ResponderAuthContext.Provider>
  );
};

export const useResponderAuth = (): ResponderAuthContextValue => {
  const context = useContext(ResponderAuthContext);
  if (!context) {
    throw new Error('useResponderAuth must be used within a ResponderAuthProvider');
  }
  return context;
};
