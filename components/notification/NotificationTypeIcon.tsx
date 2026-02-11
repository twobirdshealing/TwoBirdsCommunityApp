// =============================================================================
// NOTIFICATION TYPE ICON - Icon based on notification type
// =============================================================================
// Returns appropriate icon and color for each notification type.
// Used in NotificationCard and potentially notification toasts.
// Supports both legacy types (new_comment) and action types (feed/commented)
// =============================================================================

import { ColorTheme } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NotificationTypeIconProps {
  type: NotificationType;
  size?: number;
}

// -----------------------------------------------------------------------------
// Icon & Color Mapping
// -----------------------------------------------------------------------------

interface IconConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
}

function getIconConfig(type: NotificationType, tc: ColorTheme): IconConfig {
  // Handle action-style types (e.g., "feed/mentioned")
  const normalizedType = type?.toLowerCase() || '';

  // Comment types
  if (normalizedType === 'new_comment' ||
      normalizedType.includes('comment') ||
      normalizedType === 'feed/commented') {
    return {
      icon: 'chatbubble',
      color: tc.info,
      backgroundColor: tc.infoLight,
    };
  }

  // Reply types
  if (normalizedType === 'new_reply' ||
      normalizedType.includes('reply') ||
      normalizedType.includes('replied') ||
      normalizedType === 'feed/replied') {
    return {
      icon: 'arrow-undo',
      color: tc.info,
      backgroundColor: tc.infoLight,
    };
  }

  // Reaction types
  if (normalizedType === 'new_reaction' ||
      normalizedType.includes('react') ||
      normalizedType === 'feed/reacted') {
    return {
      icon: 'heart',
      color: tc.reactions.love,
      backgroundColor: tc.errorLight,
    };
  }

  // Friend posted types
  if (normalizedType === 'friend_new_post' ||
      normalizedType === 'friend_post') {
    return {
      icon: 'document-text',
      color: tc.primary,
      backgroundColor: tc.primaryLight + '30',
    };
  }

  // Follower types
  if (normalizedType === 'new_follower' ||
      normalizedType.includes('follow') ||
      normalizedType === 'profile/followed') {
    return {
      icon: 'person-add',
      color: tc.success,
      backgroundColor: tc.successLight,
    };
  }

  // Mention types
  if (normalizedType === 'mention' ||
      normalizedType.includes('mention') ||
      normalizedType === 'feed/mentioned') {
    return {
      icon: 'at',
      color: tc.warning,
      backgroundColor: tc.warningLight,
    };
  }

  // Space invite types
  if (normalizedType === 'space_invite' ||
      normalizedType.includes('invite') ||
      normalizedType === 'space/invited') {
    return {
      icon: 'mail',
      color: tc.primary,
      backgroundColor: tc.primaryLight + '30',
    };
  }

  // Space join types
  if (normalizedType === 'space_join' ||
      normalizedType === 'space/joined') {
    return {
      icon: 'people',
      color: tc.success,
      backgroundColor: tc.successLight,
    };
  }

  // Course enrollment types
  if (normalizedType === 'course_enrollment' ||
      normalizedType.includes('enroll') ||
      normalizedType === 'course/enrolled') {
    return {
      icon: 'school',
      color: tc.primary,
      backgroundColor: tc.primaryLight + '30',
    };
  }

  // Lesson complete types
  if (normalizedType === 'lesson_complete' ||
      normalizedType.includes('complete') ||
      normalizedType === 'lesson/completed') {
    return {
      icon: 'checkmark-circle',
      color: tc.success,
      backgroundColor: tc.successLight,
    };
  }

  // Default fallback
  return {
    icon: 'notifications',
    color: tc.textSecondary,
    backgroundColor: tc.backgroundSecondary,
  };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NotificationTypeIcon({ type, size = 20 }: NotificationTypeIconProps) {
  const { colors: themeColors } = useTheme();
  const config = getIconConfig(type, themeColors);
  const containerSize = size * 1.8;

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: config.backgroundColor,
        },
      ]}
    >
      <Ionicons name={config.icon} size={size} color={config.color} />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationTypeIcon;