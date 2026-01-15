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
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { ChatMessage, getMessageText } from '@/types/message';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

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
}: MessageBubbleProps) {
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
  // Render
  // ---------------------------------------------------------------------------

  return (
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
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
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
          <Text style={[styles.text, isOwn && styles.textOwn, hasImages && styles.textWithImage]}>
            {messageText}
          </Text>
        )}
      </Pressable>

      {/* Timestamp (optional, shown below bubble) */}
      {showTimestamp && (
        <Text style={[styles.timestamp, isOwn && styles.timestampOwn]}>
          {formatTime(message.created_at)}
        </Text>
      )}
    </View>
  );
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
      <View style={styles.dateLine} />
      <Text style={styles.dateText}>{formatDate(date)}</Text>
      <View style={styles.dateLine} />
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
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },

  bubbleOther: {
    backgroundColor: colors.backgroundSecondary,
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
    color: colors.text,
    lineHeight: 20,
  },

  textOwn: {
    color: colors.textInverse,
  },

  textWithImage: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  timestamp: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
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
    backgroundColor: colors.border,
  },

  dateText: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
    marginHorizontal: spacing.md,
    fontWeight: '500',
  },
});

export default MessageBubble;
