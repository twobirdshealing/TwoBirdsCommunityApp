// =============================================================================
// MESSAGE BUBBLE - Individual chat message
// =============================================================================
// Displays a chat message bubble with:
// - Different styles for sent vs received
// - Avatar for received messages
// - Timestamp
// - Read status (optional)
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { withOpacity } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { ChatMessage, getMessageText, getMessagePreview } from '@/types/message';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  onAvatarPress?: () => void;
  onDelete?: (message: ChatMessage) => void;
  /** Tap the smiley button to toggle default reaction */
  onDefaultReact?: (message: ChatMessage) => void;
  /** Long-press the smiley button to open picker (passes anchor for positioning) */
  onReactionLongPress?: (message: ChatMessage, anchor: { top: number; left: number }) => void;
  /** Tap an existing reaction pill to toggle it */
  onReactionPress?: (message: ChatMessage, emoji: string) => void;
  /** Tap the ... menu button (passes anchor for DropdownMenu positioning) */
  onMenuPress?: (message: ChatMessage, anchor: { top: number; right: number }) => void;
  /** Tap an image to open in MediaViewer */
  onImagePress?: (images: { url: string }[], index: number) => void;
  /** Tap a reply quote to scroll to the original message */
  onReplyPress?: (messageId: number) => void;
  currentUserId?: number;
  /** Render the user's current reaction icon (or default greyed smiley) */
  userReactionRenderer?: () => React.ReactNode;
  /** Render a reaction icon for breakdown pills */
  reactionRenderer?: (emoji: string) => React.ReactNode;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

// Extract images from HTML text (API embeds images as <img> tags)
function extractImagesFromHtml(html: string): { url: string }[] {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const images: { url: string }[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    images.push({ url: match[1] });
  }
  return images;
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  showTimestamp = false,
  onAvatarPress,
  onDelete,
  onDefaultReact,
  onReactionLongPress,
  onReactionPress,
  onMenuPress,
  onImagePress,
  onReplyPress,
  currentUserId,
  userReactionRenderer,
  reactionRenderer,
}: MessageBubbleProps) {
  const { colors: themeColors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const reactionBtnRef = useRef<View>(null);
  const menuBtnRef = useRef<View>(null);
  const messageText = getMessageText(message.text);
  const senderName = message.xprofile?.display_name || 'Unknown';
  const avatarUrl = message.xprofile?.avatar || null;

  // Get images from HTML text (API embeds images as <img> tags in text field)
  const images = extractImagesFromHtml(message.text);
  const hasImages = images.length > 0;

  // Reactions
  const reactions = message.meta?.reactions;
  const hasReactions = reactions && Object.keys(reactions).length > 0;
  const hasUserReacted = hasReactions && currentUserId
    ? Object.values(reactions!).some(ids => ids.includes(currentUserId))
    : false;

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // ---------------------------------------------------------------------------
  // Swipe Delete Action (own messages only)
  // ---------------------------------------------------------------------------

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete?.(message);
  };

  const renderDeleteAction = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.swipeAction,
          { backgroundColor: themeColors.error, transform: [{ translateX }] },
        ]}
      >
        <Pressable style={styles.swipeActionButton} onPress={handleDelete}>
          <Ionicons name="trash" size={20} color={themeColors.textInverse} />
          <Text style={[styles.swipeActionText, { color: themeColors.textInverse }]}>Delete</Text>
        </Pressable>
      </Animated.View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const bubbleContent = (
    <View style={[styles.container, isOwn && styles.containerOwn]}>
      {/* Avatar (for received messages) */}
      {!isOwn && showAvatar && (
        <Pressable onPress={onAvatarPress} style={styles.avatarContainer}>
          <Avatar
            source={avatarUrl}
            size="sm"
            fallback={senderName}
          />
        </Pressable>
      )}

      {/* Spacer when no avatar */}
      {!isOwn && !showAvatar && <View style={styles.avatarSpacer} />}

      {/* Bubble column: sender name + bubble + reactions + timestamp */}
      <View style={[styles.bubbleColumn, isOwn && styles.bubbleColumnOwn]}>
        {/* Sender name (first message in received group) */}
        {!isOwn && showAvatar && (
          <Text style={[styles.senderName, { color: themeColors.textSecondary }]}>
            {senderName}
          </Text>
        )}

        {/* Message Bubble */}
        <View
          style={[
            styles.bubble,
            { backgroundColor: themeColors.surface },
            hasImages && styles.bubbleWithImage,
          ]}
        >
          {/* Reply Quote (tappable — scrolls to original message) */}
          {message.meta?.reply_to && message.meta?.reply_text ? (
            <Pressable
              style={[
                styles.replyQuote,
                { borderLeftColor: themeColors.primaryDark, backgroundColor: withOpacity(themeColors.text, 0.04) },
              ]}
              onPress={() => onReplyPress?.(message.meta!.reply_to!)}
              disabled={!onReplyPress}
            >
              <Text
                style={[
                  styles.replyQuoteText,
                  { color: themeColors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {getMessagePreview(message.meta.reply_text, 120)}
              </Text>
            </Pressable>
          ) : null}

          {/* Images (extracted from HTML text — tappable to open MediaViewer) */}
          {hasImages && (
            <View style={styles.attachmentsContainer}>
              {images.map((image, index) => (
                <Pressable
                  key={index}
                  onPress={() => onImagePress?.(images, index)}
                >
                  <Image
                    source={{ uri: image.url }}
                    style={[
                      styles.attachmentImage,
                      images.length === 1 && styles.attachmentImageSingle,
                    ]}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              ))}
            </View>
          )}

          {/* Text (if any) */}
          {messageText.length > 0 && (
            <Text style={[styles.text, { color: themeColors.text }, hasImages && styles.textWithImage]}>
              {messageText}
            </Text>
          )}
        </View>

        {/* Reaction row: [smiley far-left] ... [pills + menu far-right] */}
        <View style={styles.reactionsRow}>
          {/* Smiley button — tap for default react, long-press for picker */}
          <Pressable
            ref={reactionBtnRef}
            style={[
              styles.reactionButton,
              hasUserReacted && {
                backgroundColor: withOpacity(themeColors.primary, 0.15),
              },
            ]}
            onPress={() => onDefaultReact?.(message)}
            onLongPress={() => {
              (reactionBtnRef.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
                onReactionLongPress?.(message, { top: y, left: x + width / 2 });
              });
            }}
          >
            <View style={{ opacity: hasUserReacted ? 1 : 0.4 }}>
              {userReactionRenderer ? userReactionRenderer() : (
                <Text style={{ fontSize: typography.size.lg }}>👍</Text>
              )}
            </View>
          </Pressable>

          {/* Spacer pushes pills + menu to far right */}
          <View style={{ flex: 1 }} />

          {/* Reaction breakdown pills */}
          {hasReactions && Object.entries(reactions!).map(([emoji, userIds]) => {
            const hasReacted = currentUserId ? userIds.includes(currentUserId) : false;
            return (
              <Pressable
                key={emoji}
                style={[
                  styles.reactionPill,
                  {
                    backgroundColor: hasReacted
                      ? withOpacity(themeColors.primary, 0.15)
                      : themeColors.backgroundSecondary,
                    borderColor: hasReacted
                      ? withOpacity(themeColors.primary, 0.3)
                      : themeColors.borderLight,
                  },
                ]}
                onPress={() => onReactionPress?.(message, emoji)}
              >
                {reactionRenderer ? reactionRenderer(emoji) : (
                  <Text style={{ fontSize: typography.size.sm }}>{emoji}</Text>
                )}
                <Text style={[
                  styles.reactionCount,
                  { color: hasReacted ? themeColors.primary : themeColors.textSecondary },
                ]}>
                  {userIds.length}
                </Text>
              </Pressable>
            );
          })}

          {/* ... menu button (Reply / Delete) */}
          {onMenuPress && (
            <Pressable
              ref={menuBtnRef}
              style={styles.menuButton}
              onPress={() => {
                (menuBtnRef.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
                  const screenWidth = Dimensions.get('window').width;
                  onMenuPress(message, { top: y + height + 4, right: screenWidth - x - width });
                });
              }}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={themeColors.textTertiary} />
            </Pressable>
          )}
        </View>

        {/* Timestamp (optional, shown below bubble) */}
        {showTimestamp && (
          <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>
            {formatTime(message.created_at)}
          </Text>
        )}
      </View>
    </View>
  );

  // Wrap own messages in Swipeable for delete action
  if (isOwn && onDelete) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderDeleteAction}
        rightThreshold={40}
        overshootRight={false}
      >
        {bubbleContent}
      </Swipeable>
    );
  }

  return bubbleContent;
});

// -----------------------------------------------------------------------------
// Message Group Component
// -----------------------------------------------------------------------------
// Use this to group consecutive messages from the same sender

interface MessageGroupProps {
  messages: ChatMessage[];
  isOwn: boolean;
  onAvatarPress?: () => void;
}

export function MessageGroup({
  messages,
  isOwn,
  onAvatarPress,
}: MessageGroupProps) {
  if (messages.length === 0) return null;

  return (
    <View style={styles.groupContainer}>
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={isOwn}
          showAvatar={index === 0}
          showTimestamp={index === messages.length - 1}
          onAvatarPress={onAvatarPress}
        />
      ))}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Date Separator Component
// -----------------------------------------------------------------------------

interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const { colors: themeColors } = useTheme();
  const formatDate = (dateString: string) => {
    const messageDate = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if today
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    }

    // Check if yesterday
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Otherwise show full date
    return messageDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.dateSeparator}>
      <View style={[styles.dateLine, { backgroundColor: themeColors.border }]} />
      <Text style={[styles.dateText, { color: themeColors.textTertiary }]}>{formatDate(date)}</Text>
      <View style={[styles.dateLine, { backgroundColor: themeColors.border }]} />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  containerOwn: {
    flexDirection: 'row-reverse',
  },

  avatarContainer: {
    marginRight: spacing.xs,
    marginTop: 2,
  },

  avatarSpacer: {
    width: 32 + spacing.xs, // Avatar size + margin
  },

  bubbleColumn: {
    maxWidth: '75%',
    minWidth: '60%',
  },

  bubbleColumnOwn: {
    // Right-alignment handled by container's flexDirection: 'row-reverse'
  },

  senderName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: 2,
    marginLeft: spacing.xs,
  },

  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
  },

  bubbleWithImage: {
    padding: 0,
    overflow: 'hidden',
  },

  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },

  attachmentImage: {
    width: 120,
    height: 120,
    borderRadius: sizing.borderRadius.sm,
  },

  attachmentImageSingle: {
    width: 200,
    height: 200,
    borderRadius: sizing.borderRadius.sm,
  },

  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    marginBottom: spacing.xs,
  },

  replyQuoteText: {
    fontSize: typography.size.sm,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  text: {
    fontSize: typography.size.md,
    lineHeight: 20,
  },

  textWithImage: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  timestamp: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },

  // Group styles
  groupContainer: {
    marginBottom: spacing.xxl,
  },

  // Date separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },

  dateLine: {
    flex: 1,
    height: 1,
  },

  dateText: {
    fontSize: typography.size.xs,
    marginHorizontal: spacing.md,
    fontWeight: typography.weight.medium,
  },

  // Reaction row — smiley far-left, pills + menu far-right
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },

  reactionButton: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.borderRadius.full,
  },

  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
  },

  reactionCount: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },

  menuButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.borderRadius.full,
  },

  // Swipe Actions
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },

  swipeActionButton: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  swipeActionText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
  },
});

export default MessageBubble;
