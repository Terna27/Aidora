import React, { useState, useEffect } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { EmergencyOffer } from '../../../types/responder';

interface IncomingOfferModalProps {
  visible: boolean;
  offer: EmergencyOffer | null;
  onAccept: (offerId: string) => Promise<void>;
  onDecline: (offerId: string) => Promise<void>;
}

export const IncomingOfferModal: React.FC<IncomingOfferModalProps> = ({
  visible,
  offer,
  onAccept,
  onDecline,
}) => {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(45);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (visible && offer) {
      setErrorMessage(null);
      setIsExpired(false);

      const targetExpiry = new Date(offer.expiresAt).getTime();
      const calculateRemaining = () => Math.max(0, Math.floor((targetExpiry - Date.now()) / 1000));

      const initial = calculateRemaining();
      setSecondsRemaining(initial > 0 ? initial : 0);
      if (initial <= 0) {
        setIsExpired(true);
      }

      const timer = setInterval(() => {
        const remaining = calculateRemaining();
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          setIsExpired(true);
          clearInterval(timer);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [visible, offer]);

  if (!offer) return null;

  const handleAcceptPress = async () => {
    setErrorMessage(null);
    if (isExpired || secondsRemaining <= 0) {
      setErrorMessage('This emergency transportation offer has expired and can no longer be accepted.');
      return;
    }

    setAccepting(true);
    try {
      await onAccept(offer.id);
    } catch (err: unknown) {
      const errCode = (err as any)?.code;
      if (errCode === 'OFFER_EXPIRED') {
        setIsExpired(true);
        setErrorMessage('This emergency request expired before acceptance. Dispatch has alerted alternative drivers.');
      } else if (errCode === 'OFFER_UNAVAILABLE') {
        setErrorMessage('Another verified driver accepted this emergency dispatch in your sector.');
      } else if (errCode === 'ACTIVE_JOURNEY_EXISTS') {
        setErrorMessage('You already have an active emergency transport journey in progress.');
      } else if (errCode === 'NETWORK_TIMEOUT') {
        setErrorMessage('Network connection lost. Please check your data connection and tap to retry.');
      } else {
        const msg = err instanceof Error ? err.message : 'Could not accept emergency offer. Please retry.';
        setErrorMessage(msg);
      }
    } finally {
      setAccepting(false);
    }
  };

  const handleDeclinePress = async () => {
    setErrorMessage(null);
    setDeclining(true);
    try {
      await onDecline(offer.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Decline action failed';
      setErrorMessage(msg);
    } finally {
      setDeclining(false);
    }
  };

  // Format request time
  const requestTimeDisplay = offer.requestedAt
    ? new Date(offer.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => onDecline(offer.id)}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* TOP URGENCY HEADER & TIMER */}
          <View style={styles.headerRow}>
            <View style={styles.urgencyBadgeWrapper}>
              <View style={[styles.pulseDot, isExpired && styles.pulseDotExpired]} />
              <Text style={[styles.headerTitle, isExpired && styles.headerTitleExpired]}>
                {isExpired ? 'OFFER EXPIRED' : 'INCOMING EMERGENCY DISPATCH'}
              </Text>
            </View>

            <View style={[styles.timerBadge, isExpired && styles.timerBadgeExpired]}>
              <Text style={[styles.timerText, isExpired && styles.timerTextExpired]}>
                {isExpired ? '0s (Expired)' : `${secondsRemaining}s`}
              </Text>
            </View>
          </View>

          {/* TRANSPORT CATEGORY & TIME */}
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>🚨 Maternal Obstetric Emergency</Text>
            </View>
            <Text style={styles.requestTimeText}>Requested at {requestTimeDisplay}</Text>
          </View>

          {/* ERROR / NOTICE BANNER */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          ) : null}

          {/* LOCATION & DESTINATION DETAILS CONTAINER */}
          <View style={styles.detailsBox}>
            {/* PICKUP LOCATION */}
            <View style={styles.detailRow}>
              <View style={styles.iconCircle}>
                <Text style={styles.detailIcon}>📍</Text>
              </View>
              <View style={styles.detailTextWrapper}>
                <Text style={styles.detailLabel}>PATIENT PICKUP LOCATION</Text>
                <Text style={styles.pickupCommunity}>
                  {offer.pickupLocation.villageCommunity || 'Village/Community Area'}
                </Text>

                {offer.pickupLocation.landmark ? (
                  <Text style={styles.pickupLandmark}>
                    Landmark: {offer.pickupLocation.landmark}
                  </Text>
                ) : null}

                {offer.pickupLocation.directionsNotes ? (
                  <Text style={styles.pickupDirections}>
                    Directions: "{offer.pickupLocation.directionsNotes}"
                  </Text>
                ) : null}
              </View>
            </View>

            {/* METRICS ROW (DISTANCE, ETA, ACCURACY) */}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>
                  {offer.pickupLocation.coords && offer.estimatedDistanceKm
                    ? `${offer.estimatedDistanceKm} km`
                    : offer.estimatedDistanceKm
                    ? `~${offer.estimatedDistanceKm} km`
                    : 'Landmark'}
                </Text>
                <Text style={styles.metricLbl}>EST. DISTANCE</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>
                  {offer.estimatedPickupMins ? `~${offer.estimatedPickupMins} mins` : '~5 mins'}
                </Text>
                <Text style={styles.metricLbl}>APPROX. ETA</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>
                  {offer.pickupLocation.source === 'GPS' ? 'GPS Lock' : 'Landmark'}
                </Text>
                <Text style={styles.metricLbl}>LOCATION MODE</Text>
              </View>
            </View>

            {/* DESTINATION FACILITY */}
            {offer.destinationFacility ? (
              <View style={styles.destinationBox}>
                <View style={styles.destinationHeaderRow}>
                  <Text style={styles.destinationLabel}>AUTHORIZED DESTINATION CLINIC</Text>
                  <Text style={styles.hospitalTag}>Maternity Center</Text>
                </View>
                <Text style={styles.destinationName}>
                  🏥 {offer.destinationFacility.name}
                </Text>
                <Text style={styles.destinationAddress}>
                  {offer.destinationFacility.address}, {offer.destinationFacility.community}
                </Text>
              </View>
            ) : null}
          </View>

          {/* PRIVACY & SAFETY BOUNDARY NOTICE */}
          <View style={styles.safetyNoticeRow}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.privacyNotice}>
              Patient identity & contact phone are revealed upon acceptance. Ordinary drivers coordinate transportation; never attempt medical treatment.
            </Text>
          </View>

          {/* ACTION BUTTONS */}
          <View style={styles.actionsContainer}>
            {!isExpired ? (
              <Button
                title={accepting ? 'Connecting to Dispatch...' : 'ACCEPT EMERGENCY RIDE'}
                variant="emergency"
                size="lg"
                loading={accepting}
                disabled={declining || accepting}
                onPress={handleAcceptPress}
                style={styles.acceptBtn}
              />
            ) : (
              <Button
                title="Dismiss Expired Request"
                variant="outline"
                size="lg"
                onPress={() => onDecline(offer.id)}
              />
            )}

            {!isExpired ? (
              <Button
                title="Decline Offer"
                variant="outline"
                size="md"
                loading={declining}
                disabled={accepting}
                onPress={handleDeclinePress}
              />
            ) : null}
          </View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  urgencyBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.emergency.primary,
    marginRight: 8,
  },
  pulseDotExpired: {
    backgroundColor: colors.neutral.textMuted,
  },
  headerTitle: {
    ...typography.label,
    fontSize: 11,
    fontWeight: '900',
    color: colors.emergency.primary,
    letterSpacing: 0.5,
  },
  headerTitleExpired: {
    color: colors.neutral.textSecondary,
  },
  timerBadge: {
    backgroundColor: colors.emergency.light,
    borderColor: colors.emergency.border,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  timerBadgeExpired: {
    backgroundColor: colors.neutral.surfaceAlt,
    borderColor: colors.neutral.border,
  },
  timerText: {
    ...typography.caption,
    fontWeight: '900',
    color: colors.emergency.dark,
    fontSize: 12,
  },
  timerTextExpired: {
    color: colors.neutral.textSecondary,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  categoryBadge: {
    backgroundColor: colors.emergency.light,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.emergency.primary,
  },
  requestTimeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.neutral.textMuted,
  },
  errorBox: {
    backgroundColor: colors.emergency.light,
    borderColor: colors.emergency.border,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.emergency.dark,
    fontWeight: '700',
    lineHeight: 18,
  },
  detailsBox: {
    backgroundColor: colors.neutral.surfaceAlt,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  detailIcon: {
    fontSize: 18,
  },
  detailTextWrapper: {
    flex: 1,
  },
  detailLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.neutral.textMuted,
    letterSpacing: 0.5,
  },
  pickupCommunity: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginTop: 1,
  },
  pickupLandmark: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  pickupDirections: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    ...typography.bodyLarge,
    fontWeight: '800',
    color: colors.neutral.textPrimary,
  },
  metricLbl: {
    ...typography.caption,
    fontSize: 9,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.neutral.border,
  },
  destinationBox: {
    backgroundColor: colors.healthcare.light,
    borderColor: colors.healthcare.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  destinationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  destinationLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.healthcare.dark,
    letterSpacing: 0.5,
  },
  hospitalTag: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '800',
    color: colors.healthcare.dark,
  },
  destinationName: {
    ...typography.body,
    fontWeight: '800',
    color: colors.healthcare.dark,
    marginTop: 1,
  },
  destinationAddress: {
    ...typography.caption,
    color: colors.healthcare.dark,
    marginTop: 1,
  },
  safetyNoticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.neutral.surfaceAlt,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: 6,
  },
  lockIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  privacyNotice: {
    ...typography.caption,
    fontSize: 10,
    color: colors.neutral.textSecondary,
    lineHeight: 15,
    flex: 1,
  },
  actionsContainer: {
    gap: spacing.sm,
  },
  acceptBtn: {
    backgroundColor: colors.semantic.emerald,
    shadowColor: colors.semantic.emerald,
  },
});
