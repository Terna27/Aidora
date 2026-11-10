import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Header } from '../../../components/common/Header';
import { serviceRegistry } from '../../../services/serviceRegistry';

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onNavigateLogin: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBack,
  onNavigateLogin,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your registered mobile phone number');
      return;
    }

    setLoading(true);
    try {
      const res = await serviceRegistry.authService.forgotPassword(phoneNumber.trim());
      setStatusMessage(res.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password reset request failed';
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
      <Header title="Patient Password Recovery" onBack={onBack} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.introContainer}>
          <Text style={styles.badge}>ACCOUNT RECOVERY</Text>
          <Text style={styles.title}>Reset Account Password</Text>
          <Text style={styles.subtitle}>
            Enter your registered mobile phone number. We will send a secure SMS one-time recovery passcode.
          </Text>
        </View>

        {statusMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✓ {statusMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        <Input
          label="Registered Phone Number"
          placeholder="e.g. 08012345678"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          required
        />

        <Button
          title="Send SMS Recovery Code"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleReset}
          style={styles.actionBtn}
        />

        <Button
          title="Back to Sign In"
          variant="text"
          onPress={onNavigateLogin}
        />
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
  successBox: {
    backgroundColor: colors.semantic.emeraldBg,
    borderColor: colors.semantic.emeraldBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.caption,
    color: colors.emergency.dark,
    fontWeight: '700',
  },
  actionBtn: {
    marginBottom: spacing.md,
  },
});
