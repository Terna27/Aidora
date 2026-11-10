import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface SafetyBannerProps {
  onDismiss?: () => void;
  compact?: boolean;
}

export const SafetyBanner: React.FC<SafetyBannerProps> = ({
  onDismiss,
  compact = false,
}) => {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.iconWrapper}>
        <Text style={styles.icon}>🛡️</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.badge}>TRANSPORTATION SERVICE ONLY</Text>
        <Text style={styles.text}>
          RideRoute coordinates emergency transportation with local verified drivers. Drivers are transportation providers, not medical professionals. In critical distress, dial 112 immediately.
        </Text>
      </View>
      {onDismiss ? (
        <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.safety.bannerBg,
    borderColor: colors.safety.bannerBorder,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  compact: {
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  iconWrapper: {
    marginTop: 1,
  },
  icon: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  badge: {
    ...typography.label,
    fontSize: 9,
    color: colors.safety.bannerText,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  text: {
    ...typography.caption,
    fontSize: 11,
    color: colors.safety.bannerText,
    lineHeight: 16,
  },
  dismissBtn: {
    padding: 2,
  },
  dismissText: {
    fontSize: 14,
    color: colors.safety.bannerText,
    fontWeight: '700',
  },
});
