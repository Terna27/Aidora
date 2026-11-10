import React, { useState, useEffect } from 'react';
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
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import { LocationData } from '../../../types/emergency';
import { serviceRegistry } from '../../../services/serviceRegistry';
import { useAuth } from '../../../context/AuthContext';

interface SOSConfirmationScreenProps {
  onBack: () => void;
  onNavigateLocationSelect: () => void;
  onEmergencySubmitted: () => void;
  selectedLocation: LocationData | null;
  onLocationUpdated: (location: LocationData) => void;
}

export const SOSConfirmationScreen: React.FC<SOSConfirmationScreenProps> = ({
  onBack,
  onNavigateLocationSelect,
  onEmergencySubmitted,
  selectedLocation,
  onLocationUpdated,
}) => {
  const { patient, activeEmergency, setActiveEmergency } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeEmergency) {
      onEmergencySubmitted();
      return;
    }

    if (!selectedLocation) {
      (async () => {
        setDetectingGps(true);
        const res = await serviceRegistry.locationService.acquireGpsLocation();
        setDetectingGps(false);
        if (res.success && res.location) {
          onLocationUpdated(res.location);
        } else {
          const defaultCommunity = patient?.communityOrVillage || 'Central Community';
          const fallback = serviceRegistry.locationService.createManualLocation(
            defaultCommunity,
            'Village Center'
          );
          onLocationUpdated(fallback);
        }
      })();
    }
  }, [activeEmergency]);

  const handleSubmitEmergency = async () => {
    setErrorMessage(null);

    if (activeEmergency) {
      setErrorMessage('An emergency request is already active.');
      onEmergencySubmitted();
      return;
    }

    if (!selectedLocation) {
      setErrorMessage('Please confirm your pickup location before sending SOS.');
      return;
    }

    if (!patient) {
      setErrorMessage('Patient session expired. Please sign in again.');
      return;
    }

    setSubmitting(true);
    try {
      const emergency = await serviceRegistry.emergencyService.submitEmergency(
        patient.id,
        patient.fullName,
        patient.phoneNumber,
        selectedLocation,
        `Gestational Age: ${patient.gestationalAgeWeeks ? patient.gestationalAgeWeeks + ' weeks' : 'Not specified'}`
      );

      setActiveEmergency(emergency);
      onEmergencySubmitted();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SOS submission failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallHotline = () => {
    Linking.openURL('tel:112').catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Emergency Dispatch Confirmation"
        onBack={onBack}
        rightAction={{
          label: '📞 Call 112',
          onPress: handleCallHotline,
          isEmergency: true,
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.alertHeaderBox}>
          <Text style={styles.alertTitle}>🚨 Confirm Maternal Transport SOS</Text>
          <Text style={styles.alertSubtitle}>
            Our dispatch engine will immediately alert the nearest verified motorcycle riders and taxi drivers to pick you up.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        {/* PICKUP LOCATION PREVIEW CARD */}
        <Card style={styles.summaryCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeading}>Pickup Location Details</Text>
            <TouchableOpacity onPress={onNavigateLocationSelect}>
              <Text style={styles.changeLink}>Edit ➔</Text>
            </TouchableOpacity>
          </View>

          {detectingGps ? (
            <View style={styles.gpsDetectingRow}>
              <ActivityIndicator size="small" color={colors.healthcare.primary} />
              <Text style={styles.gpsDetectingText}>Acquiring GPS position...</Text>
            </View>
          ) : selectedLocation ? (
            <View style={styles.locationDetails}>
              <Text style={styles.communityName}>
                📍 {selectedLocation.villageCommunity || 'Village/Community Area'}
              </Text>

              {selectedLocation.landmark ? (
                <Text style={styles.landmarkText}>
                  Landmark: {selectedLocation.landmark}
                </Text>
              ) : null}

              {selectedLocation.streetAddress ? (
                <Text style={styles.streetText}>
                  Address / Compound: {selectedLocation.streetAddress}
                </Text>
              ) : null}

              {selectedLocation.directionsNotes ? (
                <Text style={styles.directionsText}>
                  Directions: "{selectedLocation.directionsNotes}"
                </Text>
              ) : null}

              <View style={styles.locationTypeBadge}>
                <Text style={styles.locationTypeBadgeText}>
                  {selectedLocation.source === 'GPS'
                    ? `✓ Satellite GPS Lock (±${selectedLocation.accuracyMeters || 10}m)`
                    : 'Landmark / Community Guidance'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.noLocationText}>No pickup location specified.</Text>
          )}
        </Card>

        {/* PATIENT EMERGENCY SUMMARY */}
        <Card style={styles.summaryCard}>
          <Text style={styles.cardHeading}>Patient Transportation Summary</Text>
          <Text style={styles.patientName}>👤 {patient?.fullName}</Text>
          <Text style={styles.patientPhone}>Phone: {patient?.phoneNumber}</Text>
          {patient?.gestationalAgeWeeks ? (
            <Text style={styles.gestationalInfo}>
              Gestational Stage: {patient.gestationalAgeWeeks} Weeks
            </Text>
          ) : null}
          <Text style={styles.serviceNote}>
            Service: Direct Emergency Transportation to nearest Maternal Healthcare Center
          </Text>
        </Card>

        <SafetyBanner />

        {/* PRIMARY CONFIRMATION ACTION */}
        <View style={styles.submitSection}>
          <Button
            title={submitting ? 'Alerting Verified Drivers...' : 'CONFIRM & SEND SOS DISPATCH'}
            variant="emergency"
            size="lg"
            loading={submitting}
            onPress={handleSubmitEmergency}
            style={styles.sosConfirmBtn}
          />

          <TouchableOpacity
            onPress={onBack}
            style={styles.cancelLink}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelLinkText}>Cancel & Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  alertHeaderBox: {
    marginBottom: spacing.md,
  },
  alertTitle: {
    ...typography.h2,
    color: colors.emergency.primary,
    marginBottom: 4,
  },
  alertSubtitle: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
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
  summaryCard: {
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardHeading: {
    ...typography.label,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
  },
  changeLink: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.healthcare.primary,
  },
  gpsDetectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  gpsDetectingText: {
    ...typography.body,
    color: colors.neutral.textSecondary,
  },
  locationDetails: {
    marginTop: 2,
  },
  communityName: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
  },
  landmarkText: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  streetText: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  directionsText: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  locationTypeBadge: {
    backgroundColor: colors.neutral.surfaceAlt,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  locationTypeBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral.textSecondary,
  },
  noLocationText: {
    ...typography.body,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  patientName: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
    marginTop: 2,
  },
  patientPhone: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  gestationalInfo: {
    ...typography.caption,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  serviceNote: {
    ...typography.caption,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  submitSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sosConfirmBtn: {
    backgroundColor: colors.emergency.primary,
    shadowColor: colors.emergency.primary,
  },
  cancelLink: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelLinkText: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    fontWeight: '600',
  },
});
