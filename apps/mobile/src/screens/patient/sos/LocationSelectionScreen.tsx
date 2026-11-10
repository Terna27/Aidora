import React, { useState, useEffect } from 'react';
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
import { Input } from '../../../components/common/Input';
import { Header } from '../../../components/common/Header';
import { Card } from '../../../components/common/Card';
import { LocationData } from '../../../types/emergency';
import { serviceRegistry } from '../../../services/serviceRegistry';

interface LocationSelectionScreenProps {
  initialLocation?: LocationData | null;
  onConfirmLocation: (location: LocationData) => void;
  onBack: () => void;
}

export const LocationSelectionScreen: React.FC<LocationSelectionScreenProps> = ({
  initialLocation,
  onConfirmLocation,
  onBack,
}) => {
  const [selectedSource, setSelectedSource] = useState<'GPS' | 'MANUAL'>(
    initialLocation?.source || 'GPS'
  );
  const [gpsLocation, setGpsLocation] = useState<LocationData | null>(
    initialLocation?.source === 'GPS' ? initialLocation : null
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Manual location fields
  const [community, setCommunity] = useState(initialLocation?.villageCommunity || '');
  const [landmark, setLandmark] = useState(initialLocation?.landmark || '');
  const [streetAddress, setStreetAddress] = useState(initialLocation?.streetAddress || '');
  const [directionsNotes, setDirectionsNotes] = useState(initialLocation?.directionsNotes || '');

  const fetchGps = async () => {
    setGpsLoading(true);
    setGpsError(null);

    const result = await serviceRegistry.locationService.acquireGpsLocation();
    setGpsLoading(false);

    if (result.success && result.location) {
      setGpsLocation(result.location);
      setSelectedSource('GPS');
      if (result.location.villageCommunity && !community) {
        setCommunity(result.location.villageCommunity);
      }
    } else {
      setGpsError(result.error?.message || 'Unable to get GPS position.');
      setSelectedSource('MANUAL');
    }
  };

  useEffect(() => {
    if (!initialLocation) {
      fetchGps();
    }
  }, []);

  const handleConfirm = () => {
    if (selectedSource === 'GPS') {
      if (gpsLoading) {
        setGpsError('Still acquiring GPS signal. Please wait a moment.');
        return;
      }
      if (!gpsLocation) {
        setGpsError(
          'GPS signal not yet acquired. Please tap "Detect Current Location" or switch to the "Manual Village / Landmark" tab.'
        );
        return;
      }
      const updatedGps: LocationData = {
        ...gpsLocation,
        landmark: landmark.trim(),
        directionsNotes: directionsNotes.trim(),
        villageCommunity: community.trim() || gpsLocation.villageCommunity,
      };
      onConfirmLocation(updatedGps);
      return;
    }

    // Manual validation
    if (!community.trim() && !landmark.trim()) {
      setGpsError('Please specify at least a Community/Village or a prominent Landmark.');
      return;
    }

    const manualLoc = serviceRegistry.locationService.createManualLocation(
      community,
      landmark,
      streetAddress,
      directionsNotes
    );
    onConfirmLocation(manualLoc);
  };

  return (
    <View style={styles.screen}>
      <Header title="Pickup Location" onBack={onBack} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.introBox}>
          <Text style={styles.screenTitle}>Where should the driver meet you?</Text>
          <Text style={styles.screenSubtitle}>
            Choose between automatic phone GPS or describe your village and landmark so the driver can navigate directly to you.
          </Text>
        </View>

        {gpsError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {gpsError}</Text>
          </View>
        ) : null}

        {/* TAB SELECTOR */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, selectedSource === 'GPS' && styles.tabButtonActive]}
            onPress={() => setSelectedSource('GPS')}
            activeOpacity={0.8}
          >
            <Text style={styles.tabIcon}>🛰️</Text>
            <Text style={[styles.tabText, selectedSource === 'GPS' && styles.tabTextActive]}>
              Auto GPS Location
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, selectedSource === 'MANUAL' && styles.tabButtonActive]}
            onPress={() => setSelectedSource('MANUAL')}
            activeOpacity={0.8}
          >
            <Text style={styles.tabIcon}>📍</Text>
            <Text style={[styles.tabText, selectedSource === 'MANUAL' && styles.tabTextActive]}>
              Manual Landmark
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB 1: GPS CONTENT */}
        {selectedSource === 'GPS' ? (
          <Card style={styles.gpsCard}>
            <View style={styles.gpsHeaderRow}>
              <Text style={styles.sectionHeading}>GPS Satellite Fix</Text>
              {gpsLocation ? (
                <View style={styles.accuracyTag}>
                  <Text style={styles.accuracyTagText}>✓ High Accuracy (±10m)</Text>
                </View>
              ) : null}
            </View>

            {gpsLoading ? (
              <View style={styles.gpsLoadingBox}>
                <ActivityIndicator size="large" color={colors.healthcare.primary} />
                <Text style={styles.gpsLoadingText}>Acquiring device satellite position...</Text>
              </View>
            ) : gpsLocation?.coords ? (
              <View style={styles.gpsResultBox}>
                <Text style={styles.gpsDetectedArea}>
                  📍 {gpsLocation.villageCommunity || 'GPS Position Locked'}
                </Text>
                <Text style={styles.coordsSub}>
                  Lat: {gpsLocation.coords.latitude.toFixed(5)}, Long: {gpsLocation.coords.longitude.toFixed(5)}
                </Text>

                <View style={styles.optionalNoteDivider} />
                <Text style={styles.optionalPrompt}>
                  Help driver pinpoint you (Optional landmark):
                </Text>
                <Input
                  label="Nearest Landmark"
                  placeholder="e.g. Near Mosque Water Pump, Yellow Gate"
                  value={landmark}
                  onChangeText={setLandmark}
                  helperText="Local landmark to help driver approach"
                />
              </View>
            ) : (
              <View style={styles.noGpsBox}>
                <Text style={styles.noGpsText}>
                  GPS position has not been acquired yet. Tap the button below or switch to manual landmark entry.
                </Text>
              </View>
            )}

            <Button
              title={gpsLoading ? 'Detecting Location...' : '🛰️ Re-Detect Current GPS Location'}
              variant="secondary"
              size="md"
              loading={gpsLoading}
              onPress={fetchGps}
              style={styles.reDetectBtn}
            />
          </Card>
        ) : (
          /* TAB 2: MANUAL LANDMARK ENTRY */
          <Card style={styles.manualCard}>
            <Text style={styles.sectionHeading}>Village, Landmark & Directions</Text>
            <Text style={styles.sectionSub}>
              Recommended for rural communities, remote compounds, or indoor locations where GPS satellite signal may be weak.
            </Text>

            <Input
              label="Community, Village or Neighborhood"
              placeholder="e.g. Karu Village, Nyanya Gwandara"
              value={community}
              onChangeText={setCommunity}
              required
            />

            <Input
              label="Prominent Landmark"
              placeholder="e.g. Behind Central Mosque Water Pump"
              value={landmark}
              onChangeText={setLandmark}
              required
              helperText="The landmark where the responder should head"
            />

            <Input
              label="Compound or Street Address"
              placeholder="e.g. House 12, Zone 4"
              value={streetAddress}
              onChangeText={setStreetAddress}
            />

            <Input
              label="Additional Navigation Directions"
              placeholder="e.g. Call when you reach the primary school junction"
              value={directionsNotes}
              onChangeText={setDirectionsNotes}
              multiline
              numberOfLines={3}
              helperText="Helpful instructions for the rider or driver"
            />
          </Card>
        )}

        <Button
          title="Confirm & Save Pickup Location"
          variant="primary"
          size="lg"
          onPress={handleConfirm}
          style={styles.confirmBtn}
        />
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
  introBox: {
    marginBottom: spacing.md,
  },
  screenTitle: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  screenSubtitle: {
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.surfaceAlt,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: colors.neutral.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.neutral.textSecondary,
  },
  tabTextActive: {
    color: colors.healthcare.primary,
    fontWeight: '800',
  },
  gpsCard: {
    marginBottom: spacing.md,
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
  },
  sectionSub: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  accuracyTag: {
    backgroundColor: colors.semantic.emeraldBg,
    borderColor: colors.semantic.emeraldBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  accuracyTagText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    color: colors.semantic.emerald,
  },
  gpsLoadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  gpsLoadingText: {
    ...typography.body,
    color: colors.neutral.textSecondary,
  },
  gpsResultBox: {
    backgroundColor: colors.neutral.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  gpsDetectedArea: {
    ...typography.bodyLarge,
    fontWeight: '800',
    color: colors.neutral.textPrimary,
  },
  coordsSub: {
    ...typography.caption,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  optionalNoteDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.md,
  },
  optionalPrompt: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  noGpsBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  noGpsText: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  reDetectBtn: {
    marginTop: spacing.xs,
  },
  manualCard: {
    marginBottom: spacing.md,
  },
  confirmBtn: {
    marginVertical: spacing.sm,
  },
});
