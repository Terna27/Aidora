import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { EmergencyState, EMERGENCY_STATE_METADATA } from '../../types/emergency';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface StatusBadgeProps {
  state: EmergencyState;
  style?: ViewStyle;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  state,
  style,
  showDot = true,
}) => {
  const meta = EMERGENCY_STATE_METADATA[state] || {
    label: state,
    themeColor: colors.neutral.textSecondary,
  };

  const getBadgeColors = () => {
    switch (state) {
      case 'CREATED':
      case 'DISPATCHING':
      case 'REASSIGNING':
        return {
          bg: colors.semantic.amberBg,
          text: colors.semantic.amber,
          border: colors.semantic.amberBorder,
        };
      case 'ACCEPTED':
      case 'PICKUP_ARRIVED':
        return {
          bg: colors.semantic.blueBg,
          text: colors.semantic.blue,
          border: colors.semantic.blueBorder,
        };
      case 'PATIENT_ONBOARD':
      case 'HOSPITAL_SELECTED':
        return {
          bg: colors.semantic.purpleBg,
          text: colors.semantic.purple,
          border: colors.semantic.purpleBorder,
        };
      case 'IN_TRANSIT':
        return {
          bg: colors.healthcare.light,
          text: colors.healthcare.primary,
          border: colors.healthcare.border,
        };
      case 'ARRIVED':
      case 'COMPLETED':
        return {
          bg: colors.semantic.emeraldBg,
          text: colors.semantic.emerald,
          border: colors.semantic.emeraldBorder,
        };
      case 'EXPIRED':
      case 'ESCALATED':
      case 'FAILED_CONTACT':
        return {
          bg: colors.semantic.redBg,
          text: colors.semantic.red,
          border: colors.semantic.redBorder,
        };
      case 'CANCELLED':
      default:
        return {
          bg: colors.semantic.slateBg,
          text: colors.semantic.slate,
          border: colors.semantic.slateBorder,
        };
    }
  };

  const badgeColors = getBadgeColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeColors.bg,
          borderColor: badgeColors.border,
        },
        style,
      ]}
    >
      {showDot ? (
        <View style={[styles.dot, { backgroundColor: badgeColors.text }]} />
      ) : null}
      <Text
        style={[styles.badgeText, { color: badgeColors.text }]}
        numberOfLines={1}
      >
        {meta.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
