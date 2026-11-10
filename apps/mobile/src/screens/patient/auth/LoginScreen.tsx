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
import { useAuth } from '../../../context/AuthContext';

interface LoginScreenProps {
  onBack: () => void;
  onNavigateRegister: () => void;
  onNavigateForgotPassword: () => void;
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onBack,
  onNavigateRegister,
  onNavigateForgotPassword,
  onLoginSuccess,
}) => {
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your registered phone number');
      return;
    }

    setLoading(true);
    try {
      await login({ phoneNumber: phoneNumber.trim(), password });
      onLoginSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setPhoneNumber('08012345678');
    setPassword('secret123');
    setErrorMessage(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header title="Patient Sign In" onBack={onBack} />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.introContainer}>
          <Text style={styles.badge}>MATERNAL ACCESS</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Enter your mobile number to access your maternal emergency dashboard and SOS controls.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        <Input
          label="Mobile Phone Number"
          placeholder="e.g. 08012345678"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          autoComplete="tel"
          required
        />

        <Input
          label="Password (Optional for Demo)"
          placeholder="Enter your account password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          onPress={onNavigateForgotPassword}
          style={styles.forgotBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>Forgot password or lost phone?</Text>
        </TouchableOpacity>

        <Button
          title="Sign In to Patient Portal"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleLogin}
          style={styles.loginBtn}
        />

        {/* Demo Fast Track */}
        <TouchableOpacity
          onPress={handleFillDemo}
          style={styles.demoFillBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.demoFillText}>
            ⚡ Autofill Demo Credentials (Fatima Bello)
          </Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New to RideRoute? </Text>
          <TouchableOpacity onPress={onNavigateRegister} activeOpacity={0.7}>
            <Text style={styles.registerLink}>Create Account</Text>
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
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    paddingVertical: spacing.xs,
  },
  forgotText: {
    ...typography.caption,
    color: colors.healthcare.primary,
    fontWeight: '700',
  },
  loginBtn: {
    marginBottom: spacing.md,
  },
  demoFillBtn: {
    backgroundColor: colors.healthcare.light,
    borderColor: colors.healthcare.border,
    borderWidth: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  demoFillText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.healthcare.primary,
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
  registerLink: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '800',
  },
});
