// =============================================================================
// NOTIFICATION TYPE ICON - Icon based on notification type
// =============================================================================
// Returns appropriate icon and color for each notification type.
// Used in NotificationCard and potentially notification toasts.
// =============================================================================

import { colors } from '@/constants/colors';
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

function getIconConfig(type: NotificationType): IconConfig {
  switch (type) {
    case 'new_comment':
      return {
        icon: 'chatbubble',
        color: colors.info,
        backgroundColor: colors.infoLight,
      };

    case 'new_reply':
      return {
        icon: 'arrow-undo',
        color: colors.info,
        backgroundColor: colors.infoLight,
      };

    case 'new_reaction':
      return {
        icon: 'heart',
        color: colors.reactions.love,
        backgroundColor: colors.errorLight,
      };

    case 'new_follower':
      return {
        icon: 'person-add',
        color: colors.success,
        backgroundColor: colors.successLight,
      };

    case 'mention':
      return {
        icon: 'at',
        color: colors.warning,
        backgroundColor: colors.warningLight,
      };

    case 'space_invite':
      return {
        icon: 'mail',
        color: colors.primary,
        backgroundColor: colors.primaryLight + '30',
      };

    case 'space_join':
      return {
        icon: 'people',
        color: colors.success,
        backgroundColor: colors.successLight,
      };

    case 'course_enrollment':
      return {
        icon: 'school',
        color: colors.primary,
        backgroundColor: colors.primaryLight + '30',
      };

    case 'lesson_complete':
      return {
        icon: 'checkmark-circle',
        color: colors.success,
        backgroundColor: colors.successLight,
      };

    default:
      return {
        icon: 'notifications',
        color: colors.textSecondary,
        backgroundColor: colors.backgroundSecondary,
      };
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NotificationTypeIcon({ type, size = 20 }: NotificationTypeIconProps) {
  const config = getIconConfig(type);
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