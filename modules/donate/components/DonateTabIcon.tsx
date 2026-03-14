// =============================================================================
// DONATE TAB ICON - Red heart with gentle pulse animation
// =============================================================================

import React, { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface DonateTabIconProps {
  focused: boolean;
  color: string;
}

export function DonateTabIcon({ focused, color }: DonateTabIconProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!focused) {
      // Gentle heartbeat: scale up then back, repeat with pause
      pulse.value = withRepeat(
        withSequence(
          withDelay(2000, withTiming(1.18, { duration: 200, easing: Easing.out(Easing.ease) })),
          withTiming(1, { duration: 150, easing: Easing.in(Easing.ease) }),
          withTiming(1.12, { duration: 160, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) }),
        ),
        -1, // infinite
      );
    } else {
      pulse.value = withTiming(1, { duration: 150 });
    }
    return () => cancelAnimation(pulse);
  }, [focused, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name={focused ? 'heart' : 'heart-outline'}
        size={24}
        color={color}
      />
    </Animated.View>
  );
}
