import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ConfirmationDialog } from '../../../components/common/ConfirmationDialog';
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import {
  EmergencyState,
  EMERGENCY_STATE_METADATA,
} from '../../../types/emergency';
import { serviceRegistry } from '../../../services/serviceRegistry';
import { useAuth } from '../../../context/AuthContext';

interface ActiveEmergencyScreenProps {
  onBackToDashboard: () => void;
  onNavigateHistory: () => void;
}

export const ActiveEmergencyScreen: React.FC<ActiveEmergencyScreenProps> = ({
  onBackToDashboard,
  onNavigateHistory,
}) => {
  const { activeEmergency, setActiveEmergency } = useAuth();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [advancingState, setAdvancingState] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!activeEmergency) {
    return (
      <View style={styles.screen}>
        <Header title="Emergency Status" onBack={onBackToDashboard} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>No Active Emergency</Text>
          <Text style={styles.emptySubtitle}>
            You currently do not have an active transportation dispatch in progress.
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

  const meta = EMERGENCY_STATE_METADATA[activeEmergency.status] || {
    label: activeEmergency.status,
    description: '',
    canCancel: false,
    isTerminal: false,
    stepIndex: 1,
  };

  const handleAdvanceSimulation = async () => {
    setActionError(null);
    setAdvancingState(true);
    try {
      const updated = await serviceRegistry.emergencyService.simulateNextState(activeEmergency.id);
      setActiveEmergency(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Simulation error';
      setActionError(msg);
    } finally {
      setAdvancingState(false);
    }
  };

  const handleCancelEmergency = async () => {
    setShowCancelDialog(false);
    setCancelling(true);
    setActionError(null);
    try {
      await serviceRegistry.emergencyService.cancelEmergency(
        activeEmergency.id,
        'Patient indicated cancellation from mobile application'
      );
      setActiveEmergency(null);
      onBackToDashboard();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cancellation failed';
      setActionError(msg);
    } finally {
      setCancelling(false);
    }
  };

  const handleCallResponder = () => {
    if (activeEmergency.assignedResponder?.phoneNumber) {
      Linking.openURL(`tel:${activeEmergency.assignedResponder.phoneNumber}`).catch(() => {});
    }
  };

  const handleCallHospital = () => {
    if (activeEmergency.destinationFacility?.emergencyPhone) {
      Linking.openURL(`tel:${activeEmergency.destinationFacility.emergencyPhone}`).catch(() => {});
    }
  };

  const handleCallDispatcher = () => {
    Linking.openURL('tel:112').catch(() => {});
  };

  const TRACKING_STEPS: { state: EmergencyState; label: string }[] = [
    { state: 'DISPATCHING', label: 'Searching' },
    { state: 'ACCEPTED', label: 'Assigned' },
    { state: 'PICKUP_ARRIVED', label: 'Arrived' },
    { state: 'PATIENT_ONBOARD', label: 'Onboard' },
    { state: 'IN_TRANSIT', label: 'In Transit' },
    { state: 'ARRIVED', label: 'At Clinic' },
  ];

  return (
    <View style={styles.screen}>
      <Header
        title="Live Emergency Tracking"
        subtitle={`Dispatch ID: ${activeEmergency.id}`}
        onBack={onBackToDashboard}
        rightAction={{
          label: '📞 Call 112',
          onPress: handleCallDispatcher,
          isEmergency: true,
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {actionError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {actionError}</Text>
          </View>
        ) : null}

        {/* PRIMARY STATUS CARD */}
        <Card style={styles.statusCard}>
          <View style={styles.statusBadgeRow}>
            <StatusBadge state={activeEmergency.status} />
            <Text style={styles.statusTime}>
              Updated {new Date(activeEmergency.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <Text style={styles.statusHeading}>{meta.label}</Text>
          <Text style={styles.statusDescription}>{meta.description}</Text>

          {/* VISUAL JOURNEY PROGRESS STEPPER */}
          <View style={styles.progressTracker}>
            <Text style={styles.progressTitle}>DISPATCH & JOURNEY PROGRESSION</Text>
            <View style={styles.stepperRow}>
              {TRACKING_STEPS.map((stepItem, index) => {
                const isPassed =
                  meta.stepIndex >= index + 1 ||
                  activeEmergency.status === stepItem.state ||
                  activeEmergency.status === 'COMPLETED';
                const isCurrent = activeEmergency.status === stepItem.state;

                return (
                  <View key={stepItem.state} style={styles.stepNodeContainer}>
                    <View
                      style={[
                        styles.stepDot,
                        isPassed && styles.stepDotPassed,
                        isCurrent && styles.stepDotCurrent,
                      ]}
                    >
                      {isPassed && !isCurrent ? (
                        <Text style={styles.stepCheck}>✓</Text>
                      ) : (
                        <Text style={[styles.stepNum, isCurrent && styles.stepNumCurrent]}>
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        isCurrent && styles.stepLabelCurrent,
                      ]}
                      numberOfLines={1}
                    >
                      {stepItem.label}
                    </Text>
                    {index < TRACKING_STEPS.length - 1 ? (
                      <View
                        style={[
                          styles.stepLine,
                          isPassed && styles.stepLinePassed,
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
        {activeEmergency.status === 'COMPLETED' ? (
          <Card style={styles.completedCard}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Handover Completed</Text>
            <Text style={styles.completedBody}>
              You have arrived safely and are now in the care of the healthcare facility staff.
            </Text>
            <Button
              title="Return to Dashboard"
              variant="primary"
              size="lg"
              onPress={() => {
                serviceRegistry.emergencyService.dismissEmergency(activeEmergency.id);
                setActiveEmergency(null);
                onBackToDashboard();
              }}
              style={styles.doneBtn}
            />
          </Card>
        ) : null}

        {/* ASSIGNED RESPONDER CARD (Once Accepted) */}
        {activeEmergency.assignedResponder ? (
          <Card style={styles.responderCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardSectionTitle}>Assigned Transportation Provider</Text>
              <View style={styles.verifiedTag}>
                <Text style={styles.verifiedTagText}>✓ Verified Driver</Text>
              </View>
            </View>

            <View style={styles.responderMainRow}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>
                  {activeEmergency.assignedResponder.vehicleType === 'MOTORCYCLE' ? '🏍️' : '🚕'}
                </Text>
              </View>

              <View style={styles.responderDetails}>
                <Text style={styles.responderName}>
                  {activeEmergency.assignedResponder.fullName}
                </Text>
                <Text style={styles.vehicleInfo}>
                  {activeEmergency.assignedResponder.vehicleModel}
                </Text>
                <Text style={styles.plateNumber}>
                  Plate: {activeEmergency.assignedResponder.licensePlate}
                </Text>
              </View>

              {activeEmergency.assignedResponder.etaMinutes ? (
                <View style={styles.etaBadge}>
                  <Text style={styles.etaNum}>
                    ~{activeEmergency.assignedResponder.etaMinutes}
                  </Text>
                  <Text style={styles.etaUnit}>MINS ETA</Text>
                </View>
              ) : null}
            </View>

            {/* Direct Call Button */}
            <TouchableOpacity
              onPress={handleCallResponder}
              style={styles.callDriverBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.callDriverText}>
                📞 Call Responder ({activeEmergency.assignedResponder.phoneNumber})
              </Text>
            </TouchableOpacity>

            <Text style={styles.driverDisclaimer}>
              Verified transportation provider. Ordinary drivers are not medical staff.
            </Text>
          </Card>
        ) : activeEmergency.status !== 'COMPLETED' ? (
          /* DISPATCHING SEARCHING CARD */
          <Card style={styles.dispatchingCard}>
            <View style={styles.radarVisual}>
              <View style={styles.radarRingOuter}>
                <ActivityIndicator size="small" color={colors.healthcare.primary} />
              </View>
            </View>
            <Text style={styles.dispatchingTitle}>Searching for Nearest Driver</Text>
            <Text style={styles.dispatchingSub}>
              Broadcasting emergency request to verified motorcycle and taxi drivers in {activeEmergency.location.villageCommunity}...
            </Text>
          </Card>
        ) : null}

        {/* DESTINATION FACILITY CARD */}
        {activeEmergency.destinationFacility ? (
          <Card style={styles.facilityCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardSectionTitle}>Destination Healthcare Center</Text>
              <View style={styles.maternalFacilityTag}>
                <Text style={styles.maternalFacilityTagText}>Maternity Center</Text>
              </View>
            </View>

            <Text style={styles.facilityName}>
              🏥 {activeEmergency.destinationFacility.name}
            </Text>
            <Text style={styles.facilityAddress}>
              {activeEmergency.destinationFacility.address}, {activeEmergency.destinationFacility.community}
            </Text>

            <TouchableOpacity
              onPress={handleCallHospital}
              style={styles.callFacilityBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.callFacilityText}>
                📞 Call Hospital Emergency Desk ({activeEmergency.destinationFacility.emergencyPhone})
              </Text>
            </TouchableOpacity>
          </Card>
        ) : null}

        {/* PICKUP LOCATION CARD */}
        <Card style={styles.pickupCard}>
          <Text style={styles.cardSectionTitle}>Your Pickup Location</Text>
          <Text style={styles.pickupArea}>
            📍 {activeEmergency.location.villageCommunity || 'Area not specified'}
          </Text>
          {activeEmergency.location.landmark ? (
            <Text style={styles.pickupLandmark}>
              Landmark: {activeEmergency.location.landmark}
            </Text>
          ) : null}
          <Text style={styles.pickupSource}>
            Mode:{' '}
            {activeEmergency.location.source === 'GPS'
              ? `GPS Satellite Lock (±${activeEmergency.location.accuracyMeters}m)`
              : 'Manual Village/Landmark Guidance'}
          </Text>
        </Card>

        <SafetyBanner />

        {/* CANCEL EMERGENCY BUTTON (Only permitted before PATIENT_ONBOARD) */}
        {meta.canCancel ? (
          <View style={styles.cancelSection}>
            <Button
              title="Cancel Emergency Request"
              variant="outline"
              size="md"
              loading={cancelling}
              onPress={() => setShowCancelDialog(true)}
              style={styles.cancelBtn}
            />
          </View>
        ) : null}

        {/* DEVELOPER SIMULATION ADVANCE BUTTON */}
        <View style={styles.simCard}>
          <View style={styles.simHeaderRow}>
            <Text style={styles.simTitle}>🛠️ Developer / Quality Audit Controls</Text>
            <View style={styles.devTag}>
              <Text style={styles.devTagText}>Dev Tool</Text>
            </View>
          </View>
          <Text style={styles.simSub}>
            Advance Developer 2's Python backend emergency state machine to simulate driver progress:
          </Text>
          <Button
            title={advancingState ? 'Transitioning...' : '[DEV] Advance Next Emergency Milestone'}
            variant="secondary"
            size="md"
            loading={advancingState}
            onPress={handleAdvanceSimulation}
          />
        </View>
      </ScrollView>

      {/* CANCELLATION CONFIRMATION DIALOG */}
      <ConfirmationDialog
        visible={showCancelDialog}
        title="Cancel Emergency Transportation?"
        message="Are you sure you want to cancel this emergency ride? Dispatched drivers will be released."
        confirmLabel="Yes, Cancel Request"
        cancelLabel="Keep Emergency Active"
        isDangerous={true}
        onConfirm={handleCancelEmergency}
        onCancel={() => setShowCancelDialog(false)}
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
  },
  returnBtn: {
    minWidth: 200,
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
  statusCard: {
    marginBottom: spacing.md,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusTime: {
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
  progressTracker: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  progressTitle: {
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
  stepNodeContainer: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  stepDot: {
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
  stepDotPassed: {
    backgroundColor: colors.semantic.emerald,
    borderColor: colors.semantic.emerald,
  },
  stepDotCurrent: {
    backgroundColor: colors.healthcare.primary,
    borderColor: colors.healthcare.primary,
    transform: [{ scale: 1.15 }],
  },
  stepCheck: {
    color: colors.neutral.white,
    fontSize: 11,
    fontWeight: '900',
  },
  stepNum: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral.textSecondary,
  },
  stepNumCurrent: {
    color: colors.neutral.white,
  },
  stepLabel: {
    ...typography.caption,
    fontSize: 8,
    color: colors.neutral.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelCurrent: {
    color: colors.healthcare.primary,
    fontWeight: '800',
  },
  stepLine: {
    position: 'absolute',
    top: 11,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: colors.neutral.border,
    zIndex: 1,
  },
  stepLinePassed: {
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
  completedEmoji: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  completedTitle: {
    ...typography.h2,
    color: colors.semantic.emerald,
    marginBottom: 4,
  },
  completedBody: {
    ...typography.body,
    color: colors.neutral.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 21,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: colors.semantic.emerald,
  },
  responderCard: {
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardSectionTitle: {
    ...typography.label,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
  },
  verifiedTag: {
    backgroundColor: colors.semantic.emeraldBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.semantic.emeraldBorder,
  },
  verifiedTagText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.semantic.emerald,
  },
  responderMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.healthcare.light,
    borderWidth: 1.5,
    borderColor: colors.healthcare.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  responderDetails: {
    flex: 1,
  },
  responderName: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
  },
  vehicleInfo: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginTop: 1,
  },
  plateNumber: {
    ...typography.caption,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginTop: 1,
  },
  etaBadge: {
    backgroundColor: colors.healthcare.light,
    borderColor: colors.healthcare.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  etaNum: {
    ...typography.h3,
    color: colors.healthcare.primary,
    fontWeight: '900',
  },
  etaUnit: {
    ...typography.caption,
    fontSize: 8,
    fontWeight: '800',
    color: colors.healthcare.dark,
  },
  callDriverBtn: {
    backgroundColor: colors.healthcare.primary,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  callDriverText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral.white,
  },
  driverDisclaimer: {
    ...typography.caption,
    fontSize: 10,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  dispatchingCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  radarVisual: {
    marginBottom: spacing.sm,
  },
  radarRingOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.healthcare.light,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.healthcare.border,
  },
  dispatchingTitle: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  dispatchingSub: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  facilityCard: {
    marginBottom: spacing.md,
  },
  maternalFacilityTag: {
    backgroundColor: colors.semantic.emeraldBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  maternalFacilityTagText: {
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
    marginTop: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderColor: colors.healthcare.border,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  callFacilityText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.healthcare.primary,
  },
  pickupCard: {
    marginBottom: spacing.md,
  },
  pickupArea: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
    marginTop: 2,
  },
  pickupLandmark: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  pickupSource: {
    ...typography.caption,
    color: colors.neutral.textMuted,
    marginTop: 4,
  },
  cancelSection: {
    marginVertical: spacing.sm,
  },
  cancelBtn: {
    borderColor: colors.emergency.border,
  },
  simCard: {
    backgroundColor: colors.neutral.white,
    borderColor: colors.healthcare.border,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  simHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  simTitle: {
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
  simSub: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
});
