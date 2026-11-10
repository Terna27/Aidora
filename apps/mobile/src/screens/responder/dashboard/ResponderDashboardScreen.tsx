import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { StatusBadge } from '../../../components/common/StatusBadge';
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
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  if (!responder) return null;

  const verificationMeta = VERIFICATION_STATUS_METADATA[responder.verificationStatus] || {
    label: responder.verificationStatus,
    badgeColor: '#D97706',
    description: 'Document verification status.',
  };

  const isOnline = availability === 'ONLINE';
  const isVerified = responder.verificationStatus === 'VERIFIED';

  const handleToggle = async () => {
    setToggleError(null);
    if (!isVerified) {
      setToggleError('Document verification required before you can go online. Please check your verification checklist in Account.');
      return;
    }

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
      {/* BACKGROUND CONCENTRIC RADAR RINGS RADIATING BEHIND DRIVER AVATAR */}
      <View style={styles.radarContainer} pointerEvents="none">
        <View style={[styles.radarRing, styles.radarRing4]} />
        <View style={[styles.radarRing, styles.radarRing3]} />
        <View style={[styles.radarRing, styles.radarRing2]} />
        <View style={[styles.radarRing, styles.radarRing1]} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* DRIVER WELCOME HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.profileSection}
            onPress={onNavigateProfile}
            activeOpacity={0.8}
            accessibilityLabel="Driver Profile and Verification Status"
          >
            <View style={styles.avatarWrapper}>
              <Text style={styles.avatarGlyph}>
                {responder.vehicle.vehicleType === 'MOTORCYCLE' ? '🏍️' : '🚕'}
              </Text>
            </View>

            <View style={styles.headerInfo}>
              <View style={styles.driverGreetingRow}>
                <Text style={styles.greetingPrefix}>Driver </Text>
                <Text style={styles.driverName} numberOfLines={1}>
                  {responder.fullName.split(' ')[0]}
                </Text>
              </View>

              <View style={styles.badgesRow}>
                {/* VERIFICATION BADGE PILL */}
                <View
                  style={[
                    styles.verificationPill,
                    {
                      backgroundColor:
                        responder.verificationStatus === 'VERIFIED'
                          ? '#ECFDF5'
                          : responder.verificationStatus === 'PENDING'
                          ? '#FEF3C7'
                          : '#FEE2E2',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.verificationDot,
                      {
                        backgroundColor:
                          responder.verificationStatus === 'VERIFIED'
                            ? '#059669'
                            : responder.verificationStatus === 'PENDING'
                            ? '#D97706'
                            : '#DC2626',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.verificationText,
                      {
                        color:
                          responder.verificationStatus === 'VERIFIED'
                            ? '#059669'
                            : responder.verificationStatus === 'PENDING'
                            ? '#B45309'
                            : '#DC2626',
                      },
                    ]}
                  >
                    {verificationMeta.label}
                  </Text>
                </View>

                {/* VEHICLE TYPE PILL */}
                <View style={styles.vehicleTypePill}>
                  <Text style={styles.vehicleTypeText}>
                    {responder.vehicle.vehicleType === 'MOTORCYCLE' ? 'Motorcycle' : 'Taxi'}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            {/* NOTIFICATION BUTTON */}
            <TouchableOpacity
              style={styles.circleActionButton}
              onPress={() => setShowNotificationModal(true)}
              activeOpacity={0.7}
              accessibilityLabel="Notifications"
            >
              <View style={styles.bellIconWrapper}>
                <View style={styles.bellDome} />
                <View style={styles.bellRim} />
                <View style={styles.bellClapper} />
              </View>
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>1</Text>
              </View>
            </TouchableOpacity>

            {/* SETTINGS / PROFILE BUTTON */}
            <TouchableOpacity
              style={styles.circleActionButton}
              onPress={onNavigateProfile}
              activeOpacity={0.7}
              accessibilityLabel="Account and Vehicle Settings"
            >
              <View style={styles.cogIconWrapper}>
                <View style={styles.cogCenter} />
                <View style={[styles.cogTooth, styles.cogToothV]} />
                <View style={[styles.cogTooth, styles.cogToothH]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* VERIFICATION STATUS NOTICE (If unverified/pending/suspended) */}
        {!isVerified ? (
          <TouchableOpacity
            onPress={onNavigateProfile}
            activeOpacity={0.85}
            style={[
              styles.verificationNoticeCard,
              responder.verificationStatus === 'SUSPENDED'
                ? styles.noticeCardSuspended
                : styles.noticeCardPending,
            ]}
          >
            <View style={styles.noticeHeader}>
              <Text style={styles.noticeIcon}>
                {responder.verificationStatus === 'SUSPENDED' ? '🚫' : '⏳'}
              </Text>
              <Text
                style={[
                  styles.noticeTitle,
                  responder.verificationStatus === 'SUSPENDED'
                    ? styles.noticeTitleSuspended
                    : styles.noticeTitlePending,
                ]}
              >
                {responder.verificationStatus === 'SUSPENDED'
                  ? 'Account Under Administrative Review'
                  : 'Document Verification Required'}
              </Text>
            </View>
            <Text style={styles.noticeBody}>
              {responder.verificationStatus === 'SUSPENDED'
                ? 'Your responder account has been suspended pending document compliance. Tap to contact dispatch operations.'
                : 'Your driver license and vehicle papers are under administrative review. Unverified drivers cannot go online or accept emergency dispatches.'}
            </Text>
            <Text style={styles.noticeAction}>Tap to view verification checklist ➔</Text>
          </TouchableOpacity>
        ) : null}

        {/* ACTIVE JOURNEY RESUME BANNER */}
        {activeJourney ? (
          <TouchableOpacity
            onPress={onNavigateActiveJourney}
            activeOpacity={0.88}
            style={styles.activeJourneyCard}
            accessibilityLabel="Active Emergency Journey In Progress. Tap to open route."
          >
            <View style={styles.activeJourneyHeader}>
              <View style={styles.activeJourneyPill}>
                <View style={styles.activePulseDot} />
                <Text style={styles.activeJourneyTitle}>ACTIVE EMERGENCY JOURNEY</Text>
              </View>
              <StatusBadge state={activeJourney.status} />
            </View>

            <Text style={styles.activePassengerName}>
              Passenger: {activeJourney.patientName}
            </Text>
            <Text style={styles.activePickupLoc}>
              📍 Pickup: {activeJourney.location.villageCommunity}
              {activeJourney.location.landmark ? ` (${activeJourney.location.landmark})` : ''}
            </Text>
            <Text style={styles.activeDestLoc}>
              🏥 Clinic: {activeJourney.destinationFacility?.name || 'Maternal Health Center'}
            </Text>

            <View style={styles.resumeJourneyBtn}>
              <Text style={styles.resumeJourneyText}>Resume Trip Navigation ➔</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* TOGGLE ERROR BANNER */}
        {toggleError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {toggleError}</Text>
          </View>
        ) : null}

        {/* LARGE AVAILABILITY CONTROL CARD */}
        <Card
          style={[
            styles.availabilityCard,
            isOnline ? styles.availOnlineCard : styles.availOfflineCard,
          ]}
        >
          <View style={styles.availHeaderRow}>
            <View style={styles.availHeaderLeft}>
              <View
                style={[
                  styles.availStatusDot,
                  isOnline ? styles.availStatusDotOnline : styles.availStatusDotOffline,
                ]}
              />
              <View>
                <Text
                  style={[
                    styles.availStatusTitle,
                    isOnline ? styles.availTextOnline : styles.availTextOffline,
                  ]}
                >
                  {isOnline ? 'ONLINE • AVAILABLE FOR DISPATCH' : 'OFFLINE • OFF DUTY'}
                </Text>
                <Text style={styles.availStatusSub}>
                  {isOnline
                    ? 'Active in local emergency maternal transport network'
                    : 'Not currently receiving emergency ride offers'}
                </Text>
              </View>
            </View>

            {toggling && (
              <ActivityIndicator
                color={isOnline ? '#059669' : '#0D5C96'}
                size="small"
              />
            )}
          </View>

          <Text style={styles.availDescription}>
            {isOnline
              ? 'Your vehicle is visible to maternal emergency coordinators. Keep your phone mounted safely and maintain road focus.'
              : 'Switch online when your vehicle is road-ready, fueled, and you are prepared to coordinate rapid obstetric clinic transport.'}
          </Text>

          <TouchableOpacity
            onPress={handleToggle}
            disabled={toggling || !isVerified}
            style={[
              styles.toggleBtn,
              isOnline ? styles.toggleBtnOnline : styles.toggleBtnOffline,
              !isVerified && styles.toggleDisabled,
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              isOnline ? 'Go Offline: End Shift' : 'Go Online: Start Shift'
            }
          >
            <Text
              style={[
                styles.toggleBtnText,
                isOnline ? styles.toggleBtnTextOnline : styles.toggleBtnTextOffline,
              ]}
            >
              {isOnline ? 'Go Offline (End Shift)' : 'Go Online (Start Shift)'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* INCOMING OFFER CALLOUT (If pending offer exists) */}
        {activeOffer ? (
          <TouchableOpacity
            onPress={() => setShowOfferModal(true)}
            activeOpacity={0.88}
            style={styles.pendingOfferCard}
            accessibilityLabel="New Emergency Transport Offer Waiting. Tap to review."
          >
            <View style={styles.offerCardHeader}>
              <View style={styles.offerPill}>
                <View style={styles.offerPulseDot} />
                <Text style={styles.offerAlertBadge}>NEW EMERGENCY OFFER</Text>
              </View>
              {activeOffer.estimatedDistanceKm ? (
                <Text style={styles.offerDistance}>
                  {activeOffer.estimatedDistanceKm} km away
                </Text>
              ) : null}
            </View>

            <Text style={styles.offerPickup}>
              Pickup: {activeOffer.pickupLocation.villageCommunity}
            </Text>
            {activeOffer.pickupLocation.landmark ? (
              <Text style={styles.offerLandmark}>
                Landmark: {activeOffer.pickupLocation.landmark}
              </Text>
            ) : null}
            {activeOffer.destinationFacility ? (
              <Text style={styles.offerDestination}>
                To: {activeOffer.destinationFacility.name}
              </Text>
            ) : null}

            <View style={styles.reviewOfferBtn}>
              <Text style={styles.reviewOfferText}>Review Emergency Offer ➔</Text>
            </View>
          </TouchableOpacity>
        ) : isOnline && !activeJourney ? (
          /* RADAR LISTENING STANDBY STATE (WHEN ONLINE & WAITING) */
          <Card style={styles.waitingCard}>
            <View style={styles.radarVisualContainer}>
              <View style={styles.radarWaveOuter}>
                <View style={styles.radarWaveMid}>
                  <View style={styles.radarWaveInner}>
                    <Text style={styles.radarCenterIcon}>📡</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.waitingTitle}>Listening for Emergency Requests</Text>
            <Text style={styles.waitingSubtitle}>
              Standby in{' '}
              <Text style={styles.highlightText}>
                {responder.communityBase || 'Karu / Nyanya'}
              </Text>{' '}
              dispatch sector. An emergency offer alert will sound as soon as a mother in your vicinity requires transport.
            </Text>

            <View style={styles.waitingStatusPill}>
              <View style={styles.waitingDot} />
              <Text style={styles.waitingStatusText}>
                GPS Standby Active • Standing by for Local Dispatch Offers
              </Text>
            </View>
          </Card>
        ) : !isOnline && !activeJourney ? (
          /* OFFLINE STATE */
          <Card style={styles.offlineCard}>
            <Text style={styles.offlineIcon}>🌙</Text>
            <Text style={styles.offlineTitle}>You Are Currently Offline</Text>
            <Text style={styles.offlineSubtitle}>
              When you are ready to receive urgent obstetric ride requests, tap{' '}
              <Text style={styles.highlightText}>Go Online</Text> above.
            </Text>
          </Card>
        ) : null}

        {/* PERFORMANCE & STATS — CLEARLY LABELED AS SIMULATED DATA */}
        <Card style={styles.statsCard}>
          <View style={styles.statsHeaderRow}>
            <View style={styles.statsHeaderLeft}>
              <Text style={styles.statsCardIcon}>📊</Text>
              <Text style={styles.cardHeading}>Service Summary</Text>
            </View>
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
              <Text style={styles.statValue}>
                {stats?.totalCompletedTrips ?? responder.completedTripsCount}
              </Text>
              <Text style={styles.statLabel}>Lifetime Rides</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>⭐ {responder.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Driver Rating</Text>
            </View>
          </View>
          <Text style={styles.statsNote}>
            * Statistics are simulated representations during development. Synchronizes with Python dispatch engine.
          </Text>
        </Card>

        {/* REGISTERED VEHICLE DETAILS CARD */}
        <Card style={styles.vehicleCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.statsHeaderLeft}>
              <Text style={styles.statsCardIcon}>
                {responder.vehicle.vehicleType === 'MOTORCYCLE' ? '🏍️' : '🚕'}
              </Text>
              <Text style={styles.cardHeading}>Registered Vehicle</Text>
            </View>
            <View
              style={[
                styles.insurancePill,
                responder.vehicle.insuranceValid
                  ? styles.insuranceValid
                  : styles.insurancePending,
              ]}
            >
              <Text
                style={[
                  styles.insurancePillText,
                  responder.vehicle.insuranceValid
                    ? styles.insuranceValidText
                    : styles.insurancePendingText,
                ]}
              >
                {responder.vehicle.insuranceValid ? '✓ Insurance Verified' : 'Insurance Pending'}
              </Text>
            </View>
          </View>

          <Text style={styles.vehicleName}>
            {responder.vehicle.makeModel} ({responder.vehicle.color})
          </Text>
          <View style={styles.vehicleDetailsRow}>
            <View style={styles.vehiclePill}>
              <Text style={styles.vehiclePillLabel}>PLATE:</Text>
              <Text style={styles.vehiclePillVal}>{responder.vehicle.licensePlate}</Text>
            </View>
            <View style={styles.vehiclePill}>
              <Text style={styles.vehiclePillLabel}>LICENSE:</Text>
              <Text style={styles.vehiclePillVal}>{responder.driverLicenseNumber}</Text>
            </View>
          </View>
        </Card>

        {/* SAFETY & DRIVING RESPONSIBILITY GUIDELINES */}
        <SafetyBanner />

        {/* REVIEWER & DEV TESTING TOOL */}
        <View style={styles.devSimCard}>
          <View style={styles.devSimHeaderRow}>
            <Text style={styles.devSimTitle}>🛠️ Developer Dispatch Simulator</Text>
            <View style={styles.devTag}>
              <Text style={styles.devTagText}>Dev Tool</Text>
            </View>
          </View>
          <Text style={styles.devSimSub}>
            Simulate an emergency dispatch offer broadcast from Developer 2's Python backend:
          </Text>
          <Button
            title="[SIMULATE] Broadcast Incoming Emergency Offer"
            variant="secondary"
            size="md"
            onPress={handleTriggerSimulatedOffer}
          />
        </View>

        {/* SWITCH TO PATIENT PORTAL */}
        <View style={styles.switchWrapper}>
          <TouchableOpacity
            onPress={onSwitchToPatientPortal}
            style={styles.switchBtn}
            activeOpacity={0.7}
          >
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

      {/* NOTIFICATIONS MODAL */}
      <Modal
        visible={showNotificationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalIconBadge}>
              <Text style={{ fontSize: 26 }}>🔔</Text>
            </View>
            <Text style={styles.modalTitle}>Responder Notifications</Text>
            <View style={styles.notificationItem}>
              <Text style={styles.notifItemTitle}>🛡️ Shift Verification Status</Text>
              <Text style={styles.notifItemDesc}>
                {isVerified
                  ? 'Your transport account is verified for active maternal dispatches.'
                  : 'Document review in progress. Complete outstanding items in Account.'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={() => setShowNotificationModal(false)}
            >
              <Text style={styles.modalPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EEF4FA', // Clean light blue-grey matching patient portal
  },
  radarContainer: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: 'rgba(195, 218, 238, 0.45)',
  },
  radarRing1: {
    width: 80,
    height: 80,
    borderColor: 'rgba(180, 210, 235, 0.65)',
  },
  radarRing2: {
    width: 140,
    height: 140,
    borderColor: 'rgba(180, 210, 235, 0.50)',
  },
  radarRing3: {
    width: 200,
    height: 200,
    borderColor: 'rgba(180, 210, 235, 0.35)',
  },
  radarRing4: {
    width: 260,
    height: 260,
    borderColor: 'rgba(180, 210, 235, 0.22)',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 36,
  },

  // TOP HEADER
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 14,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#0D5C96',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarGlyph: {
    fontSize: 22,
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  driverGreetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingPrefix: {
    fontSize: 18,
    fontWeight: '400',
    color: '#0F172A',
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  verificationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verificationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  verificationText: {
    fontSize: 11,
    fontWeight: '700',
  },
  vehicleTypePill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  vehicleTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  bellIconWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDome: {
    width: 13,
    height: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 2,
    borderColor: '#0F172A',
    borderBottomWidth: 0,
  },
  bellRim: {
    width: 16,
    height: 2,
    backgroundColor: '#0F172A',
    borderRadius: 1,
  },
  bellClapper: {
    width: 4,
    height: 3,
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    marginTop: 1,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0D5C96',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cogIconWrapper: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cogCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  cogTooth: {
    position: 'absolute',
    backgroundColor: '#0F172A',
  },
  cogToothV: {
    width: 2,
    height: 16,
  },
  cogToothH: {
    width: 16,
    height: 2,
  },

  // VERIFICATION NOTICE CARD
  verificationNoticeCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  noticeCardPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  noticeCardSuspended: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeIcon: {
    fontSize: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  noticeTitlePending: {
    color: '#B45309',
  },
  noticeTitleSuspended: {
    color: '#DC2626',
  },
  noticeBody: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    lineHeight: 18,
  },
  noticeAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D5C96',
    marginTop: 8,
  },

  // ACTIVE JOURNEY CARD
  activeJourneyCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 2,
    borderColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  activeJourneyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  activeJourneyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 6,
  },
  activeJourneyTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  activePassengerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  activePickupLoc: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
    fontWeight: '500',
  },
  activeDestLoc: {
    fontSize: 13,
    color: '#0D5C96',
    marginTop: 3,
    fontWeight: '600',
  },
  resumeJourneyBtn: {
    marginTop: 12,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  resumeJourneyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ERROR BOX
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },

  // AVAILABILITY CARD
  availabilityCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  availOnlineCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  availOfflineCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  availHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  availStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  availStatusDotOnline: {
    backgroundColor: '#059669',
  },
  availStatusDotOffline: {
    backgroundColor: '#94A3B8',
  },
  availStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  availTextOnline: {
    color: '#059669',
  },
  availTextOffline: {
    color: '#475569',
  },
  availStatusSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  availDescription: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginVertical: 14,
  },
  toggleBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnOnline: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  toggleBtnOffline: {
    backgroundColor: '#0D5C96',
  },
  toggleDisabled: {
    opacity: 0.6,
  },
  toggleBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  toggleBtnTextOnline: {
    color: '#475569',
  },
  toggleBtnTextOffline: {
    color: '#FFFFFF',
  },

  // PENDING OFFER ALERT CARD
  pendingOfferCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  offerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  offerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offerPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginRight: 6,
  },
  offerAlertBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  offerDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D5C96',
  },
  offerPickup: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  offerLandmark: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  offerDestination: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginTop: 3,
  },
  reviewOfferBtn: {
    marginTop: 12,
    backgroundColor: '#D97706',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewOfferText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // RADAR STANDBY CARD
  waitingCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  radarVisualContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  radarWaveOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarWaveMid: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarWaveInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenterIcon: {
    fontSize: 20,
  },
  waitingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  waitingSubtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 12,
  },
  highlightText: {
    fontWeight: '700',
    color: '#0D5C96',
  },
  waitingStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  waitingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  waitingStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },

  // OFFLINE CARD
  offlineCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  offlineIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  offlineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  offlineSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // STATS CARD
  statsCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsCardIcon: {
    fontSize: 18,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  simulatedBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  simulatedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  statsNote: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 10,
    textAlign: 'center',
  },

  // VEHICLE CARD
  vehicleCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  insurancePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  insuranceValid: {
    backgroundColor: '#ECFDF5',
  },
  insurancePending: {
    backgroundColor: '#FEF3C7',
  },
  insurancePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  insuranceValidText: {
    color: '#059669',
  },
  insurancePendingText: {
    color: '#B45309',
  },
  vehicleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  vehicleDetailsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  vehiclePill: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  vehiclePillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  vehiclePillVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },

  // DEV CONTROLS
  devSimCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  devSimHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  devSimTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  devTag: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  devTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  devSimSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 16,
  },

  // SWITCH PORTAL LINK
  switchWrapper: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  switchBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  switchBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D5C96',
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  notificationItem: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0D5C96',
  },
  notifItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  notifItemDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  modalPrimaryBtn: {
    backgroundColor: '#0D5C96',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
