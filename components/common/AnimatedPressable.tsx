// =============================================================================
// ANIMATED PRESSABLE - Shared press animation wrapper
// =============================================================================
// Provides consistent spring-scale press feedback + optional haptic across all
// tappable cards and widgets. Uses Reanimated withSpring for smooth feel.
// =============================================================================

import React, { useCallback } from 'react';
import { GestureResponderEvent, Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = { damping: 15, stiffness: 400 };
const DEFAULT_SCALE = 0.98;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AnimatedPressableProps extends PressableProps {
  /** Disable spring animation (renders plain Pressable). Default: true */
  animated?: boolean;
  /** Scale target when pressed. Default: 0.98 */
  scaleValue?: number;
  /** Fire hapticLight() on press. Default: true */
  haptic?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function AnimatedPressable({
  animated = true,
  scaleValue = DEFAULT_SCALE,
  haptic = true,
  onPress,
  onPressIn,
  onPressOut,
  style,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      if (animated && !disabled) {
        scale.value = withSpring(scaleValue, SPRING_CONFIG);
      }
      onPressIn?.(e);
    },
    [animated, disabled, scaleValue, onPressIn, scale],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      if (animated && !disabled) {
        scale.value = withSpring(1, SPRING_CONFIG);
      }
      onPressOut?.(e);
    },
    [animated, disabled, onPressOut, scale],
  );

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      if (haptic) hapticLight();
      onPress?.(e);
    },
    [haptic, onPress],
  );

  if (!animated) {
    return (
      <Pressable
        style={style}
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        {...rest}
      />
    );
  }

  return (
    <ReanimatedPressable
      style={[style as StyleProp<ViewStyle>, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...rest}
    />
  );
}
