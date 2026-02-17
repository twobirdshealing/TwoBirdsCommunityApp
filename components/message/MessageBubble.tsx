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
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { ChatMessage, getMessageText } from '@/types/message';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
  onLongPress?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
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

export function MessageBubble({
  message,
  isOwn,
  showAvatar = true,
  showTimestamp = false,
  onAvatarPress,
  onLongPress,
  onDelete,
}: MessageBubbleProps) {
  const { colors: themeColors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const messageText = getMessageText(message.text);
  const senderName = message.xprofile?.display_name || 'Unknown';
  const avatarUrl = message.xprofile?.avatar || null;

  // Get images from HTML text (API embeds images as <img> tags in text field)
  const images = extractImagesFromHtml(message.text);
  const hasImages = images.length > 0;

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

      {/* Message Bubble */}
      <Pressable
        style={[
          styles.bubble,
          isOwn ? [styles.bubbleOwn, { backgroundColor: themeColors.primary }] : [styles.bubbleOther, { backgroundColor: themeColors.backgroundSecondary }],
          hasImages && styles.bubbleWithImage,
        ]}
        onLongPress={() => onLongPress?.(message)}
      >
        {/* Images (extracted from HTML text) */}
        {hasImages && (
          <View style={styles.attachmentsContainer}>
            {images.map((image, index) => (
              <Image
                key={index}
                source={{ uri: image.url }}
                style={[
                  styles.attachmentImage,
                  images.length === 1 && styles.attachmentImageSingle,
                ]}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        {/* Text (if any) */}
        {messageText.length > 0 && (
          <Text style={[styles.text, { color: themeColors.text }, isOwn && { color: themeColors.textInverse }, hasImages && styles.textWithImage]}>
            {messageText}
          </Text>
        )}
      </Pressable>

      {/* Timestamp (optional, shown below bubble) */}
      {showTimestamp && (
        <Text style={[styles.timestamp, { color: themeColors.textTertiary }, isOwn && styles.timestampOwn]}>
          {formatTime(message.created_at)}
        </Text>
      )}
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
}

// -----------------------------------------------------------------------------
// Message Group Component
// -----------------------------------------------------------------------------
// Use this to group consecutive messages from the same sender

interface MessageGroupProps {
  messages: ChatMessage[];
  isOwn: boolean;
  onAvatarPress?: () => void;
  onLongPress?: (message: ChatMessage) => void;
}

export function MessageGroup({
  messages,
  isOwn,
  onAvatarPress,
  onLongPress,
}: MessageGroupProps) {
  if (messages.length === 0) return null;

  return (
    <View style={styles.groupContainer}>
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={isOwn}
          showAvatar={index === 0} // Only show avatar for first message in group
          showTimestamp={index === messages.length - 1} // Show timestamp for last message
          onAvatarPress={onAvatarPress}
          onLongPress={onLongPress}
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
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },

  containerOwn: {
    flexDirection: 'row-reverse',
  },

  avatarContainer: {
    marginRight: spacing.xs,
    marginBottom: 2,
  },

  avatarSpacer: {
    width: 32 + spacing.xs, // Avatar size + margin
  },

  bubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
  },

  bubbleOwn: {
    borderBottomRightRadius: 4,
  },

  bubbleOther: {
    borderBottomLeftRadius: 4,
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
    borderRadius: 4,
  },

  attachmentImageSingle: {
    width: 200,
    height: 200,
    borderRadius: 14,
  },

  text: {
    fontSize: typography.size.md,
    lineHeight: 20,
  },

  textOwn: {
  },

  textWithImage: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  timestamp: {
    fontSize: typography.size.xs,
    marginTop: 4,
    marginLeft: 32 + spacing.xs + spacing.sm,
  },

  timestampOwn: {
    marginLeft: 0,
    marginRight: spacing.sm,
    textAlign: 'right',
  },

  // Group styles
  groupContainer: {
    marginBottom: spacing.sm,
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
    fontWeight: '500',
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
    fontWeight: '600',
    marginTop: 4,
  },
});

export default MessageBubble;
