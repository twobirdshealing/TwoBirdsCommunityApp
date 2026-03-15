// =============================================================================
// FEED CARD - A single post/feed item in the list
// =============================================================================
// - Bookmark icon
// - 3-dot menu: Copy Link, Pin (admin), Edit (owner), Delete (owner), Report (non-owner)
// - Sticky badge for pinned posts
// =============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { YouTubeEmbed } from '@/components/media/YouTubeEmbed';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { PlayButtonOverlay } from '@/components/media/PlayButtonOverlay';
import { ReactionIcon } from './ReactionIcon';
import { useTheme } from '@/contexts/ThemeContext';
import { useReactionConfig } from '@/hooks/useReactionConfig';
import { useFeedModals } from '@/contexts/FeedModalsContext';
import { shadows, sizing, spacing, typography } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { Feed, ReactionType } from '@/types/feed';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlTags } from '@/utils/htmlToText';
import { HtmlContent } from '@/components/common/HtmlContent';
import { useAuth } from '@/contexts/AuthContext';
import { extractYouTubeId } from '@/utils/youtube';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { SurveyCard } from '@/components/feed/SurveyCard';

// -----------------------------------------------------------------------------
// Media Detection Helper
// -----------------------------------------------------------------------------

interface MediaInfo {
  type: 'image' | 'images' | 'youtube' | 'video' | 'none';
  imageUrl?: string;
  imageUrls?: string[];
  youtubeId?: string;
  videoUrl?: string;
}

function detectMedia(feed: Feed): MediaInfo {
  const message = feed.message || '';
  const messageRendered = feed.message_rendered || '';
  const meta = feed.meta || {};

  // 1. Check for multiple images in meta.media_items (also detect video items)
  if (meta.media_items && Array.isArray(meta.media_items) && meta.media_items.length > 0) {
    // Check for video items first
    const videoItem = meta.media_items.find((item: any) => item.type === 'video' && item.url);
    if (videoItem) {
      return { type: 'video', videoUrl: videoItem.url };
    }

    const imageUrls = meta.media_items
      .filter((item: any) => item.type === 'image' && item.url)
      .map((item: any) => item.url);

    if (imageUrls.length > 1) {
      return { type: 'images', imageUrls, imageUrl: imageUrls[0] };
    } else if (imageUrls.length === 1) {
      return { type: 'image', imageUrl: imageUrls[0] };
    }
  }

  // 2. Check for YouTube in meta.media_preview (oembed from native web)
  if (meta.media_preview?.provider === 'youtube' &&
      meta.media_preview?.content_type === 'video' &&
      meta.media_preview.url) {
    const videoId = extractYouTubeId(meta.media_preview.url);
    if (videoId) {
      return { type: 'youtube', youtubeId: videoId };
    }
  }

  // 2b. Check for direct video in meta.media_preview (FluentPlayer uploads, etc.)
  if (meta.media_preview?.content_type === 'video' && meta.media_preview.url) {
    return { type: 'video', videoUrl: meta.media_preview.url };
  }

  // 3. Check for single image in meta.media_preview (skip if youtube provider)
  if (meta.media_preview?.image && meta.media_preview?.provider !== 'youtube') {
    return { type: 'image', imageUrl: meta.media_preview.image };
  }

  // 4. Check for featured_image
  if (feed.featured_image) {
    return { type: 'image', imageUrl: feed.featured_image };
  }

  // 5. Check for YouTube links in message text (fallback)
  const videoIdFromMessage = extractYouTubeId(message) || extractYouTubeId(messageRendered);
  if (videoIdFromMessage) {
    return { type: 'youtube', youtubeId: videoIdFromMessage };
  }

  return { type: 'none' };
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface FeedCardProps {
  feed: Feed;
  onReact?: (type: ReactionType) => void;
  onAuthorPress?: () => void;
  onSpacePress?: () => void;
  onCommentPress?: () => void;
  onBookmarkToggle?: (isBookmarked: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;  // Pin callback (only passed if user can pin)
  canModerate?: boolean; // If true, shows Edit/Delete/Pin for any post (admin/mod)
  variant?: 'compact' | 'full';  // compact = list view (truncated), full = single post view
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const FeedCard = React.memo(function FeedCard({
  feed,
  onReact,
  onAuthorPress,
  onSpacePress,
  onCommentPress,
  onBookmarkToggle,
  onEdit,
  onDelete,
  onPin,
  canModerate = false,
  variant = 'compact',
}: FeedCardProps) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const { reactions, getReaction, display } = useReactionConfig();
  const defaultReactionId = reactions[0]?.id || 'like';
  const [isBookmarked, setIsBookmarked] = useState(feed.bookmarked || false);
  useEffect(() => { setIsBookmarked(feed.bookmarked || false); }, [feed.bookmarked]);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const { openMenu, openReactionPicker, openReactionBreakdown, openMediaViewer } = useFeedModals();
  const menuButtonRef = useRef<View>(null);
  const reactionButtonRef = useRef<View>(null);
  // Extract data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  const isOwner = user?.id === Number(feed.user_id);
  const isSticky = feed.is_sticky === true || feed.is_sticky === 1;
  const canPin = !!onPin; // If onPin is passed, user can pin
  const canEditOrDelete = isOwner || canModerate;
  
  const spaceName = feed.space?.title || null;
  const timestamp = formatRelativeTime(feed.created_at);
  
  // Content processing
  const rawHtml = feed.message_rendered || feed.message || '';
  const plainTextLength = useMemo(() => stripHtmlTags(rawHtml).length, [rawHtml]);
  const isLongContent = variant === 'compact' && plainTextLength > 300;
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const MAX_COLLAPSED_HEIGHT = 132;
  const { width: windowWidth } = useWindowDimensions();
  // Card has marginHorizontal: spacing.md (12) + padding: spacing.lg (16) on each side
  const contentWidth = windowWidth - spacing.md * 2 - spacing.lg * 2;
  
  // Media detection
  const media = useMemo(() => detectMedia(feed), [feed]);
  const hasImage = media.type === 'image' || media.type === 'images';
  const hasYouTube = media.type === 'youtube';
  const hasVideo = media.type === 'video';
  
  // Stats
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
  const userReactionConfig = getReaction(userReactionType || defaultReactionId);
  const userReactionIconUrl = feed.user_reaction_icon_url || userReactionConfig?.icon_url || null;
  const userReactionEmoji = userReactionConfig?.emoji || '👍';
  const userReactionName = feed.user_reaction_name || userReactionConfig?.name || 'Like';
  const userReactionColor = userReactionConfig?.color;
  const reactionBreakdown = feed.reaction_breakdown || [];

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBookmarkPress = () => {
    hapticLight();
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    onBookmarkToggle?.(newState);
  };

  const handleMenuPress = () => {
    hapticLight();
    (menuButtonRef.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      const screenWidth = Dimensions.get('window').width;
      openMenu({
        feed,
        anchor: { top: y + height + 4, right: screenWidth - x - width },
        isOwner,
        canEditOrDelete,
        canPin,
        isSticky,
        onEdit,
        onDelete,
        onPin,
      });
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      {/* ===== Sticky Indicator ===== */}
      {isSticky && (
        <View style={[styles.stickyBadge, { backgroundColor: withOpacity(themeColors.primary, 0.12) }]}>
          <Ionicons name="pin" size={12} color={themeColors.primary} />
          <Text style={[styles.stickyText, { color: themeColors.primary }]}>Pinned</Text>
        </View>
      )}

      {/* ===== Header ===== */}
      <View style={styles.header}>
        <AnimatedPressable
          style={styles.authorRow}
          onPress={onAuthorPress}
          accessibilityRole="button"
          accessibilityLabel={`View ${authorName}'s profile`}
        >
          <Avatar
            source={authorAvatar}
            size="md"
            fallback={authorName}
          />

          <View style={styles.authorInfo}>
            <UserDisplayName
              name={authorName}
              verified={isVerified}
              badgeSlugs={author?.meta?.badge_slug}
              numberOfLines={1}
            />

            <View style={styles.metaRow}>
              <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>{timestamp}</Text>
              {spaceName && (
                <>
                  <Text style={[styles.dot, { color: themeColors.textTertiary }]}>•</Text>
                  <Pressable onPress={onSpacePress}>
                    <Text style={[styles.spaceName, { color: themeColors.primary }]} numberOfLines={1}>
                      {spaceName}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </AnimatedPressable>

        {/* Header Actions: Bookmark + Menu */}
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerButton}
            onPress={handleBookmarkPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isBookmarked ? themeColors.primary : themeColors.textSecondary}
            />
          </Pressable>

          <Pressable
            ref={menuButtonRef}
            style={styles.headerButton}
            onPress={handleMenuPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Post options"
          >
            <Ionicons name="ellipsis-vertical" size={20} color={themeColors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ===== Title ===== */}
      {feed.title && (
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={variant === 'full' ? undefined : 3}>
          {feed.title}
        </Text>
      )}

      {/* ===== Content ===== */}
      {rawHtml.length > 0 && (
        <View style={[
          styles.contentContainer,
          variant !== 'full' && !expanded ? styles.contentCollapsed : undefined,
        ]}>
          <View onLayout={(e) => {
            if (variant === 'compact' && !expanded) {
              const height = e.nativeEvent.layout.height;
              if (height >= MAX_COLLAPSED_HEIGHT) {
                setIsOverflowing(true);
              }
            }
          }}>
            <HtmlContent html={rawHtml} contentWidth={contentWidth} />
          </View>
        </View>
      )}

      {/* ===== Show More / Show Less ===== */}
      {(isLongContent || isOverflowing) && (
        <Pressable onPress={() => setExpanded(!expanded)}>
          <Text style={[styles.showMoreText, { color: themeColors.primary }]}>
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </Pressable>
      )}

      {/* ===== Image Grid - Tappable to open Media Viewer ===== */}
      {hasImage && (() => {
        const allUrls = media.type === 'images' && media.imageUrls ? media.imageUrls : media.imageUrl ? [media.imageUrl] : [];
        const count = allUrls.length;
        const gridGap = 3;
        const extraCount = count > 4 ? count - 4 : 0;

        const renderGridImage = (url: string, index: number, style: any, isLast4Plus?: boolean) => (
          <AnimatedPressable
            key={index}
            onPress={() => {
              const allImages = media.type === 'images' && media.imageUrls
                ? media.imageUrls.map((u) => ({ url: u }))
                : media.imageUrl ? [{ url: media.imageUrl }] : [];
              openMediaViewer({ images: allImages, initialIndex: index });
            }}
            style={style}
          >
            <Image
              source={{ uri: url }}
              style={styles.gridImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            {isLast4Plus && extraCount > 0 && (
              <View style={styles.gridOverlay}>
                <Text style={styles.gridOverlayText}>+{extraCount}</Text>
              </View>
            )}
          </AnimatedPressable>
        );

        if (count === 1) {
          return (
            <View style={[styles.mediaContainer, { backgroundColor: themeColors.background }]}>
              {renderGridImage(allUrls[0], 0, styles.gridSingle)}
            </View>
          );
        }

        if (count === 2) {
          return (
            <View style={[styles.mediaContainer, styles.gridRow, { backgroundColor: themeColors.background, gap: gridGap }]}>
              {renderGridImage(allUrls[0], 0, styles.gridHalf)}
              {renderGridImage(allUrls[1], 1, styles.gridHalf)}
            </View>
          );
        }

        if (count === 3) {
          return (
            <View style={[styles.mediaContainer, styles.gridRow, { backgroundColor: themeColors.background, gap: gridGap, height: 260 }]}>
              {renderGridImage(allUrls[0], 0, styles.gridHalf)}
              <View style={[styles.gridHalf, { gap: gridGap }]}>
                {renderGridImage(allUrls[1], 1, styles.gridStackItem)}
                {renderGridImage(allUrls[2], 2, styles.gridStackItem)}
              </View>
            </View>
          );
        }

        // 4+ images: 2x2 grid, with +N overlay on 4th if >4
        return (
          <View style={[styles.mediaContainer, { backgroundColor: themeColors.background, height: 260 }]}>
            <View style={[styles.gridRow, { flex: 1, gap: gridGap }]}>
              {renderGridImage(allUrls[0], 0, styles.gridHalf)}
              {renderGridImage(allUrls[1], 1, styles.gridHalf)}
            </View>
            <View style={{ height: gridGap }} />
            <View style={[styles.gridRow, { flex: 1, gap: gridGap }]}>
              {renderGridImage(allUrls[2], 2, styles.gridHalf)}
              {renderGridImage(allUrls[3], 3, styles.gridHalf, count > 4)}
            </View>
          </View>
        );
      })()}
      
      {/* ===== YouTube Video ===== */}
      {hasYouTube && media.youtubeId && (
        <View style={styles.mediaContainer}>
          {!isVideoPlaying ? (
            // Show thumbnail with play button
            <>
              <Image
                source={{ uri: `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg` }}
                style={styles.mediaImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
              <AnimatedPressable
                style={styles.playButton}
                onPress={() => setIsVideoPlaying(true)}
              >
                <PlayButtonOverlay variant="youtube" />
              </AnimatedPressable>
            </>
          ) : (
            // Show in-place player
            <View style={styles.inPlacePlayer}>
              <YouTubeEmbed
                videoId={media.youtubeId}
                playing={isVideoPlaying}
                onStateChange={(state) => {
                  if (state === 'ended') {
                    setIsVideoPlaying(false);
                  }
                }}
              />
            </View>
          )}
        </View>
      )}
      
      {/* ===== Direct Video (FluentPlayer uploads, etc.) ===== */}
      {hasVideo && media.videoUrl && (
        <View style={styles.mediaContainer}>
          {!isVideoPlaying ? (
            // Show thumbnail with play button
            <>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
              <AnimatedPressable
                style={styles.playButton}
                onPress={() => setIsVideoPlaying(true)}
              >
                <PlayButtonOverlay variant="video" />
              </AnimatedPressable>
            </>
          ) : (
            // Mount player only when user taps play
            <VideoPlayer
              url={media.videoUrl}
              onEnd={() => setIsVideoPlaying(false)}
            />
          )}
        </View>
      )}

      {/* ===== Survey/Poll ===== */}
      {feed.content_type === 'survey' && feed.meta?.survey_config && (
        <SurveyCard config={feed.meta.survey_config} feedId={feed.id} />
      )}

      {/* ===== Footer (matches web layout: left actions + right summary) ===== */}
      <View style={[styles.footer, { borderTopColor: themeColors.borderLight }]}>
        {/* Left side: reaction + comment buttons */}
        <View style={styles.footerLeft}>
          {/* Reaction Button - tap for default like, long-press for picker */}
          <AnimatedPressable
            ref={reactionButtonRef}
            style={[
              styles.footerButton,
              hasUserReact && [
                styles.reactionButtonActive,
                { backgroundColor: (userReactionColor || themeColors.primary) + '15' },
              ],
            ]}
            onPress={() => {
              hapticLight();
              if (hasUserReact && userReactionType) {
                onReact?.(userReactionType);
              } else {
                onReact?.(defaultReactionId as ReactionType);
              }
            }}
            onLongPress={() => {
              hapticMedium();
              (reactionButtonRef.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
                openReactionPicker({
                  anchor: { top: y, left: x + width / 2 },
                  currentType: userReactionType,
                  onSelect: (type) => onReact?.(type),
                });
              });
            }}
            delayLongPress={400}
            accessibilityRole="button"
            accessibilityLabel={hasUserReact ? 'Remove reaction' : 'React to post'}
            accessibilityHint="Long press for more reactions"
          >
            <View style={{ opacity: hasUserReact ? 1 : 0.4 }}>
              <ReactionIcon iconUrl={userReactionIconUrl} emoji={userReactionEmoji} size={35} />
            </View>
          </AnimatedPressable>

          {/* Comment button */}
          <AnimatedPressable
            style={styles.footerButton}
            onPress={() => onCommentPress?.()}
            accessibilityRole="button"
            accessibilityLabel={commentsCount > 0 ? `${commentsCount} comments` : 'Comment'}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="chatbubble-outline" size={20} color={themeColors.textSecondary} />
              {commentsCount > 0 && (
                <Text style={[styles.reactionSummaryCount, { color: themeColors.textSecondary }]}>
                  {formatCompactNumber(commentsCount)}
                </Text>
              )}
            </View>
          </AnimatedPressable>
        </View>

        {/* Right side: reaction breakdown summary (tappable) */}
        {reactionBreakdown.length > 0 && reactionsCount > 0 && (
          <Pressable
            style={styles.footerRight}
            onPress={() => openReactionBreakdown({ objectType: 'feed', objectId: feed.id })}
          >
            <View style={styles.reactionEmojiStack}>
              {reactionBreakdown.slice(0, display.count).map((item, i) => (
                <View
                  key={item.type}
                  style={[
                    styles.reactionStackIcon,
                    { zIndex: 10 + i, marginLeft: i === 0 ? 0 : -display.overlap },
                  ]}
                >
                  <ReactionIcon
                    iconUrl={item.icon_url}
                    emoji={item.emoji || '👍'}
                    size={22}
                    stroke={display.stroke}
                    borderColor={themeColors.borderLight}
                  />
                </View>
              ))}
            </View>
            <Text style={[styles.reactionSummaryCount, { color: themeColors.textSecondary }]}>
              {formatCompactNumber(reactionsCount)}
            </Text>
          </Pressable>
        )}
      </View>

    </View>
  );
});

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
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
    fontWeight: typography.weight.semibold,
    marginLeft: spacing.xs,
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
    marginHorizontal: spacing.xs,
  },

  spaceName: {
    fontSize: typography.size.sm,
    maxWidth: 150,
  },

  // Header actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  headerButton: {
    padding: spacing.xs,
  },
  
  // Title
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },

  // Content
  contentContainer: {
    marginBottom: spacing.sm,
  },

  contentCollapsed: {
    maxHeight: 132, // Must match MAX_COLLAPSED_HEIGHT in component
    overflow: 'hidden' as const,
  },

  showMoreText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.md,
  },
  
  // Media Grid
  mediaContainer: {
    marginBottom: spacing.md,
    height: 200,
    overflow: 'hidden',
    borderRadius: sizing.borderRadius.md,
  },

  mediaImage: {
    width: '100%',
    height: '100%',
  },

  gridRow: {
    flexDirection: 'row',
  },

  gridSingle: {
    flex: 1,
  },

  gridHalf: {
    flex: 1,
  },

  gridStackItem: {
    flex: 1,
  },

  gridImage: {
    width: '100%',
    height: '100%',
  },

  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  gridOverlayText: {
    color: '#fff',
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
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

  playIcon: {
    fontSize: typography.size.xxl,
  },

  inPlacePlayer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  // Footer (web-matching layout: left actions + right summary)
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

  reactionStackIcon: {
    // marginLeft and zIndex set inline from display config
  },

  reactionSummaryCount: {
    fontSize: typography.size.sm,
  },
});

export default FeedCard;
