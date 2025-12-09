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
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';

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
  const icon = getProviderIcon(provider, url);
  const providerName = getProviderName(provider, url);
  const domain = getDomain(url);
  
  // Handle tap - open in browser or native app
  const handlePress = () => {
    Linking.openURL(url).catch(err => {
      console.error('Failed to open URL:', err);
    });
  };
  
  // Compact style (no thumbnail)
  if (!thumbnail) {
    return (
      <TouchableOpacity 
        style={styles.compactContainer}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {title || providerName}
          </Text>
          <Text style={styles.compactDomain} numberOfLines={1}>
            {domain}
          </Text>
        </View>
        
        <Text style={styles.externalIcon}>↗</Text>
      </TouchableOpacity>
    );
  }
  
  // Full style (with thumbnail)
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.9}
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
          <Text style={styles.providerText}>{providerName}</Text>
        </View>
        
        {title && (
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        )}
        
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>
      
      {/* Tap to open hint */}
      <View style={styles.openHint}>
        <Text style={styles.openHintText}>Tap to open ↗</Text>
      </View>
    </TouchableOpacity>
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
    backgroundColor: colors.backgroundSecondary,
  },
  
  thumbnail: {
    width: '100%',
    height: 180,
    backgroundColor: colors.skeleton,
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
    fontSize: 14,
    marginRight: spacing.xs,
  },
  
  providerText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },
  
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text,
    lineHeight: typography.size.md * 1.3,
  },
  
  description: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
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
    borderRadius: sizing.borderRadius.xs,
  },
  
  openHintText: {
    color: colors.textInverse,
    fontSize: typography.size.xs,
  },
  
  // Compact style (no thumbnail)
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: sizing.borderRadius.sm,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  
  icon: {
    fontSize: 20,
  },
  
  compactContent: {
    flex: 1,
  },
  
  compactTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    color: colors.text,
  },
  
  compactDomain: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  
  externalIcon: {
    fontSize: 18,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
});

export default LinkPreview;
