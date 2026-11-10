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
import { colors, spacing, typography, borderRadius } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { Input } from '../../../components/common/Input';
import { Header } from '../../../components/common/Header';
import { useResponderAuth } from '../../../context/ResponderAuthContext';

interface ResponderLoginScreenProps {
  onBack: () => void;
  onNavigateRegister: () => void;
  onNavigateForgotPassword: () => void;
  onLoginSuccess: () => void;
}

export const ResponderLoginScreen: React.FC<ResponderLoginScreenProps> = ({
  onBack,
  onNavigateRegister,
  onNavigateForgotPassword,
  onLoginSuccess,
}) => {
  const { login, loginAsDemo } = useResponderAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your registered driver mobile number');
      return;
    }

    setLoading(true);
    try {
      await login(phoneNumber.trim(), password);
      onLoginSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed. Please check credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = async (responderId: string) => {
    setLoading(true);
    try {
      await loginAsDemo(responderId);
      onLoginSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Demo sign in failed';
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
      <Header title="Responder Sign In" onBack={onBack} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.introContainer}>
          <Text style={styles.badge}>TRANSPORTATION NETWORK</Text>
          <Text style={styles.title}>Welcome Back, Driver</Text>
          <Text style={styles.subtitle}>
            Sign in to access your availability toggle, receive emergency transport offers, and view trip records.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        <Input
          label="Registered Mobile Number"
          placeholder="e.g. 08031112233"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          required
        />

        <Input
          label="Password (Optional for Demo)"
          placeholder="Enter driver account password"
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
          title="Sign In to Driver Portal"
          variant="primary"
          size="lg"
          loading={loading}
          onPress={handleLogin}
          style={styles.loginBtn}
        />

        {/* Demo Fast Tracks */}
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>⚡ One-Tap Credentials (Simulated Development Only):</Text>
          <TouchableOpacity
            onPress={() => handleFillDemo('resp-201')}
            style={styles.demoItem}
            activeOpacity={0.8}
          >
            <Text style={styles.demoItemText}>
              🏍️ Ibrahim Suleiman (Motorcycle) [SIMULATED]
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleFillDemo('resp-202')}
            style={styles.demoItem}
            activeOpacity={0.8}
          >
            <Text style={styles.demoItemText}>
              🚕 Emmanuel Osei (Taxi Driver) [SIMULATED]
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Not registered as a responder? </Text>
          <TouchableOpacity onPress={onNavigateRegister} activeOpacity={0.7}>
            <Text style={styles.registerLink}>Register</Text>
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
  demoBox: {
    backgroundColor: colors.neutral.white,
    borderColor: colors.healthcare.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.xs + 2,
  },
  demoTitle: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.healthcare.dark,
    marginBottom: 2,
  },
  demoItem: {
    backgroundColor: colors.healthcare.light,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  demoItemText: {
    ...typography.caption,
    fontWeight: '700',
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
    fontWeight: '700',
  },
});
