// =============================================================================
// REACTION ICON - Renders custom icon image or emoji fallback
// =============================================================================
// Used by ReactionPicker, FeedCard, CommentSheet to show the correct
// reaction icon from the tb-multi-reactions plugin config.
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ReactionIconProps {
  /** Custom icon URL from the plugin (uploaded image) */
  iconUrl?: string | null;
  /** Emoji fallback if no custom icon */
  emoji?: string;
  /** Icon size in pixels (used for both width/height and fontSize) */
  size?: number;
  /** Border stroke width (for breakdown summary icons, matches web styling) */
  stroke?: number;
  /** Border color for stroke (typically theme border color) */
  borderColor?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ReactionIcon({ iconUrl, emoji, size = 20, stroke = 0, borderColor }: ReactionIconProps) {
  const { colors: themeColors } = useTheme();
  const resolvedBorderColor = borderColor || themeColors.borderLight;
  const hasStroke = stroke > 0;

  // Inner content: Image or emoji Text
  let content: React.ReactNode;

  if (iconUrl && iconUrl.length > 0) {
    content = (
      <Image
        source={{ uri: iconUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="contain"
        autoplay={true}
        transition={200}
        cachePolicy="memory-disk"
      />
    );
  } else {
    content = (
      <Text style={{ fontSize: size * 0.75, lineHeight: size, textAlign: 'center' }}>
        {emoji || '👍'}
      </Text>
    );
  }

  // Wrap in circular border if stroke > 0 (breakdown summary style)
  if (hasStroke) {
    const outerSize = size + stroke * 2;
    return (
      <View
        style={{
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          borderWidth: stroke,
          borderColor: resolvedBorderColor,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {content}
      </View>
    );
  }

  return <>{content}</>;
}
