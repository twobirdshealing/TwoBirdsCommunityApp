// =============================================================================
// SINGLE POST VIEW - View a single post with full content
// =============================================================================
// Route: /feed/{id}
// Used for: notifications, deep links, push notifications
// Shows full post content with comments via CommentSheet
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/common/Avatar';
import { YouTubeEmbed } from '@/components/media/YouTubeEmbed';
import { MediaViewer } from '@/components/media/MediaViewer';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { spacing, sizing, typography, shadows } from '@/constants/layout';
import { Feed, ReactionType } from '@/types';
import { feedsApi } from '@/services/api';
import { ReactionPicker } from '@/components/feed/ReactionPicker';
import { ReactionIcon } from '@/components/feed/ReactionIcon';
import { useReactionConfig } from '@/hooks';
import { useFeedReactions } from '@/hooks';
import { REACTION_EMOJI, REACTION_COLORS, REACTION_NAMES } from '@/constants/reactions';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlPreserveBreaks } from '@/utils/htmlToText';

// -----------------------------------------------------------------------------
// Media Detection (same logic as FeedCard)
// -----------------------------------------------------------------------------

interface MediaInfo {
  type: 'image' | 'images' | 'youtube' | 'none';
  imageUrl?: string;
  imageUrls?: string[];
  youtubeId?: string;
}

function detectMedia(feed: Feed): MediaInfo {
  const message = feed.message || '';
  const messageRendered = feed.message_rendered || '';
  const meta = feed.meta || {};

  if (meta.media_items && Array.isArray(meta.media_items) && meta.media_items.length > 0) {
    const imageUrls = meta.media_items
      .filter((item: any) => item.type === 'image' && item.url)
      .map((item: any) => item.url);

    if (imageUrls.length > 1) {
      return { type: 'images', imageUrls, imageUrl: imageUrls[0] };
    } else if (imageUrls.length === 1) {
      return { type: 'image', imageUrl: imageUrls[0] };
    }
  }

  if (meta.media_preview?.provider === 'youtube' &&
      meta.media_preview?.content_type === 'video') {
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = meta.media_preview.url?.match(youtubeRegex);
    if (match) {
      return { type: 'youtube', youtubeId: match[1] };
    }
  }

  if (meta.media_preview?.image && meta.media_preview?.provider !== 'youtube') {
    return { type: 'image', imageUrl: meta.media_preview.image };
  }

  if (feed.featured_image) {
    return { type: 'image', imageUrl: feed.featured_image };
  }

  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = message.match(youtubeRegex) || messageRendered.match(youtubeRegex);
  if (youtubeMatch) {
    return { type: 'youtube', youtubeId: youtubeMatch[1] };
  }

  return { type: 'none' };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SinglePostScreen() {
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const { getReaction, display } = useReactionConfig();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // State
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comment sheet
  const [showComments, setShowComments] = useState(false);

  // Media viewer
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);

  // Video
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Reaction picker
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Adapt single-feed state for the shared reaction hook
  const feedsArray = useMemo(() => feed ? [feed] : [], [feed]);
  const setFeedsArray = useCallback<React.Dispatch<React.SetStateAction<Feed[]>>>((updater) => {
    setFeed(prev => {
      const arr = prev ? [prev] : [];
      const result = typeof updater === 'function' ? updater(arr) : updater;
      return result[0] ?? prev;
    });
  }, []);
  const handleReact = useFeedReactions(feedsArray, setFeedsArray);

  // ---------------------------------------------------------------------------
  // Fetch single feed
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (id) fetchFeed();
  }, [id]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError(null);

      const numericId = Number(id);
      const response = isNaN(numericId)
        ? await feedsApi.getFeedBySlug(id!)
        : await feedsApi.getFeedById(numericId);

      if (response.success && response.data?.data) {
        setFeed(response.data.data);
      } else {
        setError('Post not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------


  const handleBookmark = async () => {
    if (!feed) return;
    const wasBookmarked = feed.bookmarked || false;

    setFeed({ ...feed, bookmarked: !wasBookmarked });

    try {
      await feedsApi.toggleBookmark(feed.id, wasBookmarked);
    } catch (err) {
      setFeed({ ...feed, bookmarked: wasBookmarked });
      console.error('Failed to bookmark:', err);
    }
  };

  const handleCommentAdded = () => {
    fetchFeed(); // Refresh to update comment count
  };

  const handleAuthorPress = () => {
    if (feed?.xprofile?.username) {
      router.push(`/profile/${feed.xprofile.username}`);
    }
  };

  const handleSpacePress = () => {
    if (feed?.space?.slug) {
      router.push(`/space/${feed.space.slug}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading & Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ title: 'Post', headerStyle: { backgroundColor: themeColors.surface }, headerTintColor: themeColors.text }} />
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  if (error || !feed) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ title: 'Post', headerStyle: { backgroundColor: themeColors.surface }, headerTintColor: themeColors.text }} />
        <Ionicons name="alert-circle-outline" size={48} color={themeColors.textTertiary} />
        <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
          {error || 'Post not found'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: themeColors.primary }]}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  const spaceName = feed.space?.title || null;
  const timestamp = formatRelativeTime(feed.created_at);

  const fullContent = stripHtmlPreserveBreaks(feed.message_rendered || feed.message || '');
  const media = detectMedia(feed);
  const hasImage = media.type === 'image' || media.type === 'images';
  const hasYouTube = media.type === 'youtube';

  const reactionsCount = feed.reaction_total
    ? feed.reaction_total
    : typeof feed.reactions_count === 'string'
      ? parseInt(feed.reactions_count, 10)
      : feed.reactions_count || 0;
  const commentsCount = typeof feed.comments_count === 'string'
    ? parseInt(feed.comments_count, 10)
    : feed.comments_count || 0;
  const hasUserReact = feed.has_user_react || false;
  const userReactionType = feed.user_reaction_type || null;
  const userReactionConfig = getReaction(userReactionType || 'like');
  const userReactionIconUrl = feed.user_reaction_icon_url || userReactionConfig?.icon_url || null;
  const userReactionEmoji = userReactionConfig?.emoji || (userReactionType ? REACTION_EMOJI[userReactionType] : '👍');
  const userReactionName = feed.user_reaction_name || userReactionConfig?.name || (userReactionType ? REACTION_NAMES[userReactionType] : 'Like');
  const userReactionColor = userReactionConfig?.color || (userReactionType ? REACTION_COLORS[userReactionType] : undefined);
  const reactionBreakdown = feed.reaction_breakdown || [];
  const isBookmarked = feed.bookmarked || false;

  // Collect images for media viewer
  const mediaImages = hasImage
    ? (media.type === 'images' && media.imageUrls
        ? media.imageUrls.map((url) => ({ url }))
        : media.imageUrl
        ? [{ url: media.imageUrl }]
        : [])
    : [];

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          title: 'Post',
          headerStyle: { backgroundColor: themeColors.surface },
          headerTintColor: themeColors.text,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Post Card ===== */}
        <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
          {/* ===== Sticky Indicator ===== */}
          {(feed.is_sticky === true || feed.is_sticky === 1) && (
            <View style={[styles.stickyBadge, { backgroundColor: themeColors.primaryLight + '20' }]}>
              <Ionicons name="pin" size={12} color={themeColors.primary} />
              <Text style={[styles.stickyText, { color: themeColors.primary }]}>Pinned</Text>
            </View>
          )}

          {/* ===== Header ===== */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.authorRow}
              onPress={handleAuthorPress}
              activeOpacity={0.7}
            >
              <Avatar
                source={authorAvatar}
                size="md"
                verified={isVerified}
                fallback={authorName}
              />
              <View style={styles.authorInfo}>
                <Text style={[styles.authorName, { color: themeColors.text }]} numberOfLines={1}>
                  {authorName}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>{timestamp}</Text>
                  {spaceName && (
                    <>
                      <Text style={[styles.dot, { color: themeColors.textTertiary }]}>{' \u2022 '}</Text>
                      <TouchableOpacity onPress={handleSpacePress}>
                        <Text style={[styles.spaceName, { color: themeColors.primary }]} numberOfLines={1}>
                          {spaceName}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {/* Bookmark */}
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleBookmark}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isBookmarked ? themeColors.primary : themeColors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* ===== Title ===== */}
          {feed.title && (
            <Text style={[styles.title, { color: themeColors.text }]}>
              {feed.title}
            </Text>
          )}

          {/* ===== Full Content (no truncation) ===== */}
          {fullContent.length > 0 && (
            <Text style={[styles.content, { color: themeColors.textSecondary }]}>
              {fullContent}
            </Text>
          )}

          {/* ===== Image(s) ===== */}
          {hasImage && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setMediaViewerIndex(0);
                setShowMediaViewer(true);
              }}
            >
              <View style={[styles.mediaContainer, { backgroundColor: themeColors.background }]}>
                <Image
                  source={{ uri: media.imageUrl }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
                {media.type === 'images' && media.imageUrls && media.imageUrls.length > 1 && (
                  <View style={styles.imageCount}>
                    <Text style={styles.imageCountText}>
                      +{media.imageUrls.length - 1}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* ===== YouTube Video ===== */}
          {hasYouTube && media.youtubeId && (
            <View style={styles.mediaContainer}>
              {!isVideoPlaying ? (
                <>
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg` }}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => setIsVideoPlaying(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.playButtonInner}>
                      <Ionicons name="play" size={24} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  <View style={styles.youtubeLabel}>
                    <Ionicons name="logo-youtube" size={14} color="#fff" />
                    <Text style={styles.youtubeLabelText}>YouTube</Text>
                  </View>
                </>
              ) : (
                <View style={styles.inPlacePlayer}>
                  <YouTubeEmbed
                    videoId={media.youtubeId}
                    playing={isVideoPlaying}
                    onStateChange={(state) => {
                      if (state === 'ended') setIsVideoPlaying(false);
                    }}
                  />
                </View>
              )}
            </View>
          )}

          {/* ===== Footer (web-matching layout) ===== */}
          <View style={[styles.footer, { borderTopColor: themeColors.borderLight }]}>
            {/* Left side: reaction + comment buttons */}
            <View style={styles.footerLeft}>
              <TouchableOpacity
                style={[
                  styles.footerButton,
                  hasUserReact && [
                    styles.reactionButtonActive,
                    { backgroundColor: (userReactionColor || themeColors.primary) + '15' },
                  ],
                ]}
                onPress={() => {
                  if (hasUserReact && userReactionType) {
                    handleReact(feed!.id, userReactionType);
                  } else {
                    handleReact(feed!.id, 'like');
                  }
                }}
                onLongPress={() => setShowReactionPicker(true)}
                delayLongPress={400}
                activeOpacity={0.7}
              >
                <View style={{ opacity: hasUserReact ? 1 : 0.4 }}>
                  <ReactionIcon iconUrl={userReactionIconUrl} emoji={userReactionEmoji} size={20} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerButton}
                onPress={() => setShowComments(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble-outline" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Right side: reaction breakdown summary */}
            {reactionBreakdown.length > 0 && reactionsCount > 0 && (
              <View style={styles.footerRight}>
                <View style={styles.reactionEmojiStack}>
                  {reactionBreakdown.slice(0, display.count).map((item, i) => (
                    <View
                      key={item.type}
                      style={{ zIndex: 10 + i, marginLeft: i === 0 ? 0 : -display.overlap }}
                    >
                      <ReactionIcon
                        iconUrl={item.icon_url}
                        emoji={item.emoji || REACTION_EMOJI[item.type as ReactionType]}
                        size={20}
                        stroke={display.stroke}
                        borderColor={themeColors.borderLight}
                      />
                    </View>
                  ))}
                </View>
                <Text style={[styles.reactionSummaryCount, { color: themeColors.textSecondary }]}>
                  {formatCompactNumber(reactionsCount)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ===== Comment Sheet ===== */}
      <CommentSheet
        visible={showComments}
        feedId={feed.id}
        onClose={() => setShowComments(false)}
        onCommentAdded={handleCommentAdded}
      />

      {/* ===== Reaction Picker ===== */}
      <ReactionPicker
        visible={showReactionPicker}
        onSelect={(type) => handleReact(feed!.id, type)}
        onClose={() => setShowReactionPicker(false)}
        currentType={userReactionType}
      />

      {/* ===== Media Viewer ===== */}
      {hasImage && (
        <MediaViewer
          visible={showMediaViewer}
          images={mediaImages}
          initialIndex={mediaViewerIndex}
          onClose={() => setShowMediaViewer(false)}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingVertical: spacing.md,
  },

  errorText: {
    fontSize: typography.size.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },

  backButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.md,
  },

  backButtonText: {
    color: '#fff',
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  // Card
  card: {
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: sizing.borderRadius.lg,
    ...shadows.sm,
  },

  // Sticky badge
  stickyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.sm,
    alignSelf: 'flex-start',
  },

  stickyText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  authorInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },

  authorName: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  timestamp: {
    fontSize: typography.size.sm,
  },

  dot: {
    fontSize: typography.size.sm,
  },

  spaceName: {
    fontSize: typography.size.sm,
    maxWidth: 150,
  },

  headerButton: {
    padding: spacing.xs,
  },

  // Title
  title: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    marginBottom: spacing.sm,
    lineHeight: 24,
  },

  // Content (full, no truncation)
  content: {
    fontSize: typography.size.md,
    lineHeight: 22,
    marginBottom: spacing.md,
  },

  // Media
  mediaContainer: {
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.md,
    height: 250,
  },

  mediaImage: {
    width: '100%',
    height: '100%',
  },

  imageCount: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.sm,
  },

  imageCountText: {
    color: '#fff',
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  playButtonInner: {
    width: 60,
    height: 42,
    borderRadius: sizing.borderRadius.md,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  youtubeLabel: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.xs,
    gap: 4,
  },

  youtubeLabelText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: '500',
  },

  inPlacePlayer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  // Footer (web-matching layout)
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },

  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  footerButton: {
    padding: spacing.xs,
    borderRadius: sizing.borderRadius.md,
  },

  reactionButtonActive: {},

  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  reactionEmojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  reactionSummaryCount: {
    fontSize: typography.size.sm,
  },
});
