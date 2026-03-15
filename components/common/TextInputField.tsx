// =============================================================================
// TEXT INPUT FIELD - Themed form input with label, error, and password toggle
// =============================================================================
// Standardizes form inputs across the app. NOT for chat inputs or search bars
// — those have specialized UX. This is for labeled form fields.
//
// Usage:
//   <TextInputField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
//   <TextInputField label="Password" value={pw} onChangeText={setPw} password />
//   <TextInputField label="Name" value={name} onChangeText={setName} error={nameError} />
// =============================================================================

import React, { forwardRef, useState, useCallback } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, sizing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TextInputFieldProps extends Omit<TextInputProps, 'style'> {
  /** Label shown above the input */
  label?: string;
  /** Error message shown below the input (also colors border red) */
  error?: string;
  /** Enable password mode with show/hide toggle */
  password?: boolean;
  /** Override container style (includes label + input + error) */
  containerStyle?: StyleProp<ViewStyle>;
  /** Override input style */
  inputStyle?: StyleProp<ViewStyle>;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const TextInputField = forwardRef<TextInput, TextInputFieldProps>(
  function TextInputField(
    {
      label,
      error,
      password = false,
      containerStyle,
      inputStyle,
      editable = true,
      ...inputProps
    },
    ref,
  ) {
    const { colors } = useTheme();
    const [showPassword, setShowPassword] = useState(false);

    const togglePassword = useCallback(() => {
      hapticLight();
      setShowPassword(prev => !prev);
    }, []);

    const borderColor = error ? colors.error : colors.border;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        )}

        {password ? (
          <View
            style={[
              styles.inputWrapper,
              styles.passwordWrapper,
              { backgroundColor: colors.background, borderColor },
            ]}
          >
            <TextInput
              ref={ref}
              style={[styles.passwordInput, { color: colors.text }, inputStyle]}
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={!showPassword}
              editable={editable}
              {...inputProps}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={togglePassword}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
        ) : (
          <TextInput
            ref={ref}
            style={[
              styles.inputWrapper,
              styles.input,
              { backgroundColor: colors.background, borderColor, color: colors.text },
              inputStyle,
            ]}
            placeholderTextColor={colors.textTertiary}
            editable={editable}
            {...inputProps}
          />
        )}

        {error && (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        )}
      </View>
    );
  },
);

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },

  inputWrapper: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
  },

  input: {
    paddingHorizontal: sizing.input.paddingHorizontal,
    paddingVertical: sizing.input.paddingVertical,
    fontSize: typography.size.md,
  },

  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: sizing.input.paddingHorizontal,
    paddingVertical: sizing.input.paddingVertical,
    fontSize: typography.size.md,
  },

  passwordToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  error: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },
});
