// =============================================================================
// FULL SCREEN POST - Instagram-style swipeable post viewer
// =============================================================================
// UPDATED: Single thumbs up reaction only (no heart)
// UPDATED: Added YouTube video support with fullscreen playback
// UPDATED: Unified thumbnail strip for all media types
// UPDATED: Improved text readability with better overlay
// =============================================================================

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, sizing } from '@/constants/layout';
import { Feed } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtml } from '@/utils/profileUtils';
import { Avatar } from '../common';
import { YouTubeEmbed } from '../media/YouTubeEmbed';

// Layout constants
const HEADER_HEIGHT = 80;
const FOOTER_HEIGHT = 100;
const ACTIONS_WIDTH = 80;

// -----------------------------------------------------------------------------
// Media Detection
// -----------------------------------------------------------------------------

interface MediaInfo {
  imageUrl?: string;
  imageUrls?: string[];
  youtubeId?: string;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

function detectMedia(feed: Feed): MediaInfo {
  const meta = feed.meta || {};
  const message = feed.message || '';
  const messageRendered = feed.message_rendered || '';

  // 1. Check for YouTube in meta.media_preview (oembed from native web)
  if (meta.media_preview?.provider === 'youtube' &&
      meta.media_preview?.content_type === 'video') {
    const youtubeId = extractYouTubeId(meta.media_preview.url || '');
    if (youtubeId) {
      return { youtubeId, imageUrl: meta.media_preview.image };
    }
  }

  // 2. Check for multiple images in meta.media_items
  if (meta.media_items?.length > 0) {
    const urls = meta.media_items
      .filter((item: any) => item.type === 'image' && item.url)
      .map((item: any) => item.url);
    if (urls.length > 0) {
      return { imageUrls: urls, imageUrl: urls[0] };
    }
  }

  // 3. Check for single image in meta.media_preview (skip if youtube)
  if (meta.media_preview?.image && meta.media_preview?.provider !== 'youtube') {
    return { imageUrl: meta.media_preview.image, imageUrls: [meta.media_preview.image] };
  }

  // 4. Check for featured_image
  if (feed.featured_image) {
    return { imageUrl: feed.featured_image, imageUrls: [feed.featured_image] };
  }

  // 5. Check for YouTube links in message text (fallback)
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = message.match(youtubeRegex) || messageRendered.match(youtubeRegex);
  if (youtubeMatch) {
    return { youtubeId: youtubeMatch[1] };
  }

  return {};
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface FullScreenPostProps {
  feed: Feed;
  isActive: boolean;
  onClose: () => void;
  onReact: (type: 'like') => void;
  onCommentPress: () => void;
  onAuthorPress: () => void;
  bottomInset?: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function FullScreenPost({
  feed,
  isActive,
  onClose,
  onReact,
  onCommentPress,
  onAuthorPress,
  bottomInset = 0,
}: FullScreenPostProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const [liked, setLiked] = useState(feed.has_user_react || false);
  const [currentPage, setCurrentPage] = useState(0);
  const [userStartedPlaying, setUserStartedPlaying] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const bounceAnim = useRef(new Animated.Value(1)).current;

  const CONTENT_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - bottomInset;
  const CONTENT_WIDTH = SCREEN_WIDTH - ACTIONS_WIDTH - spacing.lg;

  // Data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  const timestamp = formatRelativeTime(feed.created_at);
  
  const rawContent = stripHtml(feed.message_rendered || feed.message);
  const content = rawContent.replace(/https?:\/\/[^\s]+/gi, '').trim();
  
  // Dynamic font size
  const totalChars = (feed.title?.length || 0) + content.length;
  const fontSize = totalChars < 30 ? 34 : totalChars < 80 ? 28 : totalChars < 150 ? 24 : 
                   totalChars < 300 ? 20 : totalChars < 500 ? 17 : totalChars < 800 ? 15 : 14;
  const titleSize = totalChars < 100 ? 28 : 24;
  
  // Media
  const media = detectMedia(feed);
  const imageCount = media.imageUrls?.length || 0;
  const hasImages = imageCount > 0;
  const hasYouTube = !!media.youtubeId;

  // Video plays when: on video page + post active + user started it
  const isVideoPlaying = isActive && currentPage === 1 && userStartedPlaying;

  // Reset play state when leaving video page or when post becomes inactive
  useEffect(() => {
    if (!isActive || currentPage !== 1) {
      setUserStartedPlaying(false);
    }
  }, [isActive, currentPage]);

  // Reactions
  const reactionsCount = typeof feed.reactions_count === 'string'
    ? parseInt(feed.reactions_count, 10)
    : feed.reactions_count || 0;
  const commentsCount = typeof feed.comments_count === 'string'
    ? parseInt(feed.comments_count, 10)
    : feed.comments_count || 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleLike = () => {
    setLiked(!liked);
    onReact('like');
    
    // Bounce animation
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const onScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(page);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Render text page
  const renderTextPage = () => (
    <View key="page-text" style={[styles.page, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      {/* Background */}
      {media.imageUrl ? (
        <>
          <Image
            source={{ uri: media.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={8}
            cachePolicy="memory-disk"
          />
          <View style={styles.overlay} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
      )}

      <View style={[styles.contentArea, {
        top: HEADER_HEIGHT,
        height: CONTENT_HEIGHT,
        width: CONTENT_WIDTH,
        left: spacing.lg,
      }]}>
        {/* Opaque content card for readability */}
        <View style={styles.contentCard}>
          {feed.title && (
            <Text style={[styles.title, styles.textOnCard, { fontSize: titleSize, lineHeight: titleSize * 1.2 }]}>
              {feed.title}
            </Text>
          )}
          {content.length > 0 && (
            <Text style={[styles.message, styles.textOnCard, { fontSize, lineHeight: fontSize * 1.4 }]}>
              {content}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  // Render image page
  const renderImagePage = (url: string, index: number) => (
    <View key={`page-${index}`} style={[styles.page, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      <Image
        source={{ uri: url }}
        style={styles.fullImage}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={300}
      />
      <View style={styles.imageCounter}>
        <Text style={styles.imageCounterText}>{index + 1} / {imageCount}</Text>
      </View>
    </View>
  );

  // Handle video state changes from the player
  const handleVideoStateChange = (state: string) => {
    if (state === 'ended') {
      setUserStartedPlaying(false);
    }
    // Note: We don't reset on 'paused' because user might just be pausing temporarily
  };

  // Render YouTube video page
  const renderYouTubePage = () => {
    const thumbnailUrl = `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg`;

    return (
      <View key="page-youtube" style={[styles.page, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
        <View style={[styles.youtubeContainer, { top: HEADER_HEIGHT, height: CONTENT_HEIGHT }]}>
          {!userStartedPlaying ? (
            // Show thumbnail with play button - user must tap to start
            <TouchableOpacity
              style={styles.videoThumbnail}
              onPress={() => setUserStartedPlaying(true)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.videoThumbnailImage}
                contentFit="cover"
              />
              <View style={styles.videoPlayOverlay}>
                <View style={styles.videoPlayButton}>
                  <Ionicons name="play" size={32} color="#fff" />
                </View>
              </View>
              <View style={styles.videoYoutubeLabel}>
                <Ionicons name="logo-youtube" size={16} color="#fff" />
                <Text style={styles.videoYoutubeLabelText}>YouTube</Text>
              </View>
            </TouchableOpacity>
          ) : (
            // Show player - controlled by isVideoPlaying
            <YouTubeEmbed
              videoId={media.youtubeId!}
              playing={isVideoPlaying}
              onStateChange={handleVideoStateChange}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      {/* Horizontal pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {renderTextPage()}
        {hasYouTube && renderYouTubePage()}
        {media.imageUrls?.map((url, i) => renderImagePage(url, i))}
      </ScrollView>

      {/* HEADER: Avatar + Author */}
      <TouchableOpacity style={styles.header} onPress={onAuthorPress} activeOpacity={0.8}>
        <Avatar source={authorAvatar} size="lg" verified={isVerified} fallback={authorName} />
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{authorName}</Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
      </TouchableOpacity>

      {/* RIGHT: Actions - SINGLE LIKE BUTTON */}
      <View style={[styles.actions, { bottom: FOOTER_HEIGHT + bottomInset }]}>
        <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Text style={styles.actionIcon}>{liked ? '👍' : '👍'}</Text>
            <Text style={[styles.actionCount, liked && styles.actionCountActive]}>
              {formatCompactNumber(reactionsCount + (liked && !feed.has_user_react ? 1 : 0))}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.actionBtn} onPress={onCommentPress}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>
            {formatCompactNumber(commentsCount)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Thumbnails for media (video and/or images) */}
      {(hasYouTube || hasImages) && (
        <View style={[styles.thumbnails, { bottom: FOOTER_HEIGHT + bottomInset + 10 }]}>
          <View style={styles.thumbStrip}>
            {/* Text page thumbnail */}
            <TouchableOpacity
              style={[styles.thumbItem, currentPage === 0 && styles.thumbActive]}
              onPress={() => scrollRef.current?.scrollTo({ x: 0, animated: true })}
            >
              <Text style={styles.thumbText}>Aa</Text>
            </TouchableOpacity>

            {/* YouTube video thumbnail */}
            {hasYouTube && media.youtubeId && (
              <TouchableOpacity
                style={[styles.thumbItem, currentPage === 1 && styles.thumbActive]}
                onPress={() => scrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true })}
              >
                <Image
                  source={{ uri: `https://img.youtube.com/vi/${media.youtubeId}/default.jpg` }}
                  style={styles.thumbImage}
                  contentFit="cover"
                />
                <View style={styles.thumbPlayIcon}>
                  <Ionicons name="play" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
            )}

            {/* Image thumbnails */}
            {media.imageUrls?.map((url, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.thumbItem, currentPage === (hasYouTube ? i + 2 : i + 1) && styles.thumbActive]}
                onPress={() => scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * (hasYouTube ? i + 2 : i + 1), animated: true })}
              >
                <Image source={{ uri: url }} style={styles.thumbImage} contentFit="cover" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  
  page: {
    backgroundColor: '#000',
  },
  
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)', // WHITE overlay for light theme
  },

  contentArea: {
    position: 'absolute',
    justifyContent: 'center',
    paddingRight: spacing.md,
  },

  contentCard: {
    backgroundColor: 'rgba(255,255,255,0.95)', // Opaque white card
    borderRadius: 16,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  title: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  message: {
    color: '#fff',
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  textOnCard: {
    color: colors.text,
    textShadowColor: 'transparent',
  },

  textDark: {
    color: colors.text,
    textShadowColor: 'transparent',
  },
  
  fullImage: {
    width: '100%',
    height: '100%',
  },

  youtubeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  videoThumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  videoThumbnailImage: {
    width: '100%',
    height: '100%',
  },

  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  videoPlayButton: {
    width: 80,
    height: 56,
    backgroundColor: 'rgba(255,0,0,0.9)',
    borderRadius: sizing.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  videoYoutubeLabel: {
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

  videoYoutubeLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  imageCounter: {
    position: 'absolute',
    top: HEADER_HEIGHT + 10,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  
  imageCounterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: ACTIONS_WIDTH,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    zIndex: 10,
  },
  
  authorInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  
  authorName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },

  timestamp: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },

  timestampLight: {
    color: colors.textSecondary,
  },
  
  actions: {
    position: 'absolute',
    right: spacing.sm,
    alignItems: 'center',
    zIndex: 10,
  },
  
  actionBtn: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 4,
  },
  
  actionIcon: {
    fontSize: 28,
  },
  
  actionCount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  
  actionCountActive: {
    color: colors.primary,
  },
  
  thumbnails: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  
  thumbStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 5,
  },
  
  thumbItem: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginHorizontal: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  
  thumbActive: {
    borderColor: '#fff',
  },
  
  thumbImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },

  thumbPlayIcon: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  thumbText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default FullScreenPost;
