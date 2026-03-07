// =============================================================================
// IMAGE MEDIA - Display uploaded images in feed posts
// =============================================================================
// Handles:
// - Responsive sizing based on aspect ratio
// - Loading placeholder
// - Error fallback
// - HTTP URLs (common in staging)
// =============================================================================

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { sizing, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { createLogger } from '@/utils/logger';

const log = createLogger('ImageMedia');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_IMAGE_WIDTH = SCREEN_WIDTH - 48; // Account for padding

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ImageMediaProps {
  url: string;
  width?: number;
  height?: number;
  maxHeight?: number;
  onPress?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ImageMedia({
  url,
  width,
  height,
  maxHeight = 400,
  onPress,
}: ImageMediaProps) {
  const { colors: themeColors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Calculate display dimensions
  let displayWidth = MAX_IMAGE_WIDTH;
  let displayHeight = maxHeight;
  
  if (width && height) {
    const aspectRatio = width / height;
    displayWidth = MAX_IMAGE_WIDTH;
    displayHeight = displayWidth / aspectRatio;
    
    // Cap height at maxHeight
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * aspectRatio;
    }
  }
  
  const imageStyle = {
    width: displayWidth,
    height: displayHeight,
  };
  
  const Wrapper = onPress ? AnimatedPressable : View;
  const wrapperProps = onPress ? { onPress } : {};
  
  // Error state - show placeholder
  if (error) {
    return (
      <View style={[styles.container, imageStyle, styles.errorContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
        <Text style={styles.errorIcon}>🖼️</Text>
        <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>Image unavailable</Text>
      </View>
    );
  }

  return (
    <Wrapper style={[styles.container, { backgroundColor: themeColors.border }]} {...wrapperProps}>
      {/* Loading Placeholder */}
      {loading && (
        <View style={[styles.loadingContainer, imageStyle, { backgroundColor: themeColors.border }]}>
          <ActivityIndicator size="small" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading image...</Text>
        </View>
      )}
      
      {/* Image */}
      <Image
        source={{ uri: url }}
        style={[styles.image, imageStyle, loading && styles.hidden]}
        resizeMode="cover"
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={(e) => {
          log('Image load error:', url, e.nativeEvent.error);
          setLoading(false);
          setError(true);
        }}
      />
    </Wrapper>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
  },

  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },

  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.size.xs,
  },

  image: {
  },

  hidden: {
    opacity: 0,
  },

  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorIcon: {
    fontSize: typography.size.xxl,
    marginBottom: spacing.xs,
  },

  errorText: {
    fontSize: typography.size.xs,
  },
});

export default ImageMedia;
