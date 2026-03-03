// =============================================================================
// BLOG WIDGET - Single featured blog post card for home page
// =============================================================================
// Shows the latest blog post as a hero card with featured image.
// Returns null if no posts available.
// HomeWidget wrapping is handled externally by the home screen.
// =============================================================================

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { blogApi } from '@/services/api/blog';
import { useCachedData } from '@/hooks/useCachedData';
import { stripHtmlTags, decodeHtmlEntities } from '@/utils/htmlToText';
import { formatSmartDate } from '@/utils/formatDate';
import type { WPPost } from '@/types/blog';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface BlogWidgetProps {
  refreshKey: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function BlogWidget({ refreshKey }: BlogWidgetProps) {
  const router = useRouter();
  const { colors: themeColors } = useTheme();

  const { data: post } = useCachedData<WPPost | null>({
    cacheKey: 'tbc_widget_latest_blog',
    fetcher: async () => {
      const response = await blogApi.getBlogPosts({ per_page: 1 });
      if (!response.success) return null;
      return response.data.posts[0] ?? null;
    },
    refreshKey,
    refreshOnFocus: false,
  });

  if (!post) return null;

  const title = decodeHtmlEntities(stripHtmlTags(post.title.rendered));
  const date = formatSmartDate(post.date);
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
  const imageUrl =
    featuredMedia?.media_details?.sizes?.large?.source_url ||
    featuredMedia?.source_url ||
    null;
  const categories = post._embedded?.['wp:term']?.[0] || [];

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: themeColors.surface }]}
      onPress={() =>
        router.push({ pathname: '/blog/[id]', params: { id: String(post.id) } })
      }
    >
      {imageUrl ? (
        <>
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, { backgroundColor: themeColors.skeleton }]}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.gradient}
          >
            {categories.length > 0 && (
              <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>{categories[0].name}</Text>
              </View>
            )}
            <Text style={styles.titleLight} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.dateLight}>{date}</Text>
          </LinearGradient>
        </>
      ) : (
        <View style={[styles.fallback, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
          <Ionicons name="newspaper-outline" size={28} color={themeColors.primary} />
          <Text style={[styles.titleDark, { color: themeColors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.dateDark, { color: themeColors.textSecondary }]}>{date}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },

  image: {
    width: '100%',
    height: 180,
  },

  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xxxl,
  },

  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: spacing.xs,
  },

  categoryText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: '#fff',
  },

  titleLight: {
    fontSize: typography.size.md,
    fontWeight: '700',
    color: '#fff',
    marginBottom: spacing.xs,
  },

  dateLight: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },

  fallback: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 120,
    justifyContent: 'center',
  },

  titleDark: {
    fontSize: typography.size.md,
    fontWeight: '700',
    textAlign: 'center',
  },

  dateDark: {
    fontSize: typography.size.xs,
  },
});

export default BlogWidget;
