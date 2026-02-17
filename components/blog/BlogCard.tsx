// =============================================================================
// BLOG CARD - Card component for blog post list items
// =============================================================================
// Displays: featured image, title, excerpt, author + date
// Used in: app/blog/index.tsx (blog list)
// =============================================================================

import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { WPPost } from '@/types/blog';
import { Avatar } from '@/components/common/Avatar';
import { stripHtmlTags } from '@/utils/htmlToText';
import { formatSmartDate } from '@/utils/formatDate';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface BlogCardProps {
  post: WPPost;
  onPress: () => void;
  onAuthorPress?: (authorSlug: string) => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Decode HTML entities that WordPress puts in titles */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#8217;/g, '\u2019')  // right single quote
    .replace(/&#8216;/g, '\u2018')  // left single quote
    .replace(/&#8220;/g, '\u201C')  // left double quote
    .replace(/&#8221;/g, '\u201D')  // right double quote
    .replace(/&#8211;/g, '\u2013')  // en dash
    .replace(/&#8212;/g, '\u2014')  // em dash
    .replace(/&#8230;/g, '\u2026')  // ellipsis
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function BlogCard({ post, onPress, onAuthorPress }: BlogCardProps) {
  const { colors: themeColors } = useTheme();

  // Extract embedded data
  const author = post._embedded?.author?.[0];
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
  const categories = post._embedded?.['wp:term']?.[0] || [];
  const embeddedComments = post._embedded?.replies?.[0] || [];

  // Featured image — prefer large size, fall back to source_url
  const featuredImageUrl =
    featuredMedia?.media_details?.sizes?.large?.source_url ||
    featuredMedia?.source_url ||
    null;

  const title = decodeHtmlEntities(stripHtmlTags(post.title.rendered));
  const excerpt = stripHtmlTags(post.excerpt.rendered);
  const authorName = author?.name || 'Unknown';
  const authorAvatar = author?.avatar_urls?.['96'] || author?.avatar_urls?.['48'] || null;
  const date = formatSmartDate(post.date);
  const commentCount = embeddedComments.length;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: themeColors.surface }, shadows.sm]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Featured Image */}
      {featuredImageUrl && (
        <Image
          source={{ uri: featuredImageUrl }}
          style={[styles.featuredImage, { backgroundColor: themeColors.skeleton }]}
          resizeMode="cover"
        />
      )}

      <View style={styles.content}>
        {/* Categories */}
        {categories.length > 0 && (
          <View style={styles.categories}>
            {categories.map((cat) => (
              <View
                key={cat.id}
                style={[styles.categoryPill, { backgroundColor: themeColors.primaryLight + '20' }]}
              >
                <Text style={[styles.categoryText, { color: themeColors.primary }]}>
                  {cat.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Title */}
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={3}>
          {title}
        </Text>

        {/* Excerpt */}
        {excerpt ? (
          <Text style={[styles.excerpt, { color: themeColors.textSecondary }]} numberOfLines={3}>
            {excerpt}
          </Text>
        ) : null}

        {/* Author Row */}
        <View style={styles.authorRow}>
          <TouchableOpacity
            style={styles.authorTouchable}
            onPress={() => {
              if (onAuthorPress && author?.slug) onAuthorPress(author.slug);
            }}
            activeOpacity={onAuthorPress && author?.slug ? 0.7 : 1}
            disabled={!onAuthorPress || !author?.slug}
          >
            <Avatar source={authorAvatar} size="xs" fallback={authorName} />
            <Text style={[styles.authorName, { color: themeColors.text }]} numberOfLines={1}>
              {authorName}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.dot, { color: themeColors.textTertiary }]}>{'\u00B7'}</Text>
          <Text style={[styles.date, { color: themeColors.textTertiary }]}>{date}</Text>

          {/* Comment count */}
          {commentCount > 0 && (
            <View style={styles.commentCount}>
              <Ionicons name="chatbubble-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.commentCountText, { color: themeColors.textTertiary }]}>
                {commentCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  featuredImage: {
    width: '100%',
    height: 200,
  },

  content: {
    padding: spacing.lg,
  },

  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },

  categoryPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.full,
  },

  categoryText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    lineHeight: typography.size.lg * typography.lineHeight.tight,
    marginBottom: spacing.sm,
  },

  excerpt: {
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
    marginBottom: spacing.md,
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  authorTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },

  authorName: {
    fontSize: typography.size.sm,
    fontWeight: '500',
    marginLeft: spacing.sm,
    flexShrink: 1,
  },

  dot: {
    fontSize: typography.size.sm,
    marginHorizontal: spacing.xs,
  },

  date: {
    fontSize: typography.size.xs,
  },

  commentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 4,
  },

  commentCountText: {
    fontSize: typography.size.xs,
  },
});

export default BlogCard;
