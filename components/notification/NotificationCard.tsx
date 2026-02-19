// =============================================================================
// NOTIFICATION CARD - Single notification item with swipe actions
// =============================================================================
// Displays a notification with:
// - Unread indicator (blue dot or tinted background)
// - Actor avatar
// - Type icon overlay
// - Message and timestamp
// - Swipe right to mark as read
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';
import { AppNotification } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { NotificationTypeIcon } from './NotificationTypeIcon';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NotificationCardProps {
  notification: AppNotification;
  onPress?: (notification: AppNotification) => void;
  onMarkAsRead?: (notification: AppNotification) => void;
  onAvatarPress?: (notification: AppNotification) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NotificationCard({
  notification,
  onPress,
  onMarkAsRead,
  onAvatarPress,
}: NotificationCardProps) {
  const { colors: themeColors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  // Extract data
  const actor = notification.xprofile;
  const actorName = actor?.display_name || 'Someone';
  const actorAvatar = actor?.avatar || null;
  const isUnread = !notification.is_read;
  const timestamp = formatRelativeTime(notification.created_at);

  // ---------------------------------------------------------------------------
  // Swipe Actions
  // ---------------------------------------------------------------------------

  const closeSwipeable = () => {
    swipeableRef.current?.close();
  };

  const handleMarkAsRead = () => {
    hapticLight();
    closeSwipeable();
    onMarkAsRead?.(notification);
  };

  // Right swipe action - Mark as Read
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    // Only show if unread
    if (!isUnread) return null;

    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.swipeAction,
          styles.markReadAction,
          { backgroundColor: themeColors.success, transform: [{ translateX }] },
        ]}
      >
        <Pressable style={styles.swipeActionButton} onPress={handleMarkAsRead}>
          <Ionicons name="checkmark-circle" size={24} color={themeColors.textInverse} />
          <Text style={[styles.swipeActionText, { color: themeColors.textInverse }]}>Read</Text>
        </Pressable>
      </Animated.View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable
        style={[
          styles.container,
          { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border },
          isUnread && [styles.containerUnread, { backgroundColor: themeColors.primary + '10' }],
        ]}
        onPress={() => onPress?.(notification)}
      >
        {/* Unread Indicator Dot */}
        {isUnread && <View style={[styles.unreadDot, { backgroundColor: themeColors.primary }]} />}

        {/* Avatar with Type Icon Overlay */}
        <Pressable
          style={styles.avatarContainer}
          onPress={() => onAvatarPress?.(notification)}
        >
          <Avatar
            source={actorAvatar}
            size="md"
            fallback={actorName}
          />
          <View style={styles.typeIconOverlay}>
            <NotificationTypeIcon
              type={notification.type}
              reactionType={notification.tbc_reaction_type}
              reactionIconUrl={notification.tbc_reaction_icon_url}
              reactionEmoji={notification.tbc_reaction_emoji}
              size={12}
            />
          </View>
        </Pressable>

        {/* Content */}
        <View style={styles.content}>
          {/* Message */}
          <Text style={[styles.message, { color: themeColors.textSecondary }, isUnread && [styles.messageUnread, { color: themeColors.text }]]} numberOfLines={2}>
            {notification.message || notification.title}
          </Text>

          {/* Timestamp */}
          <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>{timestamp}</Text>
        </View>

        {/* Chevron */}
        <Ionicons
          name="chevron-forward"
          size={16}
          color={themeColors.textTertiary}
          style={styles.chevron}
        />
      </Pressable>
    </Swipeable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingLeft: spacing.xl, // Extra space for unread dot
    borderBottomWidth: 1,
  },

  containerUnread: {
  },

  // Unread indicator
  unreadDot: {
    position: 'absolute',
    left: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Avatar
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },

  typeIconOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },

  // Content
  content: {
    flex: 1,
    justifyContent: 'center',
  },

  message: {
    fontSize: typography.size.md,
    lineHeight: 20,
    marginBottom: 4,
  },

  messageUnread: {
    fontWeight: '500',
  },

  timestamp: {
    fontSize: typography.size.xs,
  },

  chevron: {
    marginLeft: spacing.sm,
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

  markReadAction: {
  },

  swipeActionText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default NotificationCard;