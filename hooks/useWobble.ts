// =============================================================================
// USE WOBBLE — Reusable wobble/shake animation hook
// =============================================================================
// Provides a rotation wobble effect with haptic feedback.
// Used by bottom tab buttons and the header avatar menu button.
// =============================================================================

import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { hapticHeavy } from '@/utils/haptics';
import { useCallback } from 'react';

export function useWobble() {
  const wobble = useSharedValue(0);

  const triggerWobble = useCallback(() => {
    hapticHeavy();
    wobble.value = withSequence(
      withTiming(1, { duration: 40 }),
      withTiming(-1, { duration: 80 }),
      withTiming(0, { duration: 40 }),
    );
  }, []);

  const wobbleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(wobble.value, [-1, 0, 1], [-8, 0, 8])}deg` }],
  }));

  return { triggerWobble, wobbleStyle };
}
