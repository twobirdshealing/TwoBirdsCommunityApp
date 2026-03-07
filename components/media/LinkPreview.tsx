// =============================================================================
// LINK PREVIEW - Rich preview cards for external links
// =============================================================================
// Shows a card with thumbnail, title, and domain for links that
// aren't YouTube/video (Instagram, TikTok, articles, etc.)
// Tapping opens the link in browser or native app.
// =============================================================================

import React from 'react';
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { createLogger } from '@/utils/logger';

const log = createLogger('LinkPreview');

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface LinkPreviewProps {
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
  provider?: string;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

// Extract domain from URL
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// Get provider icon/emoji
function getProviderIcon(provider?: string, url?: string): string {
  const domain = provider || (url ? getDomain(url) : '');
  
  if (domain.includes('instagram')) return '📷';
  if (domain.includes('tiktok')) return '🎵';
  if (domain.includes('twitter') || domain.includes('x.com')) return '𝕏';
  if (domain.includes('reddit')) return '🤖';
  if (domain.includes('facebook')) return '👤';
  if (domain.includes('linkedin')) return '💼';
  if (domain.includes('spotify')) return '🎧';
  if (domain.includes('pinterest')) return '📌';
  if (domain.includes('github')) return '💻';
  if (domain.includes('medium')) return '📝';
  
  return '🔗';
}

// Get provider name for display
function getProviderName(provider?: string, url?: string): string {
  const domain = provider || (url ? getDomain(url) : '');
  
  if (domain.includes('instagram')) return 'Instagram';
  if (domain.includes('tiktok')) return 'TikTok';
  if (domain.includes('twitter')) return 'Twitter';
  if (domain.includes('x.com')) return 'X';
  if (domain.includes('reddit')) return 'Reddit';
  if (domain.includes('facebook')) return 'Facebook';
  if (domain.includes('linkedin')) return 'LinkedIn';
  if (domain.includes('spotify')) return 'Spotify';
  if (domain.includes('pinterest')) return 'Pinterest';
  if (domain.includes('github')) return 'GitHub';
  if (domain.includes('medium')) return 'Medium';
  
  return getDomain(url || '');
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LinkPreview({
  url,
  thumbnail,
  title,
  description,
  provider,
}: LinkPreviewProps) {
  const { colors: themeColors } = useTheme();
  const icon = getProviderIcon(provider, url);
  const providerName = getProviderName(provider, url);
  const domain = getDomain(url);
  
  // Handle tap - open in browser or native app
  const handlePress = () => {
    Linking.openURL(url).catch(err => {
      log.error('Failed to open URL:', err);
    });
  };
  
  // Compact style (no thumbnail)
  if (!thumbnail) {
    return (
      <AnimatedPressable
        style={[styles.compactContainer, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
        onPress={handlePress}
      >
        <View style={[styles.iconContainer, { backgroundColor: themeColors.background }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <View style={styles.compactContent}>
          <Text style={[styles.compactTitle, { color: themeColors.text }]} numberOfLines={1}>
            {title || providerName}
          </Text>
          <Text style={[styles.compactDomain, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {domain}
          </Text>
        </View>

        <Text style={[styles.externalIcon, { color: themeColors.textSecondary }]}>↗</Text>
      </AnimatedPressable>
    );
  }
  
  // Full style (with thumbnail)
  return (
    <AnimatedPressable
      style={[styles.container, { backgroundColor: themeColors.backgroundSecondary }]}
      onPress={handlePress}
    >
      {/* Thumbnail */}
      <Image
        source={{ uri: thumbnail }}
        style={styles.thumbnail}
        resizeMode="cover"
      />

      {/* Content Overlay */}
      <View style={styles.contentOverlay}>
        <View style={styles.providerBadge}>
          <Text style={styles.providerIcon}>{icon}</Text>
          <Text style={[styles.providerText, { color: themeColors.textSecondary }]}>{providerName}</Text>
        </View>

        {title && (
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
            {title}
          </Text>
        )}

        {description && (
          <Text style={[styles.description, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>

      {/* Tap to open hint */}
      <View style={styles.openHint}>
        <Text style={styles.openHintText}>Tap to open ↗</Text>
      </View>
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Full style (with thumbnail)
  container: {
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
  },
  
  thumbnail: {
    width: '100%',
    height: 180,
  },
  
  contentOverlay: {
    padding: spacing.md,
  },
  
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  
  providerIcon: {
    fontSize: typography.size.sm,
    marginRight: spacing.xs,
  },
  
  providerText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.md * 1.3,
  },
  
  description: {
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
    lineHeight: typography.size.sm * 1.4,
  },
  
  openHint: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.sm,
  },
  
  openHintText: {
    fontSize: typography.size.xs,
  },
  
  // Compact style (no thumbnail)
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  
  iconContainer: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    borderRadius: sizing.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  
  icon: {
    fontSize: typography.size.xl,
  },
  
  compactContent: {
    flex: 1,
  },
  
  compactTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  
  compactDomain: {
    fontSize: typography.size.sm,
    marginTop: 2,
  },
  
  externalIcon: {
    fontSize: typography.size.lg,
    marginLeft: spacing.sm,
  },
});

export default LinkPreview;
