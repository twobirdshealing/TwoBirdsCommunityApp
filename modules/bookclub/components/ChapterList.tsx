// =============================================================================
// CHAPTER LIST - Bottom sheet showing all chapters with active highlighting
// =============================================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAudioPlayerContext, formatTime } from '@/modules/bookclub/contexts/AudioPlayerContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { BottomSheetScrollView } from '@/components/common/BottomSheet';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface ChapterListProps {
  onClose?: () => void;
}

export function ChapterList({ onClose }: ChapterListProps) {
  const { colors: themeColors } = useTheme();
  const { currentBook, currentChapterIndex, jumpToChapter } = useAudioPlayerContext();

  const chapters = currentBook?.chapters ?? [];

  if (!chapters.length) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
          No chapters available
        </Text>
      </View>
    );
  }

  return (
    <BottomSheetScrollView style={styles.container} contentContainerStyle={styles.content}>
      {chapters.map((chapter, index) => {
        const isActive = index === currentChapterIndex;

        return (
          <Pressable
            key={index}
            style={({ pressed }) => [
              styles.item,
              isActive && { backgroundColor: withOpacity(themeColors.primary, 0.08) },
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => { hapticLight(); jumpToChapter(index); onClose?.(); }}
          >
            <View style={styles.itemContent}>
              {isActive && (
                <Ionicons name="volume-high" size={16} color={themeColors.primary} />
              )}
              <View style={styles.itemText}>
                <Text
                  style={[
                    styles.label,
                    { color: isActive ? themeColors.primary : themeColors.textSecondary },
                  ]}
                >
                  {chapter.label}
                </Text>
                <Text
                  style={[
                    styles.title,
                    { color: isActive ? themeColors.primary : themeColors.text },
                  ]}
                  numberOfLines={1}
                >
                  {chapter.title}
                </Text>
              </View>
            </View>

            <Text style={[styles.time, { color: themeColors.textTertiary }]}>
              {formatTime(chapter.time)}
            </Text>
          </Pressable>
        );
      })}
    </BottomSheetScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingVertical: spacing.sm,
  },

  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: typography.size.sm,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: sizing.borderRadius.sm,
  },

  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },

  itemText: {
    flex: 1,
    gap: 1,
  },

  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },

  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },

  time: {
    fontSize: typography.size.xs,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.md,
  },
});

export default ChapterList;
