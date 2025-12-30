// =============================================================================
// NOTIFICATION CARD - Single notification item with swipe actions
// =============================================================================
// Displays a notification with:
// - Unread indicator (blue dot or tinted background)
// - Actor avatar
// - Type icon overlay
// - Message and timestamp
// - Swipe left to delete, swipe right to mark as read
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Notification } from '@/types';
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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NotificationCardProps {
  notification: Notification;
  onPress?: (notification: Notification) => void;
  onMarkAsRead?: (notification: Notification) => void;
  onDelete?: (notification: Notification) => void;
  onAvatarPress?: (notification: Notification) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NotificationCard({
  notification,
  onPress,
  onMarkAsRead,
  onDelete,
  onAvatarPress,
}: NotificationCardProps) {
  const swipeableRef = useRef<Swipeable>(null);

  // Extract data
  const actor = notification.xprofile;
  const actorName = actor?.display_name || 'Someone';
  const actorAvatar = actor?.avatar || null;
  const isVerified = actor?.is_verified === 1;
  const isUnread = !notification.is_read;
  const timestamp = formatRelativeTime(notification.created_at);

  // ---------------------------------------------------------------------------
  // Swipe Actions
  // ---------------------------------------------------------------------------

  const closeSwipeable = () => {
    swipeableRef.current?.close();
  };

  const handleMarkAsRead = () => {
    closeSwipeable();
    onMarkAsRead?.(notification);
  };

  const handleDelete = () => {
    closeSwipeable();
    onDelete?.(notification);
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
          { transform: [{ translateX }] },
        ]}
      >
        <Pressable style={styles.swipeActionButton} onPress={handleMarkAsRead}>
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.swipeActionText}>Read</Text>
        </Pressable>
      </Animated.View>
    );
  };

  // Left swipe action - Delete
  const renderLeftActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [-80, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.swipeAction,
          styles.deleteAction,
          { transform: [{ translateX }] },
        ]}
      >
        <Pressable style={styles.swipeActionButton} onPress={handleDelete}>
          <Ionicons name="trash" size={24} color="#fff" />
          <Text style={styles.swipeActionText}>Delete</Text>
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
      renderLeftActions={renderLeftActions}
      rightThreshold={40}
      leftThreshold={40}
      overshootRight={false}
      overshootLeft={false}
    >
      <Pressable
        style={[
          styles.container,
          isUnread && styles.containerUnread,
        ]}
        onPress={() => onPress?.(notification)}
      >
        {/* Unread Indicator Dot */}
        {isUnread && <View style={styles.unreadDot} />}

        {/* Avatar with Type Icon Overlay */}
        <Pressable
          style={styles.avatarContainer}
          onPress={() => onAvatarPress?.(notification)}
        >
          <Avatar
            source={actorAvatar}
            size="md"
            verified={isVerified}
            fallback={actorName}
          />
          <View style={styles.typeIconOverlay}>
            <NotificationTypeIcon type={notification.type} size={12} />
          </View>
        </Pressable>

        {/* Content */}
        <View style={styles.content}>
          {/* Message */}
          <Text style={[styles.message, isUnread && styles.messageUnread]} numberOfLines={2}>
            {notification.message || notification.title}
          </Text>

          {/* Timestamp */}
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>

        {/* Chevron */}
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textTertiary}
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
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingLeft: spacing.xl, // Extra space for unread dot
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  containerUnread: {
    backgroundColor: colors.primaryLight + '10', // Very subtle tint
  },

  // Unread indicator
  unreadDot: {
    position: 'absolute',
    left: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
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
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },

  messageUnread: {
    color: colors.text,
    fontWeight: '500',
  },

  timestamp: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
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
    backgroundColor: colors.success,
  },

  deleteAction: {
    backgroundColor: colors.error,
  },

  swipeActionText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default NotificationCard;