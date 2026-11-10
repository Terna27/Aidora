import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import { EmergencyState, EMERGENCY_STATE_METADATA } from '../../../types/emergency';
import { useResponderAuth } from '../../../context/ResponderAuthContext';

interface ActiveJourneyScreenProps {
  onBackToDashboard: () => void;
}

export const ActiveJourneyScreen: React.FC<ActiveJourneyScreenProps> = ({
  onBackToDashboard,
}) => {
  const {
    activeJourney,
    advanceJourneyState,
    completeHandover,
    dismissCompletedJourney,
  } = useResponderAuth();

  const [advancing, setAdvancing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Handover modal state
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState(
    'Patient safely handed over to facility maternal emergency triage team.'
  );

  if (!activeJourney) {
    return (
      <View style={styles.screen}>
        <Header title="Active Emergency Journey" onBack={onBackToDashboard} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏍️</Text>
          <Text style={styles.emptyTitle}>No Active Journey</Text>
          <Text style={styles.emptySubtitle}>
            You do not currently have an assigned emergency ride. When you accept an emergency dispatch, trip navigation will appear here.
          </Text>
          <Button
            title="Return to Dashboard"
            variant="primary"
            onPress={onBackToDashboard}
            style={styles.returnBtn}
          />
        </View>
      </View>
    );
  }

  const meta = EMERGENCY_STATE_METADATA[activeJourney.status] || {
    label: activeJourney.status,
    description: '',
  };

  const handleAdvance = async (targetState: EmergencyState) => {
    setActionError(null);
    setAdvancing(true);
    try {
      await advanceJourneyState(targetState);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update journey state';
      setActionError(msg);
    } finally {
      setAdvancing(false);
    }
  };

  const handleConfirmHandover = async () => {
    setActionError(null);
    setAdvancing(true);
    try {
      await completeHandover(handoverNotes.trim());
      setShowHandoverModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Handover failed';
      setActionError(msg);
    } finally {
      setAdvancing(false);
    }
  };

  const handleCallPatient = () => {
    if (activeJourney.patientPhone) {
      Linking.openURL(`tel:${activeJourney.patientPhone}`).catch(() => {});
    }
  };

  const handleCallHospital = () => {
    if (activeJourney.destinationFacility?.emergencyPhone) {
      Linking.openURL(`tel:${activeJourney.destinationFacility.emergencyPhone}`).catch(() => {});
    }
  };

  // Launch external GPS navigation (Google Maps / Android navigation intent)
  const handleLaunchExternalNavigation = () => {
    if (activeJourney.location.coords) {
      const { latitude, longitude } = activeJourney.location.coords;
      const label = encodeURIComponent(activeJourney.location.villageCommunity || 'Patient Pickup');
      const url =
        Platform.OS === 'android'
          ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`
          : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`).catch(() => {});
      });
    } else {
      // Manual landmark query search
      const query = encodeURIComponent(
        `${activeJourney.location.landmark || ''} ${activeJourney.location.villageCommunity || ''}`.trim()
      );
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() => {});
    }
  };

  // 8-step visual milestone mapping
  const JOURNEY_STEPS = [
    { key: 'ACCEPTED', label: 'Accepted', icon: '1' },
    { key: 'HEADING_TO_PICKUP', label: 'En Route', icon: '2' },
    { key: 'PICKUP_ARRIVED', label: 'At Pickup', icon: '3' },
    { key: 'PATIENT_ONBOARD', label: 'Onboard', icon: '4' },
    { key: 'HOSPITAL_SELECTED', label: 'Clinic Set', icon: '5' },
    { key: 'IN_TRANSIT', label: 'In Transit', icon: '6' },
    { key: 'ARRIVED', label: 'At Clinic', icon: '7' },
    { key: 'COMPLETED', label: 'Completed', icon: '8' },
  ];

  // Helper to determine step completion index
  const getStepProgressIndex = (status: EmergencyState): number => {
    switch (status) {
      case 'ACCEPTED':
        return 1; // Step 1 & 2 active
      case 'PICKUP_ARRIVED':
        return 2;
      case 'PATIENT_ONBOARD':
        return 3;
      case 'HOSPITAL_SELECTED':
        return 4;
      case 'IN_TRANSIT':
        return 5;
      case 'ARRIVED':
        return 6;
      case 'COMPLETED':
        return 7;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepProgressIndex(activeJourney.status);

  return (
    <View style={styles.screen}>
      <Header
        title="Emergency Route Dispatch"
        subtitle={`ID: ${activeJourney.id}`}
        onBack={onBackToDashboard}
        rightAction={{
          label: '📞 Call Patient',
          onPress: handleCallPatient,
          isEmergency: false,
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {actionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {actionError}</Text>
          </View>
        ) : null}

        {/* PRIMARY STATUS CARD & STEPPER */}
        <Card style={styles.statusCard}>
          <View style={styles.badgeRow}>
            <StatusBadge state={activeJourney.status} />
            <Text style={styles.timeText}>
              Updated {new Date(activeJourney.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <Text style={styles.statusHeading}>{meta.label}</Text>
          <Text style={styles.statusDescription}>{meta.description}</Text>

          {/* 8-STEP PROGRESS TRACKER */}
          <View style={styles.progressContainer}>
            <Text style={styles.stepperTitle}>JOURNEY PROGRESSION MILESTONES (1-8)</Text>
            <View style={styles.stepperRow}>
              {JOURNEY_STEPS.map((step, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <View key={step.key} style={styles.stepperItem}>
                    <View
                      style={[
                        styles.stepperDot,
                        isPassed && styles.stepperDotPassed,
                        isCurrent && styles.stepperDotCurrent,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepperDotText,
                          isPassed && styles.stepperDotTextPassed,
                        ]}
                      >
                        {isPassed && idx < currentStepIdx ? '✓' : step.icon}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.stepperLabel,
                        isCurrent && styles.stepperLabelCurrent,
                      ]}
                      numberOfLines={1}
                    >
                      {step.label}
                    </Text>
                    {idx < JOURNEY_STEPS.length - 1 ? (
                      <View
                        style={[
                          styles.stepperConnector,
                          idx < currentStepIdx && styles.stepperConnectorPassed,
                        ]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </Card>

        {/* COMPLETED SUCCESS CARD */}
        {activeJourney.status === 'COMPLETED' ? (
          <Card style={styles.completedCard}>
            <Text style={styles.completedIcon}>🎉</Text>
            <Text style={styles.completedTitle}>Handover Completed!</Text>
            <Text style={styles.completedSub}>
              You have successfully completed this maternal emergency transportation. Patient has been safely transferred to facility clinical care.
            </Text>
            <Button
              title="Return to Dashboard (Ready for Next Ride)"
              variant="primary"
              size="lg"
              onPress={() => {
                dismissCompletedJourney();
                onBackToDashboard();
              }}
              style={styles.doneBtn}
            />
          </Card>
        ) : null}

        {/* ROUTE VISUALIZATION & NAVIGATION PANEL */}
        {activeJourney.status !== 'COMPLETED' ? (
          <Card style={styles.mapCard}>
            <View style={styles.mapHeaderRow}>
              <View style={styles.mapTitleWrapper}>
                <Text style={styles.mapSectionLabel}>NAVIGATION & ROUTE GUIDANCE</Text>
                <Text style={styles.mapCurrentLeg}>
                  {activeJourney.status === 'ACCEPTED' || activeJourney.status === 'PICKUP_ARRIVED'
                    ? 'Leg 1: En Route to Patient Pickup'
                    : 'Leg 2: En Route to Maternity Center'}
                </Text>
              </View>

              <View style={styles.locationSourceTag}>
                <Text style={styles.locationSourceText}>
                  {activeJourney.location.source === 'GPS'
                    ? `GPS Lock (±${activeJourney.location.accuracyMeters || 10}m)`
                    : 'Landmark Navigation'}
                </Text>
              </View>
            </View>

            {/* ROUTE CORRIDOR VISUAL CONTAINER */}
            <View style={styles.routeSchematic}>
              <View style={styles.routeLegItem}>
                <View style={styles.routePin}>
                  <Text style={styles.routePinText}>📍</Text>
                </View>
                <View style={styles.routeLegContent}>
                  <Text style={styles.routeLegTitle}>Pickup Point</Text>
                  <Text style={styles.routeLegDesc} numberOfLines={1}>
                    {activeJourney.location.villageCommunity}
                  </Text>
                </View>
              </View>

              <View style={styles.routeDottedLine} />

              <View style={styles.routeLegItem}>
                <View style={[styles.routePin, styles.routePinHospital]}>
                  <Text style={styles.routePinText}>🏥</Text>
                </View>
                <View style={styles.routeLegContent}>
                  <Text style={styles.routeLegTitle}>Destination</Text>
                  <Text style={styles.routeLegDesc} numberOfLines={1}>
                    {activeJourney.destinationFacility?.name || 'Maternity Center'}
                  </Text>
                </View>
              </View>
            </View>

            {/* GPS COORDINATES CALLOUT WHEN VALID */}
            {activeJourney.location.coords ? (
              <View style={styles.coordsBox}>
                <Text style={styles.coordsText}>
                  GPS Coordinates: {activeJourney.location.coords.latitude.toFixed(5)},{' '}
                  {activeJourney.location.coords.longitude.toFixed(5)}
                </Text>
              </View>
            ) : (
              <View style={styles.manualNoticeBox}>
                <Text style={styles.manualNoticeText}>
                  * Landmark-based dispatch (patient did not provide GPS coordinates to ensure rural coverage). Use village and directions guidance below.
                </Text>
              </View>
            )}

            <Button
              title="🗺️ Open Turn-by-Turn in Google Maps"
              variant="outline"
              size="md"
              onPress={handleLaunchExternalNavigation}
              style={styles.openMapsBtn}
            />
          </Card>
        ) : null}

        {/* PASSENGER & PICKUP LOCATION CARD */}
        <Card style={styles.pickupCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardSectionTitle}>Passenger & Pickup Location</Text>
            <View style={styles.privacyLockTag}>
              <Text style={styles.privacyLockText}>🔒 Authorized Contact</Text>
            </View>
          </View>

          <Text style={styles.patientName}>
            👤 {activeJourney.patientName}
          </Text>
          <Text style={styles.transportCategory}>
            Category: Maternal Emergency Transport
          </Text>

          <View style={styles.locationDivider} />

          <Text style={styles.pickupArea}>
            📍 {activeJourney.location.villageCommunity}
          </Text>

          {activeJourney.location.landmark ? (
            <Text style={styles.pickupLandmark}>
              Landmark: {activeJourney.location.landmark}
            </Text>
          ) : null}

          {activeJourney.location.streetAddress ? (
            <Text style={styles.pickupStreet}>
              Address / Compound: {activeJourney.location.streetAddress}
            </Text>
          ) : null}

          {activeJourney.location.directionsNotes ? (
            <Text style={styles.pickupDirections}>
              Directions Note: "{activeJourney.location.directionsNotes}"
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={handleCallPatient}
            style={styles.callPatientBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.callPatientText}>
              📞 Call Passenger ({activeJourney.patientPhone})
            </Text>
          </TouchableOpacity>
        </Card>

        {/* DESTINATION FACILITY CARD */}
        {activeJourney.destinationFacility ? (
          <Card style={styles.facilityCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardSectionTitle}>Destination Healthcare Center</Text>
              <Text style={styles.alertTag}>Maternity Center</Text>
            </View>

            <Text style={styles.facilityName}>
              🏥 {activeJourney.destinationFacility.name}
            </Text>
            <Text style={styles.facilityAddress}>
              {activeJourney.destinationFacility.address}, {activeJourney.destinationFacility.community}
            </Text>

            <TouchableOpacity
              onPress={handleCallHospital}
              style={styles.callFacilityBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.callFacilityText}>
                📞 Call Hospital Emergency Desk ({activeJourney.destinationFacility.emergencyPhone})
              </Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* RESPONDER DRIVER GUIDANCE */}
        <View style={styles.guidanceCard}>
          <Text style={styles.guidanceTitle}>⚠️ Driver Safety & Role Boundaries</Text>
          <Text style={styles.guidanceBody}>
            • Responders coordinate emergency transportation only. Ordinary drivers are not medical staff and must never attempt medical procedures.{'\n'}
            • Drive safely and follow road regulations. Do not take reckless risks.{'\n'}
            • In critical life-threatening obstetric distress, dial emergency services immediately.
          </Text>
        </View>

        {/* AUTHORITATIVE STATE ACTION BUTTONS */}
        {activeJourney.status !== 'COMPLETED' ? (
          <View style={styles.actionSection}>
            <Text style={styles.actionPrompt}>Next Required Milestone Action:</Text>

            {activeJourney.status === 'ACCEPTED' ? (
              <Button
                title="📍 I Have Arrived at Pickup Location"
                variant="primary"
                size="lg"
                loading={advancing}
                onPress={() => handleAdvance('PICKUP_ARRIVED')}
                style={styles.milestoneBtn}
              />
            ) : null}

            {activeJourney.status === 'PICKUP_ARRIVED' ? (
              <Button
                title="👥 Confirm Patient Safely Onboard"
                variant="primary"
                size="lg"
                loading={advancing}
                onPress={() => handleAdvance('PATIENT_ONBOARD')}
                style={styles.milestoneBtn}
              />
            ) : null}

            {activeJourney.status === 'PATIENT_ONBOARD' ? (
              <Button
                title="🏥 Confirm Facility & Begin Transit"
                variant="primary"
                size="lg"
                loading={advancing}
                onPress={() => handleAdvance('HOSPITAL_SELECTED')}
                style={styles.milestoneBtn}
              />
            ) : null}

            {activeJourney.status === 'HOSPITAL_SELECTED' ? (
              <Button
                title="🚀 Start Journey to Healthcare Facility"
                variant="primary"
                size="lg"
                loading={advancing}
                onPress={() => handleAdvance('IN_TRANSIT')}
                style={styles.milestoneBtn}
              />
            ) : null}

            {activeJourney.status === 'IN_TRANSIT' ? (
              <Button
                title="🏥 Arrived at Healthcare Facility Entrance"
                variant="primary"
                size="lg"
                loading={advancing}
                onPress={() => handleAdvance('ARRIVED')}
                style={styles.milestoneBtn}
              />
            ) : null}

            {activeJourney.status === 'ARRIVED' ? (
              <Button
                title="✅ Complete Emergency Handover to Staff"
                variant="primary"
                size="lg"
                loading={advancing}
                onPress={() => setShowHandoverModal(true)}
                style={[styles.milestoneBtn, styles.handoverBtn]}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* HANDOVER CONFIRMATION MODAL */}
      <Modal
        visible={showHandoverModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHandoverModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.handoverModalCard}>
            <Text style={styles.handoverModalTitle}>Emergency Triage Handover</Text>
            <Text style={styles.handoverModalSub}>
              Confirm that you have safely arrived at {activeJourney.destinationFacility?.name || 'the healthcare facility'} and handed over the patient to clinical staff.
            </Text>

            <Text style={styles.handoverInputLabel}>Handover Triage Notes:</Text>
            <TextInput
              style={styles.handoverInput}
              value={handoverNotes}
              onChangeText={setHandoverNotes}
              multiline
              numberOfLines={3}
              placeholder="e.g. Patient received by Nurse Chioma at Maternity Triage desk."
            />

            <View style={styles.handoverModalActions}>
              <Button
                title="Confirm Handover Completion"
                variant="primary"
                size="lg"
                loading={advancing}
                onPress={handleConfirmHandover}
                style={styles.confirmHandoverBtn}
              />
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => setShowHandoverModal(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginTop: spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  returnBtn: {
    minWidth: 200,
  },
  errorBox: {
    backgroundColor: colors.semantic.redBg,
    borderColor: colors.semantic.redBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.semantic.red,
    fontWeight: '700',
  },
  statusCard: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timeText: {
    ...typography.caption,
    color: colors.neutral.textMuted,
    fontSize: 11,
  },
  statusHeading: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  statusDescription: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  progressContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  stepperTitle: {
    ...typography.label,
    fontSize: 9,
    color: colors.neutral.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepperDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.neutral.surfaceAlt,
    borderColor: colors.neutral.borderStrong,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepperDotPassed: {
    backgroundColor: colors.semantic.emerald,
    borderColor: colors.semantic.emerald,
  },
  stepperDotCurrent: {
    backgroundColor: colors.healthcare.primary,
    borderColor: colors.healthcare.primary,
    transform: [{ scale: 1.15 }],
  },
  stepperDotText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.neutral.textSecondary,
  },
  stepperDotTextPassed: {
    color: colors.neutral.white,
  },
  stepperLabel: {
    ...typography.caption,
    fontSize: 8,
    color: colors.neutral.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  stepperLabelCurrent: {
    color: colors.healthcare.primary,
    fontWeight: '800',
  },
  stepperConnector: {
    position: 'absolute',
    top: 11,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: colors.neutral.border,
    zIndex: 1,
  },
  stepperConnectorPassed: {
    backgroundColor: colors.semantic.emerald,
  },
  completedCard: {
    backgroundColor: colors.semantic.emeraldBg,
    borderColor: colors.semantic.emeraldBorder,
    borderWidth: 2,
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  completedIcon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  completedTitle: {
    ...typography.h2,
    color: colors.semantic.emerald,
    marginBottom: 6,
  },
  completedSub: {
    ...typography.body,
    color: colors.neutral.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: colors.semantic.emerald,
  },
  mapCard: {
    marginBottom: spacing.md,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  mapTitleWrapper: {
    flex: 1,
  },
  mapSectionLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.neutral.textMuted,
    letterSpacing: 0.5,
  },
  mapCurrentLeg: {
    ...typography.body,
    fontWeight: '800',
    color: colors.neutral.textPrimary,
    marginTop: 1,
  },
  locationSourceTag: {
    backgroundColor: colors.healthcare.light,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  locationSourceText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.healthcare.dark,
  },
  routeSchematic: {
    backgroundColor: colors.neutral.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  routeLegItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routePin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routePinHospital: {
    borderColor: colors.healthcare.border,
  },
  routePinText: {
    fontSize: 14,
  },
  routeLegContent: {
    flex: 1,
  },
  routeLegTitle: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.neutral.textSecondary,
  },
  routeLegDesc: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
  },
  routeDottedLine: {
    height: 20,
    width: 2,
    backgroundColor: colors.healthcare.primary,
    marginLeft: 13,
    marginVertical: 2,
    opacity: 0.5,
  },
  coordsBox: {
    backgroundColor: colors.neutral.white,
    padding: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  coordsText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.neutral.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  manualNoticeBox: {
    backgroundColor: colors.neutral.surfaceAlt,
    padding: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  manualNoticeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  openMapsBtn: {
    marginTop: spacing.sm,
  },
  pickupCard: {
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardSectionTitle: {
    ...typography.label,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
  },
  privacyLockTag: {
    backgroundColor: colors.neutral.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  privacyLockText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '700',
    color: colors.neutral.textMuted,
  },
  patientName: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginTop: 2,
  },
  transportCategory: {
    ...typography.caption,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginTop: 1,
  },
  locationDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.sm,
  },
  pickupArea: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
  },
  pickupLandmark: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  pickupStreet: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  pickupDirections: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  callPatientBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.healthcare.light,
    borderColor: colors.healthcare.border,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  callPatientText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.healthcare.dark,
  },
  facilityCard: {
    marginBottom: spacing.md,
  },
  alertTag: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.semantic.emerald,
  },
  facilityName: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginTop: 2,
  },
  facilityAddress: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  callFacilityBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.neutral.white,
    borderColor: colors.healthcare.border,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  callFacilityText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.healthcare.primary,
  },
  guidanceCard: {
    backgroundColor: colors.semantic.amberBg,
    borderColor: colors.semantic.amberBorder,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  guidanceTitle: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.semantic.amber,
    marginBottom: 4,
  },
  guidanceBody: {
    ...typography.caption,
    color: colors.neutral.textPrimary,
    lineHeight: 18,
  },
  actionSection: {
    marginBottom: spacing.xl,
  },
  actionPrompt: {
    ...typography.label,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  milestoneBtn: {
    marginBottom: spacing.sm,
  },
  handoverBtn: {
    backgroundColor: colors.semantic.emerald,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  handoverModalCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  handoverModalTitle: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
    marginBottom: 6,
  },
  handoverModalSub: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  handoverInputLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.neutral.textMuted,
    marginBottom: 4,
  },
  handoverInput: {
    backgroundColor: colors.neutral.surfaceAlt,
    borderColor: colors.neutral.borderStrong,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.neutral.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  handoverModalActions: {
    gap: spacing.sm,
  },
  confirmHandoverBtn: {
    backgroundColor: colors.semantic.emerald,
  },
});
