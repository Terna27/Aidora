import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../../theme';
import { Button } from '../../../components/common/Button';
import { SafetyBanner } from '../../../components/common/SafetyBanner';
import { ConnectivityBanner } from '../../../components/common/ConnectivityBanner';

interface ResponderWelcomeScreenProps {
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
  onQuickDemoLogin: (responderId: string) => void;
  onSwitchToPatientPortal: () => void;
}

export const ResponderWelcomeScreen: React.FC<ResponderWelcomeScreenProps> = ({
  onNavigateLogin,
  onNavigateRegister,
  onQuickDemoLogin,
  onSwitchToPatientPortal,
}) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ConnectivityBanner isMockMode={true} />

      {/* BRAND HERO HEADER */}
      <View style={styles.brandContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>🏍️</Text>
        </View>
        <Text style={styles.portalBadge}>DRIVER & RESPONDER NETWORK</Text>
        <Text style={styles.appName}>RideRoute Drivers</Text>
        <Text style={styles.appTagline}>Emergency Maternal Transportation Network</Text>
      </View>

      {/* MISSION CARD WITH DISPATCH PERFORMANCE */}
      <View style={styles.missionCard}>
        <Text style={styles.missionTitle}>Emergency Maternal Transportation</Text>
        <Text style={styles.missionBody}>
          Connect expectant mothers in labor or obstetric distress with registered local commercial motorcycle riders and taxi drivers for safe transportation to healthcare facilities.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>Vetted</Text>
            <Text style={styles.statLabel}>Driver Network</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>Priority</Text>
            <Text style={styles.statLabel}>Local Dispatch</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>Direct</Text>
            <Text style={styles.statLabel}>Clinic Route</Text>
          </View>
        </View>
      </View>

      <SafetyBanner />

      {/* PRIMARY ACTIONS */}
      <View style={styles.actionsContainer}>
        <Button
          title="Register as New Driver"
          variant="primary"
          size="lg"
          onPress={onNavigateRegister}
          style={styles.actionBtn}
        />

        <Button
          title="Sign In to Driver Account"
          variant="outline"
          size="lg"
          onPress={onNavigateLogin}
          style={styles.actionBtn}
        />

        {/* DEMO FAST TRACKS */}
        <View style={styles.demoSection}>
          <Text style={styles.demoLabel}>⚡ Test Driver Accounts (Simulated Development Only):</Text>
          <TouchableOpacity
            onPress={() => onQuickDemoLogin('resp-201')}
            style={styles.demoBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.demoBtnText}>
              🏍️ Ibrahim Suleiman (Motorcycle • Verified) [SIMULATED]
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onQuickDemoLogin('resp-202')}
            style={styles.demoBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.demoBtnText}>
              🚕 Emmanuel Osei (Taxi Driver • Verified) [SIMULATED]
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onQuickDemoLogin('resp-203')}
            style={[styles.demoBtn, styles.demoBtnPending]}
            activeOpacity={0.8}
          >
            <Text style={styles.demoBtnTextPending}>
              ⏳ Chinedu Eze (New Driver • Verification Pending) [SIMULATED]
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SWITCH TO PATIENT PORTAL */}
      <View style={styles.switchPortalContainer}>
        <Text style={styles.switchLabel}>Are you an expectant mother or patient?</Text>
        <TouchableOpacity
          onPress={onSwitchToPatientPortal}
          style={styles.switchButton}
          activeOpacity={0.7}
        >
          <Text style={styles.switchButtonText}>➔ Switch to Patient Mobile Portal</Text>
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
    borderColor: colors.healthcare.border,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoIcon: {
    fontSize: 32,
  },
  portalBadge: {
    ...typography.label,
    fontSize: 9,
    color: colors.healthcare.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  appName: {
    ...typography.h1,
    color: colors.neutral.textPrimary,
  },
  appTagline: {
    ...typography.caption,
    fontSize: 12,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  missionCard: {
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
  missionTitle: {
    ...typography.h2,
    fontSize: 19,
    color: colors.neutral.textPrimary,
    marginBottom: spacing.xs,
  },
  missionBody: {
    ...typography.body,
    color: colors.neutral.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.neutral.surfaceAlt,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    ...typography.bodyLarge,
    fontWeight: '800',
    color: colors.healthcare.primary,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '700',
    color: colors.neutral.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
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
  demoSection: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.healthcare.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.xs + 2,
  },
  demoLabel: {
    ...typography.caption,
    fontWeight: '800',
    color: colors.healthcare.dark,
    marginBottom: 4,
  },
  demoBtn: {
    backgroundColor: colors.healthcare.light,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
  },
  demoBtnPending: {
    backgroundColor: colors.semantic.amberBg,
  },
  demoBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.healthcare.dark,
  },
  demoBtnTextPending: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.semantic.amber,
  },
  switchPortalContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  switchLabel: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  switchButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  switchButtonText: {
    ...typography.body,
    color: colors.healthcare.primary,
    fontWeight: '700',
  },
});
