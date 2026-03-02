// =============================================================================
// AUDIO CONTROLS - Full player controls for audiobook playback
// =============================================================================
// Play/pause, skip ±30s, chapter prev/next, draggable progress bar.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAudioPlayerContext, formatTime } from '@/contexts/AudioPlayerContext';
import { spacing, typography } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function AudioControls() {
  const { colors: themeColors } = useTheme();
  const {
    isPlaying,
    currentTime,
    duration,
    currentChapterIndex,
    currentBook,
    togglePlayPause,
    skipForward,
    skipBackward,
    nextChapter,
    prevChapter,
    seekTo,
  } = useAudioPlayerContext();

  const chapters = currentBook?.chapters ?? [];
  const currentChapter = currentChapterIndex >= 0 ? chapters[currentChapterIndex] : null;
  const progress = duration > 0 ? currentTime / duration : 0;

  // ---------------------------------------------------------------------------
  // Draggable progress bar
  // ---------------------------------------------------------------------------

  const [barWidth, setBarWidth] = useState(0);
  const isDragging = useSharedValue(false);
  const dragProgress = useSharedValue(0);

  // Sync drag position with real playback when not dragging
  useEffect(() => {
    if (!isDragging.value) {
      dragProgress.value = progress;
    }
  }, [progress, isDragging, dragProgress]);

  const commitSeek = useCallback(
    (ratio: number) => {
      seekTo(ratio * duration);
    },
    [seekTo, duration],
  );

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      isDragging.value = true;
      if (barWidth > 0) {
        dragProgress.value = Math.max(0, Math.min(1, e.x / barWidth));
      }
    })
    .onUpdate((e) => {
      'worklet';
      if (barWidth > 0) {
        dragProgress.value = Math.max(0, Math.min(1, e.x / barWidth));
      }
    })
    .onEnd(() => {
      'worklet';
      isDragging.value = false;
      runOnJS(commitSeek)(dragProgress.value);
    })
    .minDistance(0)
    .hitSlop({ top: 16, bottom: 16 });

  const tapGesture = Gesture.Tap().onEnd((e) => {
    'worklet';
    if (barWidth > 0) {
      const ratio = Math.max(0, Math.min(1, e.x / barWidth));
      dragProgress.value = ratio;
      runOnJS(commitSeek)(ratio);
    }
  });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${dragProgress.value * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${dragProgress.value * 100}%`,
  }));

  // ---------------------------------------------------------------------------
  // Play button bounce animation
  // ---------------------------------------------------------------------------

  const playScale = useSharedValue(1);

  const onPlayPress = useCallback(() => {
    hapticLight();
    playScale.value = withSequence(
      withTiming(0.88, { duration: 80 }),
      withTiming(1, { duration: 140 }),
    );
    togglePlayPause();
  }, [togglePlayPause, playScale]);

  const playAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Chapter Display */}
      {currentChapter && (
        <View style={styles.chapterDisplay}>
          <View style={styles.chapterLabelRow}>
            {isPlaying && (
              <View style={[styles.nowPlayingDot, { backgroundColor: themeColors.primary }]} />
            )}
            <Text
              style={[styles.chapterLabel, { color: themeColors.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {currentChapter.label}
            </Text>
          </View>
          <Text style={[styles.chapterTitle, { color: themeColors.text }]} numberOfLines={1}>
            {currentChapter.title}
          </Text>
        </View>
      )}

      {/* Progress Bar — tap or drag to seek */}
      <View style={styles.progressSection}>
        <GestureDetector gesture={composed}>
          <View
            style={[styles.progressBarBg, { backgroundColor: withOpacity(themeColors.primary, 0.15) }]}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[styles.progressBarFill, fillStyle]}
            >
              <LinearGradient
                colors={[themeColors.primaryLight ?? themeColors.primary, themeColors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View
              style={[styles.seekThumb, { backgroundColor: themeColors.primary }, thumbStyle]}
            />
          </View>
        </GestureDetector>

        {/* Time labels */}
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: themeColors.textTertiary }]}>
            {formatTime(currentTime)}
          </Text>
          <Text style={[styles.timeText, { color: themeColors.textTertiary }]}>
            -{formatTime(Math.max(0, duration - currentTime))}
          </Text>
        </View>
      </View>

      {/* Main Controls */}
      <View style={styles.controls}>
        {/* Previous Chapter */}
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed && { opacity: 0.5 }]}
          onPress={() => { hapticLight(); prevChapter(); }}
          hitSlop={12}
        >
          <Ionicons name="play-skip-back" size={24} color={themeColors.text} />
        </Pressable>

        {/* Rewind 30s */}
        <Pressable
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
          onPress={() => { hapticLight(); skipBackward(); }}
          hitSlop={12}
        >
          <Ionicons name="refresh-outline" size={32} color={themeColors.text} style={styles.skipIconBack} />
          <Text style={[styles.skipLabel, { color: themeColors.text }]}>30</Text>
        </Pressable>

        {/* Play / Pause — animated bounce */}
        <Pressable onPress={onPlayPress}>
          <Animated.View
            style={[styles.playBtn, { backgroundColor: themeColors.primary }, playAnimStyle]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color={themeColors.textInverse}
              style={!isPlaying ? { marginLeft: 3 } : undefined}
            />
          </Animated.View>
        </Pressable>

        {/* Forward 30s */}
        <Pressable
          style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.5 }]}
          onPress={() => { hapticLight(); skipForward(); }}
          hitSlop={12}
        >
          <Ionicons name="refresh-outline" size={32} color={themeColors.text} style={styles.skipIconForward} />
          <Text style={[styles.skipLabel, { color: themeColors.text }]}>30</Text>
        </Pressable>

        {/* Next Chapter */}
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed && { opacity: 0.5 }]}
          onPress={() => { hapticLight(); nextChapter(); }}
          hitSlop={12}
        >
          <Ionicons name="play-skip-forward" size={24} color={themeColors.text} />
        </Pressable>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },

  chapterDisplay: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },

  chapterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  nowPlayingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  chapterLabel: {
    fontSize: typography.size.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  chapterTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  progressSection: {
    gap: spacing.xs,
  },

  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
    justifyContent: 'center',
  },

  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },

  seekThumb: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  timeText: {
    fontSize: typography.size.xs,
    fontVariant: ['tabular-nums'],
  },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },

  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },

  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
  },

  skipIconBack: {
    position: 'absolute',
    transform: [{ scaleX: -1 }],
  },

  skipIconForward: {
    position: 'absolute',
  },

  skipLabel: {
    fontSize: 12,
    fontWeight: '800',
  },

  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AudioControls;
