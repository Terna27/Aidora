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
import { useAuth } from '../../../context/AuthContext';

interface RegisterScreenProps {
  onBack: () => void;
  onNavigateLogin: () => void;
  onRegisterSuccess: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onBack,
  onNavigateLogin,
  onRegisterSuccess,
}) => {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [community, setCommunity] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [understoodTerms, setUnderstoodTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Please enter your full legal name');
      return;
    }

    if (!phoneNumber.trim() || phoneNumber.trim().length < 8) {
      setErrorMessage('Please enter a valid mobile phone number');
      return;
    }

    if (password && confirmPassword && password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (!understoodTerms) {
      setErrorMessage('Please confirm that you understand Aidora coordinates transportation and is not an ambulance or medical service.');
      return;
    }

    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim() || undefined,
        communityOrVillage: community.trim(),
        emergencyContactName: contactName.trim(),
        emergencyContactPhone: contactPhone.trim(),
        emergencyContactRelationship: contactRelation.trim() || 'Family',
        password,
        confirmPassword,
        agreedToTerms: understoodTerms,
      });
      onRegisterSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
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
      <Header title="Patient Account Setup" onBack={onBack} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.introContainer}>
          <Text style={styles.badge}>MATERNAL TRANSPORT NETWORK</Text>
          <Text style={styles.title}>Register for Emergency Rides</Text>
          <Text style={styles.subtitle}>
            Register your details so nearby verified motorcycle and taxi drivers can reach you quickly during labor or pregnancy emergencies.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        {/* PERSONAL DETAILS */}
        <Input
          label="Your Full Legal Name"
          placeholder="e.g. Fatima Bello"
          value={fullName}
          onChangeText={setFullName}
          required
        />

        <Input
          label="Mobile Phone Number"
          placeholder="e.g. 08012345678"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          required
        />

        <Input
          label="Email Address (Optional)"
          placeholder="e.g. fatima@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Input
          label="Community, Village or Settlement Area"
          placeholder="e.g. Karu Village, Nyanya Gwandara"
          value={community}
          onChangeText={setCommunity}
          helperText="Where you will typically request emergency pickup"
        />

        {/* EMERGENCY CONTACT DETAILS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Primary Emergency Contact</Text>
          <Text style={styles.sectionSubtitle}>
            A family member or neighbor who should be alerted when you request emergency transport.
          </Text>
        </View>

        <Input
          label="Contact Person Name"
          placeholder="e.g. Musa Bello"
          value={contactName}
          onChangeText={setContactName}
        />

        <Input
          label="Contact Person Phone"
          placeholder="e.g. 08098765432"
          value={contactPhone}
          onChangeText={setContactPhone}
          keyboardType="phone-pad"
        />

        <Input
          label="Relationship to You"
          placeholder="e.g. Husband, Sister, Mother, Neighbor"
          value={contactRelation}
          onChangeText={setContactRelation}
        />

        <Input
          label="Account Password (Optional for Demo)"
          placeholder="Create a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Input
          label="Confirm Password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <SafetyBanner />

        {/* UNDERSTOOD TERMS CHECKBOX */}
        <TouchableOpacity
          onPress={() => setUnderstoodTerms(!understoodTerms)}
          style={styles.termsRow}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, understoodTerms && styles.checkboxChecked]}>
            {understoodTerms ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={styles.termsText}>
            I confirm that I understand Aidora coordinates emergency transportation with local drivers. Responders are transportation providers, not doctors or paramedics.
          </Text>
        </TouchableOpacity>

        <Button
          title="Complete Registration"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleRegister}
          style={styles.submitBtn}
        />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already registered? </Text>
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
  introContainer: {
    marginBottom: spacing.lg,
  },
  badge: {
    ...typography.label,
    fontSize: 10,
    color: colors.healthcare.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    ...typography.h1,
    color: colors.neutral.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
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
  sectionHeader: {
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
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.healthcare.primary,
    backgroundColor: colors.neutral.white,
    marginRight: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.healthcare.primary,
  },
  checkmark: {
    color: colors.neutral.white,
    fontWeight: '900',
    fontSize: 14,
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
