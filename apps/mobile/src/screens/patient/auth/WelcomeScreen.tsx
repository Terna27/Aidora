import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import { ConnectivityBanner } from '../../../components/common/ConnectivityBanner';

interface WelcomeScreenProps {
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
  onQuickDemoLogin: () => void;
  onSwitchToResponderPortal?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onNavigateLogin,
  onNavigateRegister,
  onQuickDemoLogin,
  onSwitchToResponderPortal,
}) => {
  const handleCallHotline = () => {
    Linking.openURL('tel:112').catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ConnectivityBanner isMockMode={true} />

      {/* BRAND HERO HEADER */}
      <View style={styles.brandContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>🚑</Text>
        </View>
        <Text style={styles.appName}>RideRoute</Text>
        <Text style={styles.appTagline}>Maternal Emergency Transportation Network</Text>
      </View>

      {/* MISSION CARD WITH HEALTHCARE METRICS */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Rapid emergency rides for mothers</Text>
        <Text style={styles.infoBody}>
          RideRoute pairs expectant mothers with verified local motorcycle riders and taxi drivers to reach clinical delivery centers swiftly and safely.
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>&lt; 8 min</Text>
            <Text style={styles.metricLbl}>Target Response</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>100%</Text>
            <Text style={styles.metricLbl}>Verified Drivers</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricVal}>Direct</Text>
            <Text style={styles.metricLbl}>Clinic Transfer</Text>
          </View>
        </View>
      </View>

      <SafetyBanner />

      {/* ACTION BUTTONS */}
      <View style={styles.actionsContainer}>
        <Button
          title="Create Patient Account"
          variant="primary"
          size="lg"
          onPress={onNavigateRegister}
          style={styles.actionBtn}
        />

        <Button
          title="Sign In to Existing Account"
          variant="outline"
          size="lg"
          onPress={onNavigateLogin}
          style={styles.actionBtn}
        />

        {/* Demo Fast Track */}
        <TouchableOpacity
          onPress={onQuickDemoLogin}
          style={styles.demoButton}
          activeOpacity={0.8}
        >
          <Text style={styles.demoButtonText}>⚡ Quick Demo Sign-In (Fatima Bello)</Text>
        </TouchableOpacity>

        {/* Portal Switcher to Driver/Responder Portal */}
        {onSwitchToResponderPortal && (
          <TouchableOpacity
            onPress={onSwitchToResponderPortal}
            style={styles.portalSwitcherBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.portalSwitcherText}>🏍️ Switch to Driver / Responder Portal ➔</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* DIRECT CRISIS HOTLINE SHORTCUT */}
      <View style={styles.hotlineSection}>
        <Text style={styles.hotlineLabel}>Immediate Life-Threatening Obstetric Crisis?</Text>
        <TouchableOpacity
          onPress={handleCallHotline}
          style={styles.hotlineBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.hotlineBtnText}>📞 Dial 112 National Emergency Line</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  brandContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.healthcare.light,
    borderWidth: 2,
    borderColor: colors.healthcare.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoIcon: {
    fontSize: 32,
  },
  appName: {
    ...typography.h1,
    color: colors.neutral.textPrimary,
  },
  appTagline: {
    ...typography.caption,
    fontSize: 13,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: colors.neutral.white,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoTitle: {
    ...typography.h2,
    fontSize: 19,
    color: colors.neutral.textPrimary,
    marginBottom: spacing.xs,
  },
  infoBody: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral.surfaceAlt,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    ...typography.bodyLarge,
    fontWeight: '800',
    color: colors.healthcare.primary,
  },
  metricLbl: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '700',
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.neutral.borderStrong,
  },
  actionsContainer: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  actionBtn: {
    width: '100%',
  },
  demoButton: {
    backgroundColor: colors.healthcare.light,
    borderColor: colors.healthcare.border,
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  demoButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.healthcare.primary,
  },
  portalSwitcherBtn: {
    backgroundColor: colors.neutral.surfaceAlt,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.borderStrong,
  },
  portalSwitcherText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
  },
  hotlineSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    alignItems: 'center',
  },
  hotlineLabel: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  hotlineBtn: {
    backgroundColor: colors.emergency.light,
    borderColor: colors.emergency.border,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  hotlineBtnText: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.emergency.primary,
  },
});
