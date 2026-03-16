// =============================================================================
// COMPLETION CELEBRATION - Confetti modal shown when a course is 100% complete
// =============================================================================
// Replaces the basic Alert.alert with a visually engaging celebration.
// Uses Reanimated for confetti particle animation (no new dependencies).
// =============================================================================

import React, { useEffect, useMemo } from 'react';
import { Dimensions, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { Button } from '@/components/common/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CompletionCelebrationProps {
  visible: boolean;
  courseTitle: string;
  onDismiss: () => void;
  onViewCertificate?: () => void;
}

// Confetti particle config
const CONFETTI_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF9FF3'];
const CONFETTI_COUNT = 30;

interface ConfettiParticle {
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
}

// -----------------------------------------------------------------------------
// Confetti Particle
// -----------------------------------------------------------------------------

function ConfettiPiece({ particle }: { particle: ConfettiParticle }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      particle.delay,
      withTiming(SCREEN_HEIGHT + 50, {
        duration: particle.duration,
        easing: Easing.in(Easing.quad),
      })
    );
    translateX.value = withDelay(
      particle.delay,
      withTiming((Math.random() - 0.5) * 100, {
        duration: particle.duration,
        easing: Easing.inOut(Easing.sin),
      })
    );
    rotate.value = withDelay(
      particle.delay,
      withTiming(particle.rotation, {
        duration: particle.duration,
        easing: Easing.linear,
      })
    );
    opacity.value = withDelay(
      particle.delay + particle.duration * 0.7,
      withTiming(0, { duration: particle.duration * 0.3 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: particle.x,
          top: -20,
          width: particle.size,
          height: particle.size * 0.6,
          backgroundColor: particle.color,
          borderRadius: 2,
        },
        animatedStyle,
      ]}
    />
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CompletionCelebration({
  visible,
  courseTitle,
  onDismiss,
  onViewCertificate,
}: CompletionCelebrationProps) {
  const { colors: themeColors } = useTheme();

  // Card entrance animation
  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      cardScale.value = withSequence(
        withTiming(1.05, { duration: 300, easing: Easing.out(Easing.back(1.5)) }),
        withTiming(1, { duration: 150 })
      );
      cardOpacity.value = withTiming(1, { duration: 300 });
    } else {
      cardScale.value = 0.8;
      cardOpacity.value = 0;
    }
  }, [visible]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  // Generate confetti particles
  const particles = useMemo<ConfettiParticle[]>(() =>
    Array.from({ length: CONFETTI_COUNT }, () => ({
      x: Math.random() * SCREEN_WIDTH,
      delay: Math.random() * 800,
      duration: 2000 + Math.random() * 1500,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 8 + Math.random() * 8,
      rotation: 360 + Math.random() * 720,
    })),
  []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        {/* Confetti */}
        {particles.map((particle, i) => (
          <ConfettiPiece key={i} particle={particle} />
        ))}

        {/* Celebration Card */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: themeColors.surface },
            cardAnimStyle,
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: themeColors.success }]}>
            <Ionicons name="trophy" size={40} color="#fff" />
          </View>

          <Text style={[styles.title, { color: themeColors.text }]}>
            Congratulations!
          </Text>

          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            You've completed
          </Text>

          <Text style={[styles.courseTitle, { color: themeColors.text }]} numberOfLines={2}>
            {courseTitle}
          </Text>

          {onViewCertificate && (
            <Button
              title="View Certificate"
              icon="ribbon-outline"
              onPress={onViewCertificate}
              style={styles.certificateButton}
            />
          )}

          <Button
            title="Continue"
            onPress={onDismiss}
            variant="secondary"
            style={styles.dismissButton}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: sizing.borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },

  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },

  courseTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  certificateButton: {
    width: '100%',
  },

  dismissButton: {
    width: '100%',
  },
});
