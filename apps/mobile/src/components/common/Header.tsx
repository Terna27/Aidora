import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: {
    label: string;
    onPress: () => void;
    isEmergency?: boolean;
  };
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftContainer}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            activeOpacity={0.7}
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.titleWrapper}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      {rightAction ? (
        <TouchableOpacity
          onPress={rightAction.onPress}
          style={[
            styles.rightButton,
            rightAction.isEmergency ? styles.rightEmergency : null,
          ]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.rightButtonText,
              rightAction.isEmergency ? styles.rightEmergencyText : null,
            ]}
          >
            {rightAction.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm + 2,
    marginRight: spacing.xs,
    minHeight: 44,
    minWidth: 44,
  },
  backArrow: {
    fontSize: 20,
    color: colors.healthcare.primary,
    fontWeight: '700',
    marginRight: 4,
  },
  backText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.healthcare.primary,
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.neutral.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.neutral.textSecondary,
    marginTop: 1,
  },
  rightButton: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.surfaceAlt,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral.borderStrong,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightButtonText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.neutral.textPrimary,
  },
  rightEmergency: {
    backgroundColor: colors.emergency.light,
    borderColor: colors.emergency.border,
  },
  rightEmergencyText: {
    color: colors.emergency.primary,
    fontWeight: '800',
  },
});
