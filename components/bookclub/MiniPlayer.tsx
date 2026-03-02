// =============================================================================
// MINI PLAYER - Persistent bar above tab bar during audio playback
// =============================================================================
// Shows current book + play/pause. Tap to open full player.
// Only visible when a book is loaded and user is not on the player screen.
// =============================================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAudioPlayerContext, formatTime } from '@/contexts/AudioPlayerContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MiniPlayer() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const { currentBook, isPlaying, currentTime, duration, togglePlayPause, stop } = useAudioPlayerContext();

  if (!currentBook) return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={[styles.wrapper, { borderTopColor: themeColors.border }]}>
      {/* Progress indicator line */}
      <View style={[styles.progressLine, { backgroundColor: withOpacity(themeColors.primary, 0.15) }]}>
        <View style={[styles.progressFill, { backgroundColor: themeColors.primary, width: `${progress * 100}%` }]} />
      </View>

      <Pressable
        style={[styles.container, { backgroundColor: themeColors.surface }]}
        onPress={() => router.push({ pathname: '/bookclub/[id]', params: { id: String(currentBook.id) } })}
      >
        {/* Cover Thumbnail */}
        {currentBook.cover_image ? (
          <Image source={{ uri: currentBook.cover_image }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
            <Ionicons name="book-outline" size={20} color={themeColors.primary} />
          </View>
        )}

        {/* Book Info */}
        <View style={styles.info}>
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
            {currentBook.title}
          </Text>
          <Text style={[styles.author, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {currentBook.author}
          </Text>
        </View>

        {/* Play / Pause */}
        <Pressable style={styles.playBtn} onPress={togglePlayPause} hitSlop={12}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={themeColors.text}
          />
        </Pressable>

        {/* Close / Dismiss */}
        <Pressable style={styles.closeBtn} onPress={stop} hitSlop={12}>
          <Ionicons name="close" size={20} color={themeColors.textTertiary} />
        </Pressable>
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
  },

  progressLine: {
    height: 2,
  },

  progressFill: {
    height: '100%',
  },

  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  cover: {
    width: 40,
    height: 40,
    borderRadius: sizing.borderRadius.xs,
  },

  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  info: {
    flex: 1,
    gap: 1,
  },

  title: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  author: {
    fontSize: typography.size.xs,
  },

  playBtn: {
    padding: spacing.sm,
  },

  closeBtn: {
    padding: spacing.sm,
    marginLeft: -spacing.xs,
  },
});

export default MiniPlayer;
