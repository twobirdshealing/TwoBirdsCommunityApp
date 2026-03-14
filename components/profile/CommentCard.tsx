// =============================================================================
// COMMENT CARD - Renders a single profile comment (for profile Comments tab)
// =============================================================================
// Matches the native Fluent Community web pattern:
//   - Dashed vertical line on the left connecting comments
//   - Small circle with inner dot at each comment (aligned with title)
//   - Comment content in a rounded card
// =============================================================================

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { HtmlContent } from '@/components/common/HtmlContent';
import { formatRelativeTime } from '@/utils/formatDate';
import { stripHtmlTags, decodeHtmlEntities } from '@/utils/htmlToText';
import { ProfileComment } from '@/types/user';

interface CommentCardProps {
  comment: ProfileComment;
  onPostPress: (postId: number, postSlug: string) => void;
  onDelete?: (comment: ProfileComment) => void;
  isOwnComment?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

// Timeline dimensions (matches native: 18px circle, 6px inner dot, 32px margin)
const CIRCLE_SIZE = 18;
const DOT_SIZE = 6;
const TIMELINE_COL = 32;

export function CommentCard({ comment, onPostPress, onDelete, isOwnComment, isFirst, isLast }: CommentCardProps) {
  const { colors: themeColors } = useTheme();
  const { width } = useWindowDimensions();
  const contentWidth = width - spacing.lg * 2 - TIMELINE_COL;

  // Memoize HTML decoding — avoids 10+ regex chains per render
  const postTitle = useMemo(() => {
    const decoded = comment.post.title ? decodeHtmlEntities(comment.post.title).trim() : '';
    const stripped = decodeHtmlEntities(stripHtmlTags(comment.post.message)).trim();
    return decoded || (stripped ? stripped.slice(0, 60) : null) || 'a post';
  }, [comment.post.title, comment.post.message]);

  const spaceName = comment.post.space?.title;
  const hasContent = comment.message_rendered?.trim().length > 0;
  const mediaPreview = comment.meta?.media_preview;

  return (
    <Pressable
      style={[
        styles.container,
        !isLast && { borderBottomWidth: 1, borderBottomColor: themeColors.border },
        isFirst && styles.containerFirst,
        isLast && styles.containerLast,
      ]}
      onPress={() => onPostPress(comment.post.id, comment.post.slug)}
    >
      {/* Timeline column: dashed line + circle with dot */}
      <View style={styles.timelineCol}>
        {/* Dashed line — hidden for last item */}
        {!isLast && (
          <View
            style={[
              styles.dashedLine,
              { borderLeftColor: themeColors.border },
            ]}
          />
        )}
        {/* Circle with inner dot — subtle, matches native .comment_icon */}
        <View style={[styles.circle, { backgroundColor: themeColors.background }]}>
          <View style={[styles.innerDot, { backgroundColor: themeColors.textTertiary }]} />
        </View>
      </View>

      {/* Content column */}
      <View style={styles.body}>
        {/* Timestamp + delete */}
        <View style={styles.topRow}>
          <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>
            {formatRelativeTime(comment.created_at)}
          </Text>
          {isOwnComment && onDelete && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onDelete(comment); }}
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={16} color={themeColors.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Post title */}
        <Text style={[styles.postTitle, { color: themeColors.text }]} numberOfLines={2}>
          {postTitle}
        </Text>

        {/* Space name */}
        {spaceName && (
          <Text style={[styles.spaceName, { color: themeColors.textSecondary }]} numberOfLines={1}>
            in {spaceName}
          </Text>
        )}

        {/* Comment content card */}
        {hasContent && (
          <View style={[styles.content, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.borderLight }]}>
            <HtmlContent
              html={comment.message_rendered}
              contentWidth={contentWidth - spacing.sm * 2}
              baseFontSize={typography.size.sm}
            />
          </View>
        )}

        {/* GIF / media preview */}
        {mediaPreview?.image && (
          <Image
            source={{ uri: mediaPreview.image }}
            style={[
              styles.mediaPreview,
              {
                aspectRatio: (mediaPreview.width || 16) / (mediaPreview.height || 9),
                borderColor: themeColors.borderLight,
              },
            ]}
            contentFit="cover"
          />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  containerFirst: {
    paddingTop: spacing.xs,
  },

  containerLast: {
    paddingBottom: spacing.xs,
  },

  // Left column holding circle + dashed line
  timelineCol: {
    width: TIMELINE_COL,
    alignItems: 'center',
    position: 'relative',
  },

  // Dashed vertical line — starts below circle, extends to bottom of card
  dashedLine: {
    position: 'absolute',
    top: CIRCLE_SIZE + 2, // starts just below circle
    bottom: 0,
    width: 0,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
  },

  // Outer circle
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2, // align with timestamp text
  },

  // Inner dot
  innerDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },

  body: {
    flex: 1,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },

  timestamp: {
    fontSize: typography.size.xs,
  },

  postTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },

  spaceName: {
    fontSize: typography.size.xs,
    marginBottom: spacing.sm,
  },

  content: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
  },

  mediaPreview: {
    width: '100%',
    maxHeight: 200,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
});
