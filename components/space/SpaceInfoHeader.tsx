// =============================================================================
// SPACE INFO HEADER - Hero cover + stats + description + quick post box
// =============================================================================
// Extracted from app/space/[slug]/index.tsx. Renders the space's cover image,
// logo, title, privacy badge, member/post counts, description, and quick post.
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Space } from '@/types/space';
import { QuickPostBox } from '@/components/composer/QuickPostBox';
import { stripHtmlPreserveBreaks } from '@/utils/htmlToText';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SpaceInfoHeaderProps {
  space: Space;
  onPostPress: () => void;
  hidePostBox?: boolean;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const getPrivacyIcon = (privacy: string): keyof typeof Ionicons.glyphMap => {
  switch (privacy) {
    case 'public': return 'globe-outline';
    case 'private': return 'lock-closed-outline';
    case 'secret': return 'eye-off-outline';
    default: return 'globe-outline';
  }
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SpaceInfoHeader({ space, onPostPress, hidePostBox }: SpaceInfoHeaderProps) {
  const { colors: themeColors } = useTheme();

  const descriptionText = stripHtmlPreserveBreaks(
    space.description_rendered || space.description
  );

  return (
    <View style={styles.spaceHeader}>
      {/* Hero Cover Section */}
      <View style={styles.heroContainer}>
        {space.cover_photo && !space.cover_photo.includes('fluent-community/assets/images/') ? (
          <Image
            source={{ uri: space.cover_photo }}
            style={styles.coverImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <View style={[styles.coverImage, { backgroundColor: themeColors.lightBg, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="people-outline" size={40} color={themeColors.textTertiary} />
          </View>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.heroOverlay}
        >
          <View style={styles.heroContent}>
            {space.logo && (
              <Image
                source={{ uri: space.logo }}
                style={styles.heroLogo}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            )}
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle} numberOfLines={2}>{space.title}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStatItem}>
                  <Ionicons name={getPrivacyIcon(space.privacy)} size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.heroStatText}>
                    {space.privacy.charAt(0).toUpperCase() + space.privacy.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Description (below cover, respects theme) */}
      {descriptionText ? (
        <View style={styles.descriptionContainer}>
          <Text style={[styles.spaceDescription, { color: themeColors.textSecondary }]} numberOfLines={3}>
            {descriptionText}
          </Text>
        </View>
      ) : null}

      {/* Quick Post Box */}
      {!hidePostBox && (
        <QuickPostBox
          onPress={onPostPress}
          placeholder={`Post in ${space.title}...`}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  spaceHeader: {
    marginBottom: spacing.md,
  },

  heroContainer: {
    aspectRatio: 16 / 9,
    position: 'relative',
  },

  coverImage: {
    width: '100%',
    height: '100%',
  },

  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  heroLogo: {
    width: 52,
    height: 52,
    borderRadius: sizing.borderRadius.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    marginRight: spacing.sm,
  },

  heroTextContainer: {
    flex: 1,
  },

  heroTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: '#fff',
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  heroStatText: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: typography.weight.medium,
  },

  descriptionContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },

  spaceDescription: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.4,
    marginBottom: spacing.sm,
  },
});
