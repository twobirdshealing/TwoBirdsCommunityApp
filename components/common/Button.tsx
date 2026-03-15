// =============================================================================
// BUTTON - Shared button component with variants, sizes, and states
// =============================================================================
// Built on AnimatedPressable for consistent spring-scale press feedback.
// Replaces 95+ inline button implementations across the app.
//
// Usage:
//   <Button title="Sign In" onPress={handleLogin} />
//   <Button title="Follow" variant="secondary" size="sm" onPress={handleFollow} />
//   <Button title="Delete" variant="destructive" onPress={handleDelete} loading={isDeleting} />
//   <Button icon="close" iconOnly onPress={handleClose} />
// =============================================================================

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, sizing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { AnimatedPressable, AnimatedPressableProps } from '@/components/common/AnimatedPressable';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends Omit<AnimatedPressableProps, 'style'> {
  /** Button label text (optional for iconOnly buttons) */
  title?: string;
  /** Visual style variant. Default: 'primary' */
  variant?: ButtonVariant;
  /** Size preset. Default: 'md' */
  size?: ButtonSize;
  /** Show loading spinner instead of text */
  loading?: boolean;
  /** Ionicons icon name, rendered left of title */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Render as circular icon-only button (title hidden) */
  iconOnly?: boolean;
  /** Override container style */
  style?: StyleProp<ViewStyle>;
  /** Override text style */
  textStyle?: StyleProp<TextStyle>;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Button({
  title = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconOnly = false,
  style,
  textStyle,
  ...pressableProps
}: ButtonProps) {
  const { colors } = useTheme();

  const variantStyles = useMemo(() => {
    switch (variant) {
      case 'primary':
        return {
          bg: colors.primary,
          text: colors.textInverse,
          border: undefined,
        };
      case 'secondary':
        return {
          bg: 'transparent',
          text: colors.primary,
          border: colors.border,
        };
      case 'text':
        return {
          bg: 'transparent',
          text: colors.primary,
          border: undefined,
        };
      case 'destructive':
        return {
          bg: colors.error,
          text: colors.textInverse,
          border: undefined,
        };
    }
  }, [variant, colors]);

  const sizeStyles = size === 'sm' ? styles.sm : styles.md;
  const fontSize = size === 'sm' ? typography.size.sm : typography.size.lg;
  const iconSize = size === 'sm' ? 16 : 20;

  const containerStyle: ViewStyle[] = [
    styles.base,
    sizeStyles,
    { backgroundColor: variantStyles.bg },
    variantStyles.border ? { borderWidth: 1, borderColor: variantStyles.border } : undefined,
    iconOnly ? styles.iconOnly : undefined,
    (disabled || loading) ? styles.disabled : undefined,
  ].filter(Boolean) as ViewStyle[];

  return (
    <AnimatedPressable
      style={[containerStyle, style]}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title || undefined}
      accessibilityState={{ disabled: disabled || loading }}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.text} size="small" />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={iconSize}
              color={variantStyles.text}
              style={!iconOnly ? styles.iconGap : undefined}
            />
          )}
          {!iconOnly && (
            <Text
              style={[
                styles.text,
                { color: variantStyles.text, fontSize },
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.borderRadius.md,
  },

  md: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: sizing.height.button,
  },

  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: sizing.height.buttonSmall,
  },

  iconOnly: {
    width: sizing.touchTarget,
    height: sizing.touchTarget,
    borderRadius: sizing.borderRadius.full,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: undefined,
  },

  disabled: {
    opacity: 0.7,
  },

  text: {
    fontWeight: typography.weight.semibold,
  },

  iconGap: {
    marginRight: spacing.sm,
  },
});
