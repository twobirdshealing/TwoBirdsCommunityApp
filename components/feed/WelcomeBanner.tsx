// =============================================================================
// WELCOME BANNER - Displays welcome banner above feed
// =============================================================================
// Shows banner from /feeds/welcome-banner API when enabled
// Supports: Image, Video (YouTube), Title, Description, CTA Buttons
// Position: Above QuickPostBox on main Activity feed
// =============================================================================

import React from 'react';
import {
  Dimensions,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { WelcomeBanner as WelcomeBannerType, WelcomeBannerButton } from '@/types';
import { stripHtmlTags } from '@/utils/htmlToText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - (spacing.md * 2);
const IMAGE_HEIGHT = 200;

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface WelcomeBannerProps {
  banner: WelcomeBannerType;
}

// -----------------------------------------------------------------------------
// Helper: Extract YouTube ID from URL
// -----------------------------------------------------------------------------

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

// -----------------------------------------------------------------------------
// CTA Button Component
// -----------------------------------------------------------------------------

interface CTAButtonProps {
  button: WelcomeBannerButton;
}

function CTAButton({ button }: CTAButtonProps) {
  const handlePress = () => {
    if (button.link) {
      Linking.openURL(button.link).catch(err => {
        console.error('Failed to open URL:', err);
      });
    }
  };

  // Style based on button type
  const getButtonStyle = () => {
    switch (button.type) {
      case 'primary':
        return styles.buttonPrimary;
      case 'secondary':
        return styles.buttonSecondary;
      case 'text':
      case 'link':
        return styles.buttonText;
      default:
        return styles.buttonPrimary;
    }
  };

  const getTextStyle = () => {
    switch (button.type) {
      case 'primary':
        return styles.buttonPrimaryText;
      case 'secondary':
        return styles.buttonSecondaryText;
      case 'text':
      case 'link':
        return styles.buttonTextText;
      default:
        return styles.buttonPrimaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, getButtonStyle()]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={[styles.buttonLabel, getTextStyle()]}>{button.label}</Text>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function WelcomeBanner({ banner }: WelcomeBannerProps) {
  // Don't render if not enabled
  if (banner.enabled !== 'yes') {
    return null;
  }

  // Get clean description text
  const description = stripHtmlTags(banner.description_rendered);

  // Check for YouTube video
  const hasYouTube = banner.mediaType === 'video' && 
    banner.bannerVideo?.type === 'oembed' && 
    banner.bannerVideo?.url;
  
  const youtubeId = hasYouTube && banner.bannerVideo?.url 
    ? extractYouTubeId(banner.bannerVideo.url) 
    : null;

  // Handle YouTube thumbnail press
  const handleYouTubePress = () => {
    if (banner.bannerVideo?.url) {
      Linking.openURL(banner.bannerVideo.url).catch(err => {
        console.error('Failed to open YouTube URL:', err);
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Media: Image or YouTube Thumbnail */}
      {banner.mediaType === 'image' && banner.bannerImage && (
        <Image
          source={{ uri: banner.bannerImage }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
      )}

      {hasYouTube && youtubeId && (
        <TouchableOpacity 
          onPress={handleYouTubePress}
          activeOpacity={0.9}
          style={styles.videoContainer}
        >
          <Image
            source={{ uri: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        {banner.title && (
          <Text style={styles.title}>{banner.title}</Text>
        )}

        {/* Description */}
        {description && (
          <Text style={styles.description}>{description}</Text>
        )}

        {/* CTA Buttons */}
        {banner.ctaButtons && banner.ctaButtons.length > 0 && (
          <View style={styles.buttonsContainer}>
            {banner.ctaButtons.map((btn, index) => (
              <CTAButton key={`${btn.label}-${index}`} button={btn} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: sizing.borderRadius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Image
  bannerImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: colors.skeleton,
  },

  // Video
  videoContainer: {
    position: 'relative',
  },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  playIcon: {
    fontSize: 24,
    color: colors.text,
    marginLeft: 4, // Visual center for play icon
  },

  // Content
  content: {
    padding: spacing.md,
  },

  title: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },

  description: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    lineHeight: typography.size.md * 1.5,
    marginBottom: spacing.md,
  },

  // Buttons
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },

  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: sizing.borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },

  buttonPrimary: {
    backgroundColor: colors.primary,
  },

  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  buttonText: {
    backgroundColor: 'transparent',
  },

  buttonLabel: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  buttonPrimaryText: {
    color: colors.textInverse,
  },

  buttonSecondaryText: {
    color: colors.primary,
  },

  buttonTextText: {
    color: colors.primary,
  },
});

export default WelcomeBanner;
