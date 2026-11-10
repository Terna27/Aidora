import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Header } from '../../../components/common/Header';
import { Card } from '../../../components/common/Card';
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import { VERIFICATION_STATUS_METADATA, VehicleType } from '../../../types/responder';
import { useResponderAuth } from '../../../context/ResponderAuthContext';
import { serviceRegistry } from '../../../services/serviceRegistry';

interface ResponderProfileScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onSwitchToPatientPortal: () => void;
}

const AVATAR_OPTIONS = ['🏍️', '🚕', '🛡️', '⭐', '👤'];

export const ResponderProfileScreen: React.FC<ResponderProfileScreenProps> = ({
  onBack,
  onLogout,
  onSwitchToPatientPortal,
}) => {
  const { responder, stats, refreshState } = useResponderAuth();

  const [fullName, setFullName] = useState(responder?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(responder?.phoneNumber || '');
  const [communityBase, setCommunityBase] = useState(responder?.communityBase || '');
  const [vehicleType, setVehicleType] = useState<VehicleType>(responder?.vehicle.vehicleType || 'MOTORCYCLE');
  const [makeModel, setMakeModel] = useState(responder?.vehicle.makeModel || '');
  const [licensePlate, setLicensePlate] = useState(responder?.vehicle.licensePlate || '');
  const [color, setColor] = useState(responder?.vehicle.color || 'Standard');
  const [selectedAvatar, setSelectedAvatar] = useState(
    responder?.vehicle.vehicleType === 'MOTORCYCLE' ? '🏍️' : '🚕'
  );

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!responder) return null;

  const verificationMeta = VERIFICATION_STATUS_METADATA[responder.verificationStatus];

  const handleSaveProfile = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Full legal name is required.');
      return;
    }

    if (!makeModel.trim()) {
      setErrorMessage('Vehicle make and model is required.');
      return;
    }

    if (!licensePlate.trim()) {
      setErrorMessage('Vehicle license plate is required.');
      return;
    }

    setSaving(true);
    try {
      await serviceRegistry.responderAuthService.updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        communityBase: communityBase.trim(),
        vehicle: {
          ...responder.vehicle,
          vehicleType,
          makeModel: makeModel.trim(),
          licensePlate: licensePlate.trim().toUpperCase(),
          color: color.trim(),
        },
      });
      await refreshState();
      setSuccessMessage('Profile and vehicle documents updated successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save profile updates.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Driver Profile & Verification" onBack={onBack} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* DRIVER SUMMARY CARD */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarIcon}>{selectedAvatar}</Text>
          </View>

          <View style={styles.headerDetails}>
            <Text style={styles.driverName}>{responder.fullName}</Text>
            <Text style={styles.driverPhone}>{responder.phoneNumber}</Text>

            <View
              style={[
                styles.verificationBadge,
                { backgroundColor: verificationMeta.badgeColor + '20', borderColor: verificationMeta.badgeColor },
              ]}
            >
              <Text style={[styles.verificationBadgeText, { color: verificationMeta.badgeColor }]}>
                {verificationMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {/* AVATAR SELECTOR */}
        <View style={styles.avatarSelectorCard}>
          <Text style={styles.avatarSelectorTitle}>Select Driver Badge / Avatar Icon</Text>
          <View style={styles.avatarRow}>
            {AVATAR_OPTIONS.map((av) => (
              <TouchableOpacity
                key={av}
                onPress={() => setSelectedAvatar(av)}
                style={[
                  styles.avatarChoice,
                  selectedAvatar === av && styles.avatarChoiceSelected,
                ]}
              >
                <Text style={styles.avatarChoiceText}>{av}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✓ {successMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        {/* VERIFICATION CHECKLIST & RESTRICTIONS */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeading}>Verification & Compliance Checklist</Text>
            <View
              style={[
                styles.statusTag,
                { backgroundColor: verificationMeta.badgeColor + '20', borderColor: verificationMeta.badgeColor },
              ]}
            >
              <Text style={[styles.statusTagText, { color: verificationMeta.badgeColor }]}>
                {responder.verificationStatus}
              </Text>
            </View>
          </View>

          <Text style={styles.cardSub}>{verificationMeta.description}</Text>

          {responder.verificationStatus !== 'VERIFIED' ? (
            <View style={styles.restrictedNoticeBox}>
              <Text style={styles.restrictedNoticeText}>
                ⚠️ Restriction: Unverified responders cannot toggle online or receive real emergency assignments until approved by dispatch administration.
              </Text>
            </View>
          ) : null}

          <View style={styles.complianceRow}>
            <Text style={styles.checkIcon}>
              {responder.verificationStatus === 'VERIFIED' ? '✅' : '⏳'}
            </Text>
            <View style={styles.complianceTextWrapper}>
              <Text style={styles.complianceTitle}>Commercial Driver License</Text>
              <Text style={styles.complianceSub}>Number: {responder.driverLicenseNumber}</Text>
            </View>
          </View>

          <View style={styles.complianceRow}>
            <Text style={styles.checkIcon}>
              {responder.verificationStatus === 'VERIFIED' ? '✅' : '⏳'}
            </Text>
            <View style={styles.complianceTextWrapper}>
              <Text style={styles.complianceTitle}>Vehicle Registration</Text>
              <Text style={styles.complianceSub}>Plate: {responder.vehicle.licensePlate}</Text>
            </View>
          </View>

          <View style={styles.complianceRow}>
            <Text style={styles.checkIcon}>
              {responder.vehicle.insuranceValid ? '✅' : '⏳'}
            </Text>
            <View style={styles.complianceTextWrapper}>
              <Text style={styles.complianceTitle}>Third-Party Road Insurance</Text>
              <Text style={styles.complianceSub}>Valid Policy on File</Text>
            </View>
          </View>
        </Card>

        {/* SERVICE STATISTICS (SIMULATED DATA LABELED) */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeading}>Lifetime Performance</Text>
            <View style={styles.simulatedMiniTag}>
              <Text style={styles.simulatedMiniText}>Simulated Dev Data</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{stats?.totalCompletedTrips || responder.completedTripsCount}</Text>
              <Text style={styles.statLbl}>Rides Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>⭐ {responder.rating.toFixed(1)}</Text>
              <Text style={styles.statLbl}>Patient Rating</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{stats?.acceptanceRatePercent || 96}%</Text>
              <Text style={styles.statLbl}>Acceptance Rate</Text>
            </View>
          </View>
        </Card>

        {/* EDIT DETAILS */}
        <Card style={styles.card}>
          <Text style={styles.cardHeading}>Personal & Dispatch Details</Text>

          <Input
            label="Full Legal Name"
            value={fullName}
            onChangeText={setFullName}
            required
          />

          <Input
            label="Mobile Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            required
          />

          <Input
            label="Base Community / Dispatch Area"
            value={communityBase}
            onChangeText={setCommunityBase}
            helperText="The village or neighborhood where you are typically stationed"
          />
        </Card>

        {/* EDIT VEHICLE */}
        <Card style={styles.card}>
          <Text style={styles.cardHeading}>Vehicle Information</Text>

          {/* Vehicle Type Switcher */}
          <View style={styles.vehicleTypeSelectorRow}>
            <TouchableOpacity
              style={[
                styles.vehicleTypeBtn,
                vehicleType === 'MOTORCYCLE' && styles.vehicleTypeBtnActive,
              ]}
              onPress={() => setVehicleType('MOTORCYCLE')}
            >
              <Text style={styles.vehicleTypeIcon}>🏍️</Text>
              <Text
                style={[
                  styles.vehicleTypeLabel,
                  vehicleType === 'MOTORCYCLE' && styles.vehicleTypeLabelActive,
                ]}
              >
                Motorcycle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.vehicleTypeBtn,
                vehicleType === 'TAXI' && styles.vehicleTypeBtnActive,
              ]}
              onPress={() => setVehicleType('TAXI')}
            >
              <Text style={styles.vehicleTypeIcon}>🚕</Text>
              <Text
                style={[
                  styles.vehicleTypeLabel,
                  vehicleType === 'TAXI' && styles.vehicleTypeLabelActive,
                ]}
              >
                Taxi / Car
              </Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Vehicle Make & Model"
            value={makeModel}
            onChangeText={setMakeModel}
            required
          />

          <Input
            label="Vehicle License Plate"
            value={licensePlate}
            onChangeText={setLicensePlate}
            autoCapitalize="characters"
            required
          />

          <Input
            label="Vehicle Color"
            value={color}
            onChangeText={setColor}
          />
        </Card>

        <SafetyBanner />

        <Button
          title="Save Profile Updates"
          variant="primary"
          size="lg"
          loading={saving}
          onPress={handleSaveProfile}
          style={styles.saveBtn}
        />

        {/* LOGOUT & PORTAL SWITCH */}
        <View style={styles.footerActions}>
          <Button
            title="Sign Out of Driver Account"
            variant="outline"
            size="md"
            onPress={onLogout}
            style={styles.logoutBtn}
          />

          <TouchableOpacity onPress={onSwitchToPatientPortal} style={styles.switchPortalBtn}>
            <Text style={styles.switchPortalText}>➔ Switch to Patient Mobile Portal</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardContainer: {
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
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.healthcare.light,
    borderWidth: 2,
    borderColor: colors.healthcare.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarIcon: {
    fontSize: 32,
  },
  headerDetails: {
    flex: 1,
  },
  driverName: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
  },
  driverPhone: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  verificationBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginTop: 6,
  },
  verificationBadgeText: {
    ...typography.caption,
    fontWeight: '800',
    fontSize: 10,
  },
  avatarSelectorCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
  },
  avatarSelectorTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatarChoice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChoiceSelected: {
    borderColor: colors.healthcare.primary,
    backgroundColor: colors.healthcare.light,
  },
  avatarChoiceText: {
    fontSize: 20,
  },
  successBox: {
    backgroundColor: colors.semantic.emeraldBg,
    borderColor: colors.semantic.emeraldBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  successText: {
    ...typography.body,
    color: colors.semantic.emerald,
    fontWeight: '700',
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
  card: {
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardHeading: {
    ...typography.label,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
  },
  cardSub: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusTagText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '800',
  },
  simulatedMiniTag: {
    backgroundColor: colors.neutral.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  simulatedMiniText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '700',
    color: colors.neutral.textMuted,
  },
  restrictedNoticeBox: {
    backgroundColor: colors.semantic.amberBg,
    borderColor: colors.semantic.amberBorder,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  restrictedNoticeText: {
    ...typography.caption,
    color: colors.semantic.amber,
    fontWeight: '700',
    lineHeight: 16,
  },
  complianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm + 2,
  },
  checkIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  complianceTextWrapper: {
    flex: 1,
  },
  complianceTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
  },
  complianceSub: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
  },
  statLbl: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.neutral.border,
  },
  vehicleTypeSelectorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  vehicleTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.surfaceAlt,
    gap: 6,
  },
  vehicleTypeBtnActive: {
    borderColor: colors.healthcare.primary,
    backgroundColor: colors.healthcare.light,
  },
  vehicleTypeIcon: {
    fontSize: 18,
  },
  vehicleTypeLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.neutral.textSecondary,
  },
  vehicleTypeLabelActive: {
    color: colors.healthcare.dark,
    fontWeight: '800',
  },
  saveBtn: {
    marginVertical: spacing.md,
  },
  footerActions: {
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  logoutBtn: {
    width: '100%',
  },
  switchPortalBtn: {
    paddingVertical: spacing.md,
  },
  switchPortalText: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '700',
  },
});
