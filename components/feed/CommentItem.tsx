// =============================================================================
// COMMENT ITEM - Single comment bubble with reactions & actions
// =============================================================================
// Extracted from CommentSheet for memoization and readability.
// =============================================================================

import React, { RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { Comment } from '@/types/comment';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { ReactionIcon } from './ReactionIcon';
import { formatRelativeTime } from '@/utils/formatDate';
import { HtmlContent } from '@/components/common/HtmlContent';
import type { ColorTheme } from '@/constants/colors';
import type { ReactionConfig, DisplayConfig } from '@/hooks/useReactionConfig';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CommentItemProps {
  item: Comment;
  themeColors: ColorTheme;
  commentContentWidth: number;
  defaultReactionId: string;
  getReaction: (type: string) => ReactionConfig | null;
  display: DisplayConfig;
  menuButtonRefs: RefObject<Record<number, View | null>>;
  reactionButtonRefs: RefObject<Record<number, View | null>>;
  onMenu: (comment: Comment) => void;
  onReply: (comment: Comment) => void;
  onReaction: (comment: Comment, type: string) => void;
  onReactionLongPress: (comment: Comment, anchor: { top: number; left: number } | undefined) => void;
  onImagePress: (images: Array<{ url: string }>, index: number) => void;
  onBreakdownPress: (comment: Comment) => void;
  onLinkNavigate?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

function CommentItemInner({ item, themeColors, commentContentWidth, defaultReactionId, getReaction, display, menuButtonRefs, reactionButtonRefs, onMenu, onReply, onReaction, onReactionLongPress, onImagePress, onBreakdownPress, onLinkNavigate }: CommentItemProps) {
  const author = item.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  const timestamp = formatRelativeTime(item.created_at);
  const isReply = item.parent_id !== null;

  // Check for images in comment - multiple possible locations
  const meta = item.meta || {};
  let commentImages: Array<{ url: string }> = [];

  if (meta.media_images && Array.isArray(meta.media_images)) {
    commentImages = meta.media_images;
  } else if (meta.media_items && Array.isArray(meta.media_items)) {
    commentImages = meta.media_items;
  } else if (meta.media_preview?.image) {
    commentImages = [{ url: meta.media_preview.image }];
  }

  return (
    <View style={[
      styles.commentItem,
      isReply && [styles.commentReply, { borderLeftColor: themeColors.border }],
    ]}>
      <Avatar
        source={authorAvatar}
        size="sm"
        fallback={authorName}
      />
      <View style={[styles.commentContent, styles.commentBubble, { backgroundColor: themeColors.surface, borderColor: themeColors.borderLight }]}>
        <View style={styles.commentHeader}>
          <UserDisplayName
            name={authorName}
            verified={isVerified}
            badgeSlugs={author?.meta?.badge_slug}
            size="sm"
            style={styles.commentHeaderLeft}
          />
          {/* 3-dot menu */}
          <Pressable
            ref={(el: any) => { menuButtonRefs.current![item.id] = el; }}
            style={styles.commentMenuButton}
            onPress={() => onMenu(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={themeColors.textTertiary} />
          </Pressable>
        </View>

        {/* Comment text with timestamp on right */}
        <View style={styles.commentTextRow}>
          <View style={styles.commentTextContent}>
            <HtmlContent
              html={item.message_rendered || item.message || ''}
              contentWidth={commentContentWidth}
              onLinkNavigate={onLinkNavigate}
            />
          </View>
          <Text style={[styles.commentTimeInline, { color: themeColors.textTertiary }]}>
            {timestamp}
          </Text>
        </View>

        {/* Comment images */}
        {commentImages.length > 0 && (
          <View style={styles.commentImages}>
            {commentImages.map((img: any, idx: number) => (
              <AnimatedPressable
                key={idx}
                onPress={() => onImagePress(commentImages, idx)}
              >
                <Image
                  source={{ uri: img.url }}
                  style={styles.commentImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </AnimatedPressable>
            ))}
          </View>
        )}

        {/* Comment actions - Multi-reaction support */}
        <View style={styles.commentActions}>
          <View style={styles.commentActionsLeft}>
            {(() => {
              const hasReacted = !!(item.has_user_react || item.user_reaction_type);
              const reactionType = item.user_reaction_type || defaultReactionId;
              const rConfig = getReaction(reactionType);
              const iconUrl = item.user_reaction_icon_url || rConfig?.icon_url || null;
              const emoji = rConfig?.emoji || '\u{1F44D}';
              const reactionColor = rConfig?.color || themeColors.primary;

              return (
                <AnimatedPressable
                  ref={(el: any) => { reactionButtonRefs.current![item.id] = el; }}
                  style={[
                    styles.commentReactionButton,
                    hasReacted && { backgroundColor: reactionColor + '15' },
                  ]}
                  onPress={() => {
                    hapticLight();
                    const type = item.user_reaction_type || defaultReactionId;
                    onReaction(item, type);
                  }}
                  onLongPress={() => {
                    hapticMedium();
                    const ref = reactionButtonRefs.current![item.id];
                    if (ref) {
                      (ref as any).measureInWindow?.((x: number, y: number, width: number, height: number) => {
                        onReactionLongPress(item, { top: y, left: x + width / 2 });
                      });
                    } else {
                      onReactionLongPress(item, undefined);
                    }
                  }}
                  delayLongPress={400}
                >
                  <View style={{ opacity: hasReacted ? 1 : 0.4 }}>
                    <ReactionIcon iconUrl={iconUrl} emoji={emoji} size={35} />
                  </View>
                </AnimatedPressable>
              );
            })()}
            <Pressable
              style={styles.commentAction}
              onPress={() => onReply(item)}
            >
              <Text style={[styles.commentActionText, { color: themeColors.textSecondary }]}>Reply</Text>
            </Pressable>
          </View>
          {/* Right side: reaction breakdown summary */}
          {(() => {
            const breakdown = item.reaction_breakdown || [];
            const totalReactions = typeof item.reactions_count === 'string'
              ? parseInt(item.reactions_count, 10) : item.reactions_count || 0;
            if (breakdown.length === 0 || totalReactions === 0) return null;
            return (
              <Pressable
                style={styles.commentBreakdown}
                onPress={() => onBreakdownPress(item)}
              >
                <View style={styles.commentEmojiStack}>
                  {breakdown.slice(0, display.count).map((bd, i) => (
                    <View
                      key={bd.type}
                      style={{ zIndex: 10 + i, marginLeft: i === 0 ? 0 : -3 }}
                    >
                      <ReactionIcon
                        iconUrl={bd.icon_url}
                        emoji={bd.emoji || '\u{1F44D}'}
                        size={22}
                        stroke={display.stroke}
                        borderColor={themeColors.borderLight}
                      />
                    </View>
                  ))}
                </View>
                <Text style={[styles.commentActionText, { color: themeColors.textSecondary }]}>
                  {totalReactions}
                </Text>
              </Pressable>
            );
          })()}
        </View>
      </View>
    </View>
  );
}

export const CommentItem = React.memo(CommentItemInner);

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  commentItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },

  commentBubble: {
    padding: spacing.md,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
  },

  commentReply: {
    marginLeft: spacing.xl,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
  },

  commentContent: {
    flex: 1,
    marginLeft: spacing.md,
  },

  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },

  commentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  commentMenuButton: {
    padding: spacing.xs,
  },

  commentTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  commentTextContent: {
    flex: 1,
  },

  commentTimeInline: {
    fontSize: typography.size.xs,
    marginLeft: spacing.sm,
    marginTop: 2,
  },

  commentImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },

  commentImage: {
    width: 80,
    height: 80,
    borderRadius: sizing.borderRadius.sm,
  },

  commentActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  commentActionsLeft: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },

  commentAction: {
    paddingVertical: spacing.xs,
  },

  commentReactionButton: {
    padding: spacing.xs,
    borderRadius: sizing.borderRadius.md,
  },

  commentActionText: {
    fontSize: typography.size.sm,
  },

  commentBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  commentEmojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
