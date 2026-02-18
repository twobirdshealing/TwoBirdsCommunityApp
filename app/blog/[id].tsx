// =============================================================================
// BLOG DETAIL SCREEN - Full blog post with rich HTML rendering
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RenderHtml from 'react-native-render-html';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { WPPost } from '@/types/blog';
import { blogApi } from '@/services/api';
import { PageHeader } from '@/components/navigation';
import { Avatar } from '@/components/common/Avatar';
import { ProfileBadge } from '@/components/common/ProfileBadge';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { BlogCommentSheet } from '@/components/blog';
import { useProfileBadges } from '@/hooks';
import { stripHtmlTags, decodeHtmlEntities } from '@/utils/htmlToText';
import { formatFullDate } from '@/utils/formatDate';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function BlogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors: themeColors } = useTheme();

  // State
  const [post, setPost] = useState<WPPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  // Content width for RenderHtml (screen width minus padding)
  const contentWidth = width - spacing.lg * 2;

  // ---------------------------------------------------------------------------
  // Fetch Post
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;

    const fetchPost = async () => {
      setLoading(true);
      setError(null);

      const numericId = Number(id);
      const response = isNaN(numericId)
        ? await blogApi.getBlogPostBySlug(id)
        : await blogApi.getBlogPost(numericId);

      if (response.success) {
        setPost(response.data);
      } else {
        setError(response.error?.message || 'Failed to load post');
      }

      setLoading(false);
    };

    fetchPost();
  }, [id]);

  // ---------------------------------------------------------------------------
  // Share handler
  // ---------------------------------------------------------------------------

  const handleShare = useCallback(async () => {
    if (!post) return;
    const postTitle = decodeHtmlEntities(stripHtmlTags(post.title.rendered));
    try {
      await Share.share({
        message: `${postTitle}\n${post.link}`,
        url: post.link, // iOS uses url, Android uses message
        title: postTitle,
      });
    } catch {
      // User cancelled or error — silent
    }
  }, [post]);

  // ---------------------------------------------------------------------------
  // Author press handler
  // ---------------------------------------------------------------------------

  const handleAuthorPress = useCallback(() => {
    const slug = post?._embedded?.author?.[0]?.slug;
    if (slug) {
      router.push(`/profile/${slug}`);
    }
  }, [post, router]);

  // ---------------------------------------------------------------------------
  // RenderHtml Tag Styles (theme-aware, memoized)
  // ---------------------------------------------------------------------------

  const tagsStyles = useMemo(
    () => ({
      body: {
        color: themeColors.text,
        fontSize: typography.size.md,
        lineHeight: typography.size.md * typography.lineHeight.relaxed,
      },
      p: {
        marginVertical: spacing.sm,
        color: themeColors.text,
      },
      h1: {
        color: themeColors.text,
        fontSize: typography.size.xxl,
        fontWeight: '700' as const,
        marginVertical: spacing.md,
      },
      h2: {
        color: themeColors.text,
        fontSize: typography.size.xl,
        fontWeight: '600' as const,
        marginVertical: spacing.md,
      },
      h3: {
        color: themeColors.text,
        fontSize: typography.size.lg,
        fontWeight: '600' as const,
        marginVertical: spacing.sm,
      },
      a: {
        color: themeColors.primary,
        textDecorationLine: 'underline' as const,
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: themeColors.primary,
        paddingLeft: spacing.md,
        marginVertical: spacing.md,
        fontStyle: 'italic' as const,
        color: themeColors.textSecondary,
      },
      img: {
        borderRadius: sizing.borderRadius.sm,
      },
      ul: { color: themeColors.text },
      ol: { color: themeColors.text },
      li: { color: themeColors.text, marginVertical: spacing.xs },
      pre: {
        backgroundColor: themeColors.backgroundSecondary,
        padding: spacing.md,
        borderRadius: sizing.borderRadius.sm,
        overflow: 'hidden' as const,
      },
      code: {
        backgroundColor: themeColors.backgroundSecondary,
        fontSize: typography.size.sm,
      },
      em: {
        color: themeColors.text,
      },
      strong: {
        color: themeColors.text,
        fontWeight: '700' as const,
      },
      figure: {
        marginVertical: spacing.md,
      },
      figcaption: {
        color: themeColors.textSecondary,
        fontSize: typography.size.sm,
        textAlign: 'center' as const,
        marginTop: spacing.xs,
      },
    }),
    [themeColors]
  );

  // ---------------------------------------------------------------------------
  // Extract post data (prefer Fluent profile over WP Gravatar)
  // ---------------------------------------------------------------------------

  const author = post?._embedded?.author?.[0];
  const featuredMedia = post?._embedded?.['wp:featuredmedia']?.[0];
  const categories = post?._embedded?.['wp:term']?.[0] || [];
  const embeddedComments = post?._embedded?.replies?.[0] || [];

  const featuredImageUrl =
    featuredMedia?.media_details?.sizes?.large?.source_url ||
    featuredMedia?.source_url ||
    null;

  const title = post ? decodeHtmlEntities(stripHtmlTags(post.title.rendered)) : '';
  const authorName = author?.name || 'Unknown';
  const authorAvatar = author?.fcom_avatar || author?.avatar_urls?.['96'] || null;
  const authorVerified = author?.fcom_is_verified === 1;
  const authorBadges = useProfileBadges(author?.fcom_badge_slugs);
  const date = post ? formatFullDate(post.date) : '';
  const commentCount = embeddedComments.length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Hero image height
  const heroHeight = width * 0.75;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Blog"
          rightIcon="share-outline"
          onRightPress={handleShare}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.retryButton, { backgroundColor: themeColors.primary }]}
            >
              <Text style={[styles.retryText, { color: themeColors.textInverse }]}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : post ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Section */}
            {featuredImageUrl ? (
              <View style={[styles.heroContainer, { height: heroHeight }]}>
                <Image
                  source={{ uri: featuredImageUrl }}
                  style={[StyleSheet.absoluteFillObject, { backgroundColor: themeColors.skeleton }]}
                  resizeMode="cover"
                />
                {/* Gradient overlay */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
                  locations={[0, 0.4, 1]}
                  style={styles.heroGradient}
                >
                  {/* Title at top, centered */}
                  <Text style={styles.heroTitle}>{title}</Text>

                  {/* Bottom: Categories, Author + Comments */}
                  <View>
                    {categories.length > 0 && (
                      <View style={styles.heroCategories}>
                        {categories.map((cat) => (
                          <View
                            key={cat.id}
                            style={styles.heroCategoryPill}
                          >
                            <Text style={styles.heroCategoryText}>{cat.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                  {/* Author + Date + Comments */}
                  <View style={styles.heroBottomRow}>
                    <TouchableOpacity style={styles.heroAuthorRow} onPress={handleAuthorPress} activeOpacity={0.7}>
                      <Avatar source={authorAvatar} size="sm" fallback={authorName} />
                      <View style={styles.heroAuthorInfo}>
                        <View style={styles.heroAuthorNameRow}>
                          <Text style={styles.heroAuthorName}>{authorName}</Text>
                          {authorVerified && <VerifiedBadge size={14} />}
                          {authorBadges.map((badge) => (
                            <ProfileBadge key={badge.slug} badge={badge} />
                          ))}
                        </View>
                        <Text style={styles.heroDate}>{date}</Text>
                      </View>
                    </TouchableOpacity>

                    {post.comment_status === 'open' && (
                      <TouchableOpacity style={styles.heroCommentBadge} onPress={() => setShowComments(true)} activeOpacity={0.7}>
                        <Ionicons name="chatbubble-outline" size={14} color="#fff" />
                        {commentCount > 0 && <Text style={styles.heroCommentText}>{commentCount}</Text>}
                      </TouchableOpacity>
                    )}
                  </View>
                  </View>
                </LinearGradient>
              </View>
            ) : (
              /* No featured image — show title/author normally */
              <View style={styles.articleHeader}>
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
                <Text style={[styles.fallbackTitle, { color: themeColors.text }]}>{title}</Text>
                <View style={styles.fallbackBottomRow}>
                  <TouchableOpacity style={styles.fallbackAuthorRow} onPress={handleAuthorPress} activeOpacity={0.7}>
                    <Avatar source={authorAvatar} size="sm" fallback={authorName} />
                    <View style={styles.fallbackAuthorInfo}>
                      <View style={styles.fallbackAuthorNameRow}>
                        <Text style={[styles.fallbackAuthorName, { color: themeColors.text }]}>{authorName}</Text>
                        {authorVerified && <VerifiedBadge size={14} />}
                        {authorBadges.map((badge) => (
                          <ProfileBadge key={badge.slug} badge={badge} />
                        ))}
                      </View>
                      <Text style={[styles.fallbackDate, { color: themeColors.textTertiary }]}>{date}</Text>
                    </View>
                  </TouchableOpacity>

                  {post.comment_status === 'open' && (
                    <TouchableOpacity style={styles.fallbackCommentBadge} onPress={() => setShowComments(true)} activeOpacity={0.7}>
                      <Ionicons name="chatbubble-outline" size={14} color={themeColors.textTertiary} />
                      {commentCount > 0 && <Text style={[styles.fallbackCommentText, { color: themeColors.textTertiary }]}>{commentCount}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Article Content */}
            <View style={styles.articleContent}>
              <RenderHtml
                contentWidth={contentWidth}
                source={{ html: post.content.rendered }}
                tagsStyles={tagsStyles}
                enableExperimentalBRCollapsing={true}
                enableExperimentalGhostLinesPrevention={true}
                renderersProps={{
                  a: {
                    onPress: (_event: any, href: string) => {
                      if (href) Linking.openURL(href);
                    },
                  },
                  img: {
                    enableExperimentalPercentWidth: true,
                  },
                }}
                defaultTextProps={{
                  selectable: true,
                }}
              />

              {/* Comments Button */}
              {post.comment_status === 'open' && (
                <TouchableOpacity
                  style={[styles.commentButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                  onPress={() => setShowComments(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbubble-outline" size={20} color={themeColors.textSecondary} />
                  <Text style={[styles.commentButtonText, { color: themeColors.text }]}>
                    Comments{commentCount > 0 ? ` (${commentCount})` : ''}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        ) : null}
      </View>

      {/* Comment Sheet */}
      <BlogCommentSheet
        visible={showComments}
        postId={post?.id || null}
        onClose={() => setShowComments(false)}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: spacing.xxxl * 2,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  errorText: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.md,
  },

  retryText: {
    fontWeight: '600',
  },

  // ---------------------------------------------------------------------------
  // Hero (featured image with gradient overlay)
  // ---------------------------------------------------------------------------

  heroContainer: {
    position: 'relative',
    overflow: 'hidden',
  },

  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
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
    fontSize: typography.size.xxl,
    fontWeight: '700',
    lineHeight: typography.size.xxl * typography.lineHeight.tight,
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
    marginLeft: spacing.md,
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

  articleHeader: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },

  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
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
    fontSize: typography.size.xxl,
    fontWeight: '700',
    lineHeight: typography.size.xxl * typography.lineHeight.tight,
    marginBottom: spacing.md,
  },

  fallbackBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
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
    marginLeft: spacing.md,
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

  // ---------------------------------------------------------------------------
  // Article content
  // ---------------------------------------------------------------------------

  articleContent: {
    padding: spacing.lg,
  },

  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },

  commentButtonText: {
    fontSize: typography.size.md,
    fontWeight: '500',
    flex: 1,
  },
});
