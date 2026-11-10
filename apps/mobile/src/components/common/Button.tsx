import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

export type ButtonVariant = 'emergency' | 'primary' | 'secondary' | 'outline' | 'danger' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'sos';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  subtitle?: string;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  subtitle,
  accessibilityLabel,
}) => {
  if (size === 'sos') {
    return (
      <View style={styles.sosOuterRing}>
        <View style={styles.sosMiddleRing}>
          <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || 'Emergency SOS Request Ride'}
            style={[styles.sosButton, disabled && styles.disabled, style]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <>
                <Text style={styles.sosEmoji}>🚨</Text>
                <Text style={styles.sosTitle}>{title}</Text>
                {subtitle ? <Text style={styles.sosSubtitle}>{subtitle}</Text> : null}
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const getButtonStyles = (): StyleProp<ViewStyle> => {
    const list: StyleProp<ViewStyle>[] = [styles.base];

    switch (variant) {
      case 'emergency':
        list.push(styles.emergency);
        break;
      case 'primary':
        list.push(styles.primary);
        break;
      case 'secondary':
        list.push(styles.secondary);
        break;
      case 'outline':
        list.push(styles.outline);
        break;
      case 'danger':
        list.push(styles.danger);
        break;
      case 'text':
        list.push(styles.textVariant);
        break;
    }

    switch (size) {
      case 'sm':
        list.push(styles.sizeSm);
        break;
      case 'md':
        list.push(styles.sizeMd);
        break;
      case 'lg':
        list.push(styles.sizeLg);
        break;
    }

    if (disabled || loading) {
      list.push(styles.disabled);
    }

    if (style) {
      list.push(style);
    }

    return list;
  };

  const getTextStyles = (): StyleProp<TextStyle> => {
    const list: StyleProp<TextStyle>[] = [styles.baseText];

    switch (variant) {
      case 'emergency':
        list.push(styles.emergencyText);
        break;
      case 'primary':
      case 'danger':
        list.push(styles.primaryText);
        break;
      case 'secondary':
        list.push(styles.secondaryText);
        break;
      case 'outline':
        list.push(styles.outlineText);
        break;
      case 'text':
        list.push(styles.textVariantText);
        break;
    }

    if (textStyle) {
      list.push(textStyle);
    }

    return list;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={getButtonStyles()}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'text' ? colors.healthcare.primary : '#FFFFFF'}
          size="small"
        />
      ) : (
        <View style={styles.innerContent}>
          {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
          <Text style={getTextStyles()}>{title}</Text>
          {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  iconContainer: {
    marginRight: 4,
  },
  baseText: {
    ...typography.bodyLarge,
    textAlign: 'center',
  },
  primary: {
    backgroundColor: colors.healthcare.primary,
    shadowColor: colors.healthcare.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryText: {
    color: colors.neutral.white,
    fontWeight: '700',
  },
  secondary: {
    backgroundColor: colors.healthcare.light,
    borderWidth: 1.5,
    borderColor: colors.healthcare.border,
  },
  secondaryText: {
    color: colors.healthcare.primary,
    fontWeight: '700',
  },
  outline: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1.5,
    borderColor: colors.neutral.borderStrong,
  },
  outlineText: {
    color: colors.neutral.textPrimary,
    fontWeight: '700',
  },
  danger: {
    backgroundColor: colors.emergency.dark,
    shadowColor: colors.emergency.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  emergency: {
    backgroundColor: colors.emergency.primary,
    shadowColor: colors.emergency.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  emergencyText: {
    color: colors.neutral.white,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textVariant: {
    backgroundColor: 'transparent',
    minHeight: 40,
  },
  textVariantText: {
    color: colors.healthcare.primary,
    fontWeight: '700',
  },
  sizeSm: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    minHeight: 40,
  },
  sizeMd: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    minHeight: 48,
  },
  sizeLg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    minHeight: 56,
  },
  subtitleText: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },

  // Outstanding Concentric Glow SOS Component
  sosOuterRing: {
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: 'rgba(217, 45, 32, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  sosMiddleRing: {
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: 'rgba(217, 45, 32, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.emergency.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: colors.emergency.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  sosEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  sosTitle: {
    ...typography.sosButton,
    color: colors.neutral.white,
    textAlign: 'center',
  },
  sosSubtitle: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    marginTop: 2,
    textAlign: 'center',
  },
});
