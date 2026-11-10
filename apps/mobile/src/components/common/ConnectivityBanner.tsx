import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface ConnectivityBannerProps {
  isOffline?: boolean;
  isMockMode?: boolean;
}

export const ConnectivityBanner: React.FC<ConnectivityBannerProps> = ({
  isOffline = false,
  isMockMode = true,
}) => {
  if (!isOffline && !isMockMode) return null;

  return (
    <View
      style={[
        styles.banner,
        isOffline ? styles.offlineBanner : styles.mockBanner,
      ]}
    >
      <View style={[styles.dot, isOffline ? styles.offlineDot : styles.mockDot]} />
      <Text
        style={[
          styles.baseText,
          isOffline ? styles.offlineText : styles.mockText,
        ]}
      >
        {isOffline
          ? 'OFFLINE MODE: No internet connection. Emergency SMS / Phone fallback active.'
          : 'DEV SIMULATION MODE: Using mock emergency dispatch engine.'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  baseText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  offlineBanner: {
    backgroundColor: colors.semantic.redBg,
    borderColor: colors.semantic.redBorder,
    borderWidth: 1,
  },
  offlineDot: {
    backgroundColor: colors.semantic.red,
  },
  offlineText: {
    color: colors.semantic.red,
  },
  mockBanner: {
    backgroundColor: colors.healthcare.light,
    borderColor: colors.healthcare.border,
    borderWidth: 1,
  },
  mockDot: {
    backgroundColor: colors.healthcare.primary,
  },
  mockText: {
    color: colors.healthcare.primary,
  },
});
