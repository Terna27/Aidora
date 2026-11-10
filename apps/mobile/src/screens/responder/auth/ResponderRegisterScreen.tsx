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
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import { VehicleType } from '../../../types/responder';
import { useResponderAuth } from '../../../context/ResponderAuthContext';

interface ResponderRegisterScreenProps {
  onBack: () => void;
  onNavigateLogin: () => void;
  onRegisterSuccess: () => void;
}

export const ResponderRegisterScreen: React.FC<ResponderRegisterScreenProps> = ({
  onBack,
  onNavigateLogin,
  onRegisterSuccess,
}) => {
  const { register } = useResponderAuth();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('MOTORCYCLE');
  const [makeModel, setMakeModel] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [color, setColor] = useState('');
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('');
  const [communityBase, setCommunityBase] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🏍️');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Full legal name is required.');
      return;
    }

    if (!phoneNumber.trim() || phoneNumber.trim().length < 8) {
      setErrorMessage('Valid mobile phone number required.');
      return;
    }

    if (!makeModel.trim()) {
      setErrorMessage('Vehicle make and model required (e.g., Bajaj Boxer 150).');
      return;
    }

    if (!licensePlate.trim()) {
      setErrorMessage('Vehicle registration license plate required.');
      return;
    }

    if (!driverLicenseNumber.trim()) {
      setErrorMessage('Valid Driver License number required.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('You must acknowledge that you coordinate transportation and are not a medical professional.');
      return;
    }

    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        vehicleType,
        vehicleMakeModel: makeModel.trim(),
        licensePlate: licensePlate.trim(),
        vehicleColor: color.trim() || 'Standard',
        driverLicenseNumber: driverLicenseNumber.trim(),
        communityBase: communityBase.trim() || 'Central',
        password,
        agreedToTerms,
      });
      onRegisterSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please check entries.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Driver Registration" onBack={onBack} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Register as Emergency Driver</Text>
        <Text style={styles.subtitle}>
          Sign up to provide maternal emergency transportation. All vehicles and drivers undergo dispatch verification.
        </Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* DRIVER INFO */}
        <Input
          label="Full Legal Name"
          placeholder="e.g. Ibrahim Suleiman"
          value={fullName}
          onChangeText={setFullName}
          required
        />

        {/* PROFILE PHOTO / AVATAR SELECTOR */}
        <View style={styles.avatarCard}>
          <Text style={styles.avatarLabel}>Driver Badge / Profile Avatar</Text>
          <View style={styles.avatarOptionsRow}>
            {['🏍️', '🚕', '🛡️', '👤', '⭐'].map((av) => (
              <TouchableOpacity
                key={av}
                onPress={() => setSelectedAvatar(av)}
                style={[
                  styles.avatarBubble,
                  selectedAvatar === av && styles.avatarBubbleSelected,
                ]}
              >
                <Text style={styles.avatarBubbleText}>{av}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Input
          label="Mobile Phone Number"
          placeholder="e.g. 08031112233"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          required
        />

        <Input
          label="Home Community / Base Area"
          placeholder="e.g. Karu, Nyanya, Garki"
          value={communityBase}
          onChangeText={setCommunityBase}
          helperText="Area where you are usually stationed"
        />

        {/* VEHICLE INFO */}
        <View style={styles.sectionDivider}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <Text style={styles.sectionSubtitle}>Select the vehicle you will use for emergency rides:</Text>
        </View>

        {/* VEHICLE TYPE SELECTOR */}
        <View style={styles.vehicleTypeRow}>
          <TouchableOpacity
            style={[
              styles.vehicleTypeCard,
              vehicleType === 'MOTORCYCLE' && styles.vehicleTypeCardActive,
            ]}
            onPress={() => setVehicleType('MOTORCYCLE')}
            activeOpacity={0.8}
          >
            <Text style={styles.vehicleIcon}>🏍️</Text>
            <Text
              style={[
                styles.vehicleTypeText,
                vehicleType === 'MOTORCYCLE' && styles.vehicleTypeTextActive,
              ]}
            >
              Motorcycle (Okada)
            </Text>
            <Text style={styles.vehicleTypeSub}>Fastest rural access</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.vehicleTypeCard,
              vehicleType === 'TAXI' && styles.vehicleTypeCardActive,
            ]}
            onPress={() => setVehicleType('TAXI')}
            activeOpacity={0.8}
          >
            <Text style={styles.vehicleIcon}>🚕</Text>
            <Text
              style={[
                styles.vehicleTypeText,
                vehicleType === 'TAXI' && styles.vehicleTypeTextActive,
              ]}
            >
              Taxi / Car
            </Text>
            <Text style={styles.vehicleTypeSub}>Enclosed passenger cabin</Text>
          </TouchableOpacity>
        </View>

        <Input
          label="Vehicle Make & Model"
          placeholder={vehicleType === 'MOTORCYCLE' ? 'e.g. Bajaj Boxer 150' : 'e.g. Toyota Corolla 2008'}
          value={makeModel}
          onChangeText={setMakeModel}
          required
        />

        <Input
          label="Vehicle License Plate"
          placeholder="e.g. KJA-482-XA"
          value={licensePlate}
          onChangeText={setLicensePlate}
          autoCapitalize="characters"
          required
        />

        <Input
          label="Vehicle Color"
          placeholder="e.g. Black, Silver, Blue"
          value={color}
          onChangeText={setColor}
        />

        <Input
          label="Driver License Number"
          placeholder="e.g. DL-ABJ-498210"
          value={driverLicenseNumber}
          onChangeText={setDriverLicenseNumber}
          autoCapitalize="characters"
          required
        />

        <Input
          label="Create Account Password (Optional for Demo)"
          placeholder="Choose a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <SafetyBanner />

        {/* TERMS CHECKBOX */}
        <TouchableOpacity
          onPress={() => setAgreedToTerms(!agreedToTerms)}
          style={styles.termsRow}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
            {agreedToTerms ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.termsText}>
            I confirm that I provide transportation only and am not a medical professional. I agree to drive safely, obey traffic regulations, and submit vehicle papers for dispatch verification.
          </Text>
        </TouchableOpacity>

        <Button
          title="Submit Registration for Verification"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleRegister}
          style={styles.submitBtn}
        />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already registered as a driver? </Text>
          <TouchableOpacity onPress={onNavigateLogin} activeOpacity={0.7}>
            <Text style={styles.loginLink}>Sign In</Text>
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
  title: {
    ...typography.h2,
    color: colors.neutral.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: colors.emergency.light,
    borderColor: colors.emergency.border,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    color: colors.emergency.dark,
    fontWeight: '700',
  },
  avatarCard: {
    backgroundColor: colors.neutral.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
  },
  avatarLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  avatarOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBubbleSelected: {
    borderColor: colors.healthcare.primary,
    backgroundColor: colors.healthcare.light,
  },
  avatarBubbleText: {
    fontSize: 20,
  },
  sectionDivider: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  vehicleTypeCard: {
    flex: 1,
    backgroundColor: colors.neutral.white,
    borderWidth: 1.5,
    borderColor: colors.neutral.borderStrong,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  vehicleTypeCardActive: {
    borderColor: colors.healthcare.primary,
    backgroundColor: colors.healthcare.light,
  },
  vehicleIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  vehicleTypeText: {
    ...typography.bodyLarge,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
    textAlign: 'center',
  },
  vehicleTypeTextActive: {
    color: colors.healthcare.primary,
  },
  vehicleTypeSub: {
    ...typography.caption,
    fontSize: 10,
    color: colors.neutral.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: spacing.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.healthcare.primary,
    backgroundColor: colors.neutral.white,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.healthcare.primary,
  },
  checkmark: {
    color: colors.neutral.white,
    fontWeight: '900',
    fontSize: 16,
  },
  termsText: {
    ...typography.caption,
    color: colors.neutral.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  submitBtn: {
    marginBottom: spacing.lg,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    color: colors.neutral.textSecondary,
  },
  loginLink: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '700',
  },
});
