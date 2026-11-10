import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'highlight' | 'emergency' | 'outlined' | 'success' | 'warning';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
}) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'highlight' && styles.highlight,
        variant === 'emergency' && styles.emergency,
        variant === 'outlined' && styles.outlined,
        variant === 'success' && styles.success,
        variant === 'warning' && styles.warning,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  highlight: {
    borderColor: colors.healthcare.border,
    backgroundColor: colors.healthcare.light,
  },
  emergency: {
    borderColor: colors.emergency.border,
    backgroundColor: colors.emergency.light,
  },
  outlined: {
    shadowOpacity: 0,
    elevation: 0,
    borderColor: colors.neutral.borderStrong,
  },
  success: {
    borderColor: colors.semantic.emeraldBorder,
    backgroundColor: colors.semantic.emeraldBg,
  },
  warning: {
    borderColor: colors.semantic.amberBorder,
    backgroundColor: colors.semantic.amberBg,
  },
});
