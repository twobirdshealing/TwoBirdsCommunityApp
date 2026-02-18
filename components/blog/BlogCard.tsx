// =============================================================================
// BLOG CARD - Card component for blog post list items
// =============================================================================
// Hero-style card: featured image with gradient overlay (title, author, date)
// Footer: excerpt + "Read Article" button + read time + comment count
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
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { WPPost } from '@/types/blog';
import { Avatar } from '@/components/common/Avatar';
import { ProfileBadge } from '@/components/common/ProfileBadge';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { useProfileBadges } from '@/hooks';
import { stripHtmlTags, decodeHtmlEntities } from '@/utils/htmlToText';
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
  const authorName = author?.name || 'Unknown';
  const authorAvatar = author?.fcom_avatar || author?.avatar_urls?.['96'] || null;
  const authorVerified = author?.fcom_is_verified === 1;
  const authorBadges = useProfileBadges(author?.fcom_badge_slugs);
  const date = formatSmartDate(post.date);
  const commentCount = embeddedComments.length;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: themeColors.surface }, shadows.sm]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Hero Section */}
      {featuredImageUrl ? (
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: featuredImageUrl }}
            style={[StyleSheet.absoluteFillObject, { backgroundColor: themeColors.skeleton }]}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
            locations={[0, 0.4, 1]}
            style={styles.heroGradient}
          >
            {/* Title at top, centered */}
            <Text style={styles.heroTitle} numberOfLines={3}>
              {title}
            </Text>

            {/* Bottom: Author left, Comments right */}
            <View>
              {categories.length > 0 && (
                <View style={styles.heroCategories}>
                  {categories.map((cat) => (
                    <View key={cat.id} style={styles.heroCategoryPill}>
                      <Text style={styles.heroCategoryText}>{cat.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.heroBottomRow}>
                <TouchableOpacity
                  style={styles.heroAuthorRow}
                  onPress={() => {
                    if (onAuthorPress && author?.slug) onAuthorPress(author.slug);
                  }}
                  activeOpacity={onAuthorPress && author?.slug ? 0.7 : 1}
                  disabled={!onAuthorPress || !author?.slug}
                >
                  <Avatar source={authorAvatar} size="sm" fallback={authorName} />
                  <View style={styles.heroAuthorInfo}>
                    <View style={styles.heroAuthorNameRow}>
                      <Text style={styles.heroAuthorName} numberOfLines={1}>
                        {authorName}
                      </Text>
                      {authorVerified && <VerifiedBadge size={14} />}
                      {authorBadges.map((badge) => (
                        <ProfileBadge key={badge.slug} badge={badge} />
                      ))}
                    </View>
                    <Text style={styles.heroDate}>{date}</Text>
                  </View>
                </TouchableOpacity>

                {commentCount > 0 && (
                  <View style={styles.heroCommentBadge}>
                    <Ionicons name="chatbubble-outline" size={14} color="#fff" />
                    <Text style={styles.heroCommentText}>{commentCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      ) : (
        /* No featured image — simple header */
        <View style={styles.fallbackHeader}>
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
          <Text style={[styles.fallbackTitle, { color: themeColors.text }]} numberOfLines={3}>
            {title}
          </Text>
          <View style={styles.fallbackBottomRow}>
            <TouchableOpacity
              style={styles.fallbackAuthorRow}
              onPress={() => {
                if (onAuthorPress && author?.slug) onAuthorPress(author.slug);
              }}
              activeOpacity={onAuthorPress && author?.slug ? 0.7 : 1}
              disabled={!onAuthorPress || !author?.slug}
            >
              <Avatar source={authorAvatar} size="sm" fallback={authorName} />
              <View style={styles.fallbackAuthorInfo}>
                <View style={styles.fallbackAuthorNameRow}>
                  <Text style={[styles.fallbackAuthorName, { color: themeColors.text }]} numberOfLines={1}>
                    {authorName}
                  </Text>
                  {authorVerified && <VerifiedBadge size={14} />}
                  {authorBadges.map((badge) => (
                    <ProfileBadge key={badge.slug} badge={badge} />
                  ))}
                </View>
                <Text style={[styles.fallbackDate, { color: themeColors.textTertiary }]}>{date}</Text>
              </View>
            </TouchableOpacity>

            {commentCount > 0 && (
              <View style={styles.fallbackCommentBadge}>
                <Ionicons name="chatbubble-outline" size={14} color={themeColors.textTertiary} />
                <Text style={[styles.fallbackCommentText, { color: themeColors.textTertiary }]}>
                  {commentCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
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

  // ---------------------------------------------------------------------------
  // Hero (featured image with gradient overlay)
  // ---------------------------------------------------------------------------

  heroContainer: {
    height: 220,
    position: 'relative',
    overflow: 'hidden',
  },

  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },

  heroCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },

  heroCategoryPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  heroCategoryText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: '#fff',
  },

  heroTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    lineHeight: typography.size.lg * typography.lineHeight.tight,
    color: '#fff',
    textAlign: 'center',
  },

  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  heroAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  heroCommentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.full,
  },

  heroCommentText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: '#fff',
  },

  heroAuthorInfo: {
    marginLeft: spacing.sm,
    flexShrink: 1,
  },

  heroAuthorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  heroAuthorName: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: '#fff',
  },

  heroDate: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // ---------------------------------------------------------------------------
  // Fallback header (no featured image)
  // ---------------------------------------------------------------------------

  fallbackHeader: {
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

  fallbackTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    lineHeight: typography.size.lg * typography.lineHeight.tight,
    marginBottom: spacing.sm,
  },

  fallbackBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  fallbackAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  fallbackCommentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  fallbackCommentText: {
    fontSize: typography.size.xs,
  },

  fallbackAuthorInfo: {
    marginLeft: spacing.sm,
    flexShrink: 1,
  },

  fallbackAuthorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  fallbackAuthorName: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  fallbackDate: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },

});

export default BlogCard;
