import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ConnectivityBanner } from '../../../components/common/ConnectivityBanner';
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import { VERIFICATION_STATUS_METADATA } from '../../../types/responder';
import { useResponderAuth } from '../../../context/ResponderAuthContext';
import { IncomingOfferModal } from '../offer/IncomingOfferModal';

interface ResponderDashboardProps {
  onNavigateProfile: () => void;
  onNavigateActiveJourney: () => void;
  onSwitchToPatientPortal: () => void;
}

export const ResponderDashboardScreen: React.FC<ResponderDashboardProps> = ({
  onNavigateProfile,
  onNavigateActiveJourney,
  onSwitchToPatientPortal,
}) => {
  const {
    responder,
    availability,
    activeOffer,
    activeJourney,
    stats,
    toggleAvailability,
    acceptOffer,
    declineOffer,
    triggerMockOffer,
  } = useResponderAuth();

  const [toggling, setToggling] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  if (!responder) return null;

  const verificationMeta = VERIFICATION_STATUS_METADATA[responder.verificationStatus];
  const isOnline = availability === 'ONLINE';

  const handleToggle = async () => {
    setToggleError(null);
    setToggling(true);
    try {
      await toggleAvailability();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not change availability';
      setToggleError(msg);
    } finally {
      setToggling(false);
    }
  };

  const handleTriggerSimulatedOffer = async () => {
    try {
      await triggerMockOffer();
      setShowOfferModal(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not generate offer';
      setToggleError(msg);
    }
  };

  return (
    <View style={styles.screen}>
      <ConnectivityBanner isMockMode={true} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* DRIVER WELCOME HEADER */}
        <View style={styles.topHeader}>
          <View style={styles.avatarWrapper}>
            <Text style={styles.avatarEmoji}>
              {responder.vehicle.vehicleType === 'MOTORCYCLE' ? '🏍️' : '🚕'}
            </Text>
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.portalTagRow}>
              <Text style={styles.portalTag}>RESPONDER PORTAL</Text>
              <View
                style={[
                  styles.verificationMiniTag,
                  { backgroundColor: verificationMeta.badgeColor + '20', borderColor: verificationMeta.badgeColor },
                ]}
              >
                <Text style={[styles.verificationMiniText, { color: verificationMeta.badgeColor }]}>
                  {responder.verificationStatus}
                </Text>
              </View>
            </View>

            <Text style={styles.responderName}>{responder.fullName}</Text>
            <Text style={styles.vehicleSubtitle}>
              {responder.vehicle.makeModel} • {responder.vehicle.licensePlate}
            </Text>
          </View>

          <TouchableOpacity onPress={onNavigateProfile} style={styles.profileBadge} activeOpacity={0.7}>
            <Text style={styles.profileBadgeText}>⚙️ Account</Text>
          </TouchableOpacity>
        </View>

        {/* VERIFICATION STATUS NOTICE (If not verified) */}
        {responder.verificationStatus !== 'VERIFIED' ? (
          <TouchableOpacity
            onPress={onNavigateProfile}
            activeOpacity={0.85}
            style={styles.verificationNoticeCard}
          >
            <View style={styles.verificationHeader}>
              <Text style={styles.verificationIcon}>⚠️</Text>
              <Text style={styles.verificationTitle}>{verificationMeta.label}</Text>
            </View>
            <Text style={styles.verificationDescription}>
              {verificationMeta.description} Unverified responders cannot toggle online or receive real emergency requests. Tap to view requirements.
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* ACTIVE JOURNEY RESUME BANNER */}
        {activeJourney ? (
          <TouchableOpacity
            onPress={onNavigateActiveJourney}
            activeOpacity={0.85}
            style={styles.activeJourneyBanner}
          >
            <View style={styles.activeJourneyHeader}>
              <View style={styles.activeJourneyPill}>
                <View style={styles.activePulseDot} />
                <Text style={styles.activeJourneyTitle}>ACTIVE EMERGENCY JOURNEY</Text>
              </View>
              <StatusBadge state={activeJourney.status} />
            </View>
            <Text style={styles.activeJourneyPatient}>
              Passenger: {activeJourney.patientName} • {activeJourney.location.villageCommunity}
            </Text>
            <Text style={styles.activeJourneySub}>
              Destination: {activeJourney.destinationFacility?.name || 'Maternity Center'} ➔ Tap to open route navigation
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* TOGGLE ERROR BANNER */}
        {toggleError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {toggleError}</Text>
          </View>
        ) : null}

        {/* AVAILABILITY TOGGLE CONTROL */}
        <Card style={[styles.availabilityCard, isOnline ? styles.availOnline : styles.availOffline]}>
          <View style={styles.availHeader}>
            <View style={styles.availStatusRow}>
              <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
              <View>
                <Text style={[styles.availStatusTitle, isOnline ? styles.textOnline : styles.textOffline]}>
                  {isOnline ? 'ONLINE • AVAILABLE FOR DISPATCH' : 'OFFLINE • OFF DUTY'}
                </Text>
                <Text style={styles.availStatusSub}>
                  {isOnline
                    ? 'Active in RideRoute emergency transport network'
                    : 'Not receiving emergency transport offers'}
                </Text>
              </View>
            </View>

            {toggling ? (
              <ActivityIndicator color={isOnline ? colors.semantic.emerald : colors.neutral.textSecondary} size="small" />
            ) : null}
          </View>

          <Text style={styles.availDescription}>
            {isOnline
              ? 'Your vehicle is visible to maternal emergency dispatchers. Keep your phone nearby and maintain road-safe focus.'
              : 'Switch online when your vehicle is road-ready and you are available to coordinate maternal healthcare transportation.'}
          </Text>

          <TouchableOpacity
            onPress={handleToggle}
            disabled={toggling || responder.verificationStatus !== 'VERIFIED'}
            style={[
              styles.toggleBtn,
              isOnline ? styles.toggleBtnOnline : styles.toggleBtnOffline,
              responder.verificationStatus !== 'VERIFIED' && styles.toggleDisabled,
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleBtnText, isOnline ? styles.toggleBtnTextOnline : styles.toggleBtnTextOffline]}>
              {isOnline ? 'Go Offline (End Shift)' : 'Go Online (Start Shift)'}
            </Text>
          </TouchableOpacity>

          {responder.verificationStatus !== 'VERIFIED' ? (
            <Text style={styles.unverifiedNote}>
              * Document verification required before you can go online and receive dispatches.
            </Text>
          ) : null}
        </Card>

        {/* INCOMING OFFER CALLOUT (If pending offer exists) */}
        {activeOffer ? (
          <TouchableOpacity
            onPress={() => setShowOfferModal(true)}
            activeOpacity={0.85}
            style={styles.pendingOfferCard}
          >
            <View style={styles.offerCardHeader}>
              <View style={styles.offerPill}>
                <View style={styles.activePulseDot} />
                <Text style={styles.offerAlertBadge}>NEW EMERGENCY OFFER WAITING</Text>
              </View>
              <Text style={styles.offerDistance}>
                {activeOffer.estimatedDistanceKm || 2.1} km away
              </Text>
            </View>
            <Text style={styles.offerPickup}>
              Pickup: {activeOffer.pickupLocation.villageCommunity}
            </Text>
            {activeOffer.pickupLocation.landmark ? (
              <Text style={styles.offerLandmark}>
                Landmark: {activeOffer.pickupLocation.landmark}
              </Text>
            ) : null}
            <Text style={styles.offerActionPrompt}>
              Review emergency details and accept / decline ➔
            </Text>
          </TouchableOpacity>
        ) : isOnline && !activeJourney ? (
          /* EMPTY STATE WHEN ONLINE & WAITING */
          <Card style={styles.waitingCard}>
            <View style={styles.radarVisual}>
              <View style={styles.radarRingOuter}>
                <View style={styles.radarRingInner}>
                  <Text style={styles.waitingIcon}>📡</Text>
                </View>
              </View>
            </View>
            <Text style={styles.waitingTitle}>Listening for Emergency Requests</Text>
            <Text style={styles.waitingSubtitle}>
              You are on standby in the <Text style={styles.highlightText}>{responder.communityBase || 'Karu / Nyanya'}</Text> maternal dispatch corridor. An emergency offer alert will sound as soon as a mother in your vicinity needs transport.
            </Text>
            <View style={styles.waitingPill}>
              <Text style={styles.waitingPillText}>✓ GPS Location Active • Dispatch Radius: ~5km</Text>
            </View>
          </Card>
        ) : !isOnline && !activeJourney ? (
          /* EMPTY STATE WHEN OFFLINE */
          <Card style={styles.offlineCard}>
            <Text style={styles.offlineIcon}>🌙</Text>
            <Text style={styles.offlineTitle}>You Are Currently Offline</Text>
            <Text style={styles.offlineSubtitle}>
              When you are ready to receive urgent obstetric ride requests, toggle your status to <Text style={styles.highlightText}>Go Online</Text> above.
            </Text>
          </Card>
        ) : null}

        {/* PERFORMANCE & STATS — CLEARLY LABELED AS SIMULATED DATA */}
        <Card style={styles.statsCard}>
          <View style={styles.statsHeaderRow}>
            <Text style={styles.cardHeading}>Service Summary</Text>
            <View style={styles.simulatedBadge}>
              <Text style={styles.simulatedBadgeText}>Simulated Dev Data</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.completedTripsToday ?? 0}</Text>
              <Text style={styles.statLabel}>Trips Today</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.totalCompletedTrips ?? responder.completedTripsCount}</Text>
              <Text style={styles.statLabel}>Lifetime Rides</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>⭐ {responder.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Driver Rating</Text>
            </View>
          </View>
          <Text style={styles.statsNote}>
            * Trip statistics are simulated development representations. Live statistics will synchronize with Developer 2's Python backend.
          </Text>
        </Card>

        {/* VEHICLE DETAILS CARD */}
        <Card style={styles.vehicleCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeading}>Registered Transport Vehicle</Text>
            <Text style={styles.verifiedTag}>
              {responder.vehicle.insuranceValid ? '✓ Insurance Active' : 'Pending'}
            </Text>
          </View>
          <Text style={styles.vehicleName}>
            {responder.vehicle.vehicleType === 'MOTORCYCLE' ? '🏍️ Motorcycle' : '🚕 Taxi'} •{' '}
            {responder.vehicle.makeModel}
          </Text>
          <Text style={styles.vehicleMeta}>
            Plate: {responder.vehicle.licensePlate} • Color: {responder.vehicle.color}
          </Text>
          <Text style={styles.vehicleLicense}>
            Driver License: {responder.driverLicenseNumber}
          </Text>
        </Card>

        {/* SAFETY & RESPONSIBILITY GUIDELINES */}
        <SafetyBanner />

        {/* DEVELOPER SIMULATION CONTROLS */}
        <View style={styles.devSimCard}>
          <View style={styles.devSimHeaderRow}>
            <Text style={styles.devSimTitle}>🛠️ Developer / Reviewer Testing Tool</Text>
            <View style={styles.devTag}>
              <Text style={styles.devTagText}>Dev Only</Text>
            </View>
          </View>
          <Text style={styles.devSimSub}>
            Simulate Developer 2's Python backend dispatch engine broadcasting a maternal emergency offer:
          </Text>
          <Button
            title="[SIMULATE] Trigger Incoming Emergency Offer"
            variant="secondary"
            size="md"
            onPress={handleTriggerSimulatedOffer}
          />
        </View>

        {/* SWITCH PORTAL LINK */}
        <View style={styles.switchWrapper}>
          <TouchableOpacity onPress={onSwitchToPatientPortal} style={styles.switchBtn}>
            <Text style={styles.switchBtnText}>➔ Switch to Patient Mobile Portal</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* INCOMING OFFER MODAL */}
      <IncomingOfferModal
        visible={showOfferModal || !!activeOffer}
        offer={activeOffer}
        onAccept={async (offerId) => {
          await acceptOffer(offerId);
          setShowOfferModal(false);
          onNavigateActiveJourney();
        }}
        onDecline={async (offerId) => {
          await declineOffer(offerId);
          setShowOfferModal(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.neutral.white,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  avatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.healthcare.light,
    borderColor: colors.healthcare.border,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarEmoji: {
    fontSize: 26,
  },
  headerInfo: {
    flex: 1,
  },
  portalTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  portalTag: {
    ...typography.label,
    fontSize: 9,
    color: colors.healthcare.primary,
    letterSpacing: 1,
  },
  verificationMiniTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  verificationMiniText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '800',
  },
  responderName: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    fontWeight: '800',
  },
  vehicleSubtitle: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginTop: 1,
  },
  profileBadge: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 4,
    backgroundColor: colors.neutral.surfaceAlt,
    borderColor: colors.neutral.borderStrong,
    borderWidth: 1,
    borderRadius: borderRadius.md,
  },
  profileBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.healthcare.primary,
  },
  verificationNoticeCard: {
    backgroundColor: colors.semantic.amberBg,
    borderColor: colors.semantic.amberBorder,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  verificationIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  verificationTitle: {
    ...typography.bodyLarge,
    fontWeight: '800',
    color: colors.semantic.amber,
  },
  verificationDescription: {
    ...typography.caption,
    color: colors.neutral.textPrimary,
    lineHeight: 18,
  },
  activeJourneyBanner: {
    backgroundColor: colors.emergency.light,
    borderColor: colors.emergency.primary,
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.emergency.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  activeJourneyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeJourneyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.emergency.primary,
  },
  activeJourneyTitle: {
    ...typography.caption,
    fontWeight: '900',
    color: colors.emergency.primary,
    letterSpacing: 0.5,
  },
  activeJourneyPatient: {
    ...typography.bodyLarge,
    fontWeight: '800',
    color: colors.neutral.textPrimary,
    marginBottom: 2,
  },
  activeJourneySub: {
    ...typography.caption,
    color: colors.emergency.dark,
    fontWeight: '600',
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
  },
  availabilityCard: {
    marginBottom: spacing.md,
    borderWidth: 2,
  },
  availOnline: {
    borderColor: colors.semantic.emeraldBorder,
    backgroundColor: colors.semantic.emeraldBg,
  },
  availOffline: {
    borderColor: colors.neutral.borderStrong,
    backgroundColor: colors.neutral.white,
  },
  availHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  availStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
  },
  statusDotOnline: {
    backgroundColor: colors.semantic.emerald,
  },
  statusDotOffline: {
    backgroundColor: colors.neutral.textMuted,
  },
  availStatusTitle: {
    ...typography.label,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  availStatusSub: {
    ...typography.caption,
    fontSize: 11,
    color: colors.neutral.textSecondary,
    marginTop: 1,
  },
  textOnline: {
    color: colors.semantic.emerald,
  },
  textOffline: {
    color: colors.neutral.textSecondary,
  },
  availDescription: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  toggleBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  toggleBtnOnline: {
    backgroundColor: colors.neutral.white,
    borderColor: colors.semantic.emeraldBorder,
    borderWidth: 1.5,
  },
  toggleBtnOffline: {
    backgroundColor: colors.healthcare.primary,
  },
  toggleBtnText: {
    ...typography.bodyLarge,
    fontWeight: '800',
  },
  toggleBtnTextOnline: {
    color: colors.semantic.emerald,
  },
  toggleBtnTextOffline: {
    color: colors.neutral.white,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  unverifiedNote: {
    ...typography.caption,
    color: colors.semantic.amber,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  pendingOfferCard: {
    backgroundColor: colors.emergency.light,
    borderColor: colors.emergency.primary,
    borderWidth: 2,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.emergency.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  offerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  offerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerAlertBadge: {
    ...typography.label,
    fontSize: 11,
    fontWeight: '900',
    color: colors.emergency.primary,
  },
  offerDistance: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.emergency.dark,
  },
  offerPickup: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginTop: 2,
  },
  offerLandmark: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  offerActionPrompt: {
    ...typography.caption,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  waitingCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  radarVisual: {
    marginBottom: spacing.md,
  },
  radarRingOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.semantic.emeraldBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.semantic.emeraldBorder,
  },
  radarRingInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.semantic.emeraldBorder,
  },
  waitingIcon: {
    fontSize: 26,
  },
  waitingTitle: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginBottom: 6,
  },
  waitingSubtitle: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  highlightText: {
    fontWeight: '700',
    color: colors.healthcare.primary,
  },
  waitingPill: {
    backgroundColor: colors.semantic.emeraldBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.semantic.emeraldBorder,
  },
  waitingPillText: {
    ...typography.caption,
    color: colors.semantic.emerald,
    fontWeight: '700',
    fontSize: 11,
  },
  offlineCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  offlineIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  offlineTitle: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  offlineSubtitle: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeading: {
    ...typography.label,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
  },
  simulatedBadge: {
    backgroundColor: colors.neutral.surfaceAlt,
    borderColor: colors.neutral.borderStrong,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  simulatedBadgeText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '800',
    color: colors.neutral.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.neutral.border,
  },
  statsNote: {
    ...typography.caption,
    fontSize: 10,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  vehicleCard: {
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  verifiedTag: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.semantic.emerald,
  },
  vehicleName: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginTop: 2,
  },
  vehicleMeta: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  vehicleLicense: {
    ...typography.caption,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  devSimCard: {
    backgroundColor: colors.neutral.white,
    borderColor: colors.healthcare.border,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  devSimHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  devSimTitle: {
    ...typography.label,
    color: colors.healthcare.dark,
    fontWeight: '800',
  },
  devTag: {
    backgroundColor: colors.healthcare.light,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  devTagText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '800',
    color: colors.healthcare.dark,
  },
  devSimSub: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  switchWrapper: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  switchBtn: {
    padding: spacing.sm,
  },
  switchBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.healthcare.primary,
  },
});
