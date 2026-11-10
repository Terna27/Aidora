import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  containerStyle,
  required = false,
  style,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredStar}> *</Text> : null}
      </Text>
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : null,
          props.multiline ? styles.multiline : null,
          style,
        ]}
        placeholderTextColor={colors.neutral.textMuted}
        {...props}
      />
      {error ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md + 2,
  },
  label: {
    ...typography.label,
    color: colors.neutral.textPrimary,
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.4,
  },
  requiredStar: {
    color: colors.emergency.primary,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.neutral.textPrimary,
    minHeight: 50,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.emergency.primary,
    backgroundColor: colors.emergency.light,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  errorIcon: {
    fontSize: 12,
  },
  errorText: {
    ...typography.caption,
    color: colors.emergency.dark,
    fontWeight: '600',
  },
  helperText: {
    ...typography.caption,
    color: colors.neutral.textSecondary,
    marginTop: 4,
    fontSize: 12,
  },
});
