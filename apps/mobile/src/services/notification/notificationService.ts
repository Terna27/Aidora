/**
 * RideRoute Notification Service
 *
 * Provides audible and haptic feedback for emergency dispatches, state transitions,
 * and background status updates. Responders need immediate attention alerting
 * during high-urgency maternal dispatches without inducing panic.
 *
 * Safe across React Native (Android/iOS), Expo Web, and headless test runners.
 */

import { EmergencyOffer } from '../../types/responder';
import { EmergencyState } from '../../types/emergency';

// Safe haptic trigger helper compatible with React Native, Web, and Node.js test runners
const triggerHaptic = (pattern: number | number[]) => {
  try {
    // Dynamic check for React Native in native runtime
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const RN = require('react-native');
    if (RN?.Vibration?.vibrate && RN?.Platform?.OS !== 'web') {
      RN.Vibration.vibrate(pattern);
      return;
    }
  } catch {
    // In node environment or web fallback
  }

  // Browser vibration API fallback
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignored in environments where vibration is restricted
    }
  }
};

export interface NotificationEvent {
  type: 'NEW_OFFER' | 'STATE_CHANGE' | 'REASSIGNED' | 'EXPIRED';
  title: string;
  message: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export type NotificationListener = (event: NotificationEvent) => void;

export interface INotificationService {
  notifyOffer(offer: EmergencyOffer): Promise<void>;
  notifyStateChange(state: EmergencyState, message?: string): Promise<void>;
  notifyReassigned(reason?: string): Promise<void>;
  notifyExpired(offerId: string): Promise<void>;
  vibrateUrgent(): void;
  vibrateSubtle(): void;
  subscribe(listener: NotificationListener): () => void;
  getRecentNotifications(): NotificationEvent[];
  clearHistory(): void;
}

export class NotificationService implements INotificationService {
  private listeners: Set<NotificationListener> = new Set();
  private history: NotificationEvent[] = [];

  private emit(event: NotificationEvent) {
    this.history = [event, ...this.history.slice(0, 19)]; // Keep last 20
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn('Notification listener error:', err);
      }
    });
  }

  async notifyOffer(offer: EmergencyOffer): Promise<void> {
    this.vibrateUrgent();
    const event: NotificationEvent = {
      type: 'NEW_OFFER',
      title: '🚨 New Emergency Ride Request',
      message: `Pickup near ${offer.pickupLocation.landmark || offer.pickupLocation.villageCommunity}. Tap to accept.`,
      timestamp: new Date().toISOString(),
      payload: { offerId: offer.id, emergencyId: offer.emergencyId },
    };
    this.emit(event);
  }

  async notifyStateChange(state: EmergencyState, message?: string): Promise<void> {
    this.vibrateSubtle();
    const event: NotificationEvent = {
      type: 'STATE_CHANGE',
      title: 'Emergency Journey Updated',
      message: message || `Status transitioned to ${state}`,
      timestamp: new Date().toISOString(),
      payload: { state },
    };
    this.emit(event);
  }

  async notifyReassigned(reason?: string): Promise<void> {
    this.vibrateSubtle();
    const event: NotificationEvent = {
      type: 'REASSIGNED',
      title: 'Dispatch Update',
      message: reason || 'Ride has been reassigned to another responder or alternate dispatch.',
      timestamp: new Date().toISOString(),
    };
    this.emit(event);
  }

  async notifyExpired(offerId: string): Promise<void> {
    const event: NotificationEvent = {
      type: 'EXPIRED',
      title: 'Offer Expired',
      message: 'The acceptance window for this emergency request has closed.',
      timestamp: new Date().toISOString(),
      payload: { offerId },
    };
    this.emit(event);
  }

  vibrateUrgent(): void {
    triggerHaptic([0, 400, 200, 400]);
  }

  vibrateSubtle(): void {
    triggerHaptic(150);
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getRecentNotifications(): NotificationEvent[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const notificationService = new NotificationService();
