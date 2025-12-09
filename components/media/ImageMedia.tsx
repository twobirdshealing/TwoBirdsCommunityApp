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
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { sizing, spacing } from '@/constants/layout';

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
  
  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.9 } : {};
  
  // Error state - show placeholder
  if (error) {
    return (
      <View style={[styles.container, imageStyle, styles.errorContainer]}>
        <Text style={styles.errorIcon}>🖼️</Text>
        <Text style={styles.errorText}>Image unavailable</Text>
      </View>
    );
  }
  
  return (
    <Wrapper style={styles.container} {...wrapperProps}>
      {/* Loading Placeholder */}
      {loading && (
        <View style={[styles.loadingContainer, imageStyle]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading image...</Text>
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
          console.log('Image load error:', url, e.nativeEvent.error);
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
    backgroundColor: colors.skeleton || '#E5E7EB',
  },
  
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.skeleton || '#E5E7EB',
    zIndex: 1,
  },
  
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textSecondary || '#6B7280',
  },
  
  image: {
    backgroundColor: colors.skeleton || '#E5E7EB',
  },
  
  hidden: {
    opacity: 0,
  },
  
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary || '#F3F4F6',
  },
  
  errorIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  
  errorText: {
    fontSize: 12,
    color: colors.textSecondary || '#6B7280',
  },
});

export default ImageMedia;
