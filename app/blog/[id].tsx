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
import RenderHtml from 'react-native-render-html';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { WPPost } from '@/types/blog';
import { Profile } from '@/types';
import { blogApi, profilesApi } from '@/services/api';
import { PageHeader } from '@/components/navigation';
import { Avatar } from '@/components/common/Avatar';
import { BlogCommentSheet } from '@/components/blog';
import { stripHtmlTags } from '@/utils/htmlToText';
import { formatFullDate } from '@/utils/formatDate';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8230;/g, '\u2026')
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
  const [authorProfile, setAuthorProfile] = useState<Profile | null>(null);

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
  // Fetch Fluent Community profile for the author (real avatar, verified badge)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const authorSlug = post?._embedded?.author?.[0]?.slug;
    if (!authorSlug) return;

    const fetchAuthorProfile = async () => {
      try {
        const response = await profilesApi.getProfile(authorSlug);
        if (response.success && response.data.profile) {
          setAuthorProfile(response.data.profile);
        }
      } catch {
        // Silent fail — will fall back to WP data
      }
    };

    fetchAuthorProfile();
  }, [post]);

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
    const username = authorProfile?.username || post?._embedded?.author?.[0]?.slug;
    if (username) {
      router.push(`/profile/${username}`);
    }
  }, [authorProfile, post, router]);

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
  const authorName = authorProfile?.display_name || author?.name || 'Unknown';
  const authorAvatar = authorProfile?.avatar || author?.avatar_urls?.['96'] || null;
  const authorVerified = authorProfile ? authorProfile.is_verified === 1 : false;
  const date = post ? formatFullDate(post.date) : '';
  const commentCount = embeddedComments.length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
            {/* Featured Image */}
            {featuredImageUrl && (
              <Image
                source={{ uri: featuredImageUrl }}
                style={[styles.featuredImage, { backgroundColor: themeColors.skeleton }]}
                resizeMode="cover"
              />
            )}

            <View style={styles.articleContent}>
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
              <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>

              {/* Author + Date */}
              <TouchableOpacity style={styles.authorRow} onPress={handleAuthorPress} activeOpacity={0.7}>
                <Avatar source={authorAvatar} size="sm" fallback={authorName} verified={authorVerified} />
                <View style={styles.authorInfo}>
                  <Text style={[styles.authorName, { color: themeColors.text }]}>{authorName}</Text>
                  <Text style={[styles.date, { color: themeColors.textTertiary }]}>{date}</Text>
                </View>
              </TouchableOpacity>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: themeColors.borderLight }]} />

              {/* Rich HTML Content */}
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

  featuredImage: {
    width: '100%',
    height: 240,
  },

  articleContent: {
    padding: spacing.lg,
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

  title: {
    fontSize: typography.size.xxl,
    fontWeight: '700',
    lineHeight: typography.size.xxl * typography.lineHeight.tight,
    marginBottom: spacing.md,
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  authorInfo: {
    marginLeft: spacing.md,
  },

  authorName: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  date: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },

  divider: {
    height: 1,
    marginBottom: spacing.md,
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
