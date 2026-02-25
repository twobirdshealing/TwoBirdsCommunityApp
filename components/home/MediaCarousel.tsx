// =============================================================================
// MEDIA CAROUSEL - Swipeable blog + YouTube cards for home page
// =============================================================================
// Fetches latest blog posts and YouTube videos, interleaves them into a
// swipeable carousel with peek effect (next card visible at edge).
// YouTube plays inline using YouTubeEmbed (same pattern as FeedCard).
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { blogApi, youtubeApi, YouTubeVideo } from '@/services/api';
import { WPPost } from '@/types/blog';
import { YouTubeEmbed } from '@/components/media/YouTubeEmbed';
import { stripHtmlTags, decodeHtmlEntities } from '@/utils/htmlToText';
import { formatSmartDate } from '@/utils/formatDate';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PEEK_WIDTH = 40; // How much of the next card peeks
const CARD_GAP = spacing.sm;
const CARD_WIDTH = SCREEN_WIDTH - spacing.lg - PEEK_WIDTH - CARD_GAP;
const CARD_HEIGHT = 200;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type CarouselCard =
  | { type: 'blog'; id: number; data: WPPost }
  | { type: 'youtube'; id: string; data: YouTubeVideo };

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface MediaCarouselProps {
  refreshKey: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MediaCarousel({ refreshKey }: MediaCarouselProps) {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Data state
  const [blogPosts, setBlogPosts] = useState<WPPost[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);

  // Carousel state
  const [activeIndex, setActiveIndex] = useState(0);

  // YouTube playback — track which card index is playing
  const [playingCardIndex, setPlayingCardIndex] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch data (multiple of each)
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    const [blogResult, youtubeResult] = await Promise.allSettled([
      blogApi.getBlogPosts({ per_page: 3 }),
      youtubeApi.getLatestVideos(3),
    ]);

    if (blogResult.status === 'fulfilled' && blogResult.value.success) {
      setBlogPosts(blogResult.value.data.posts);
    }

    if (youtubeResult.status === 'fulfilled' && youtubeResult.value) {
      setVideos(youtubeResult.value.videos);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    setPlayingCardIndex(null);
    fetchData();
  }, [fetchData, refreshKey]);

  // ---------------------------------------------------------------------------
  // Build interleaved card list
  // ---------------------------------------------------------------------------

  const cards: CarouselCard[] = [];
  const maxLen = Math.max(blogPosts.length, videos.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < blogPosts.length) {
      cards.push({ type: 'blog', id: blogPosts[i].id, data: blogPosts[i] });
    }
    if (i < videos.length) {
      cards.push({ type: 'youtube', id: videos[i].videoId, data: videos[i] });
    }
  }

  // ---------------------------------------------------------------------------
  // Scroll handler
  // ---------------------------------------------------------------------------

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SNAP_INTERVAL);
      setActiveIndex(Math.min(index, cards.length - 1));
    },
    [cards.length]
  );

  // Stop video if user scrolls away
  const handleScrollBegin = useCallback(() => {
    if (playingCardIndex !== null) {
      setPlayingCardIndex(null);
    }
  }, [playingCardIndex]);

  // ---------------------------------------------------------------------------
  // Loading / empty
  // ---------------------------------------------------------------------------

  if (loading && cards.length === 0) {
    return (
      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  }

  if (cards.length === 0) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollBeginDrag={handleScrollBegin}
      >
        {cards.map((card, index) => (
          <View
            key={`${card.type}-${card.id}`}
            style={[
              styles.card,
              { backgroundColor: themeColors.surface },
              shadows.sm,
              { marginRight: CARD_GAP },
            ]}
          >
            {card.type === 'blog' ? (
              <BlogCard
                post={card.data}
                themeColors={themeColors}
                onPress={() => router.push(`/blog/${card.data.id}`)}
              />
            ) : (
              <YouTubeCard
                video={card.data}
                themeColors={themeColors}
                isPlaying={playingCardIndex === index}
                onPlay={() => setPlayingCardIndex(index)}
                onStateChange={(state) => {
                  if (state === 'ended') setPlayingCardIndex(null);
                }}
              />
            )}
          </View>
        ))}
      </ScrollView>

      {/* Progress indicator */}
      {cards.length > 1 && (
        <View style={styles.indicatorRow}>
          <View style={[styles.indicatorTrack, { backgroundColor: themeColors.border }]}>
            <View
              style={[
                styles.indicatorFill,
                {
                  backgroundColor: themeColors.primary,
                  width: `${((activeIndex + 1) / cards.length) * 100}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.indicatorText, { color: themeColors.textSecondary }]}>
            {activeIndex + 1}/{cards.length}
          </Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// BLOG CARD (inside carousel)
// =============================================================================

interface BlogCardInnerProps {
  post: WPPost;
  themeColors: any;
  onPress: () => void;
}

function BlogCard({ post, themeColors, onPress }: BlogCardInnerProps) {
  const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
  const imageUrl =
    featuredMedia?.media_details?.sizes?.large?.source_url ||
    featuredMedia?.source_url ||
    null;
  const title = decodeHtmlEntities(stripHtmlTags(post.title.rendered));
  const categories = post._embedded?.['wp:term']?.[0] || [];
  const date = formatSmartDate(post.date);

  return (
    <TouchableOpacity style={styles.cardInner} onPress={onPress} activeOpacity={0.8}>
      {imageUrl ? (
        <>
          <Image
            source={{ uri: imageUrl }}
            style={[StyleSheet.absoluteFillObject, { backgroundColor: themeColors.skeleton }]}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.bottomGradient}
          >
            {categories.length > 0 && (
              <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>{categories[0].name}</Text>
              </View>
            )}
            <Text style={styles.cardTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.cardMeta}>
              <View style={styles.typeBadge}>
                <Ionicons name="newspaper-outline" size={11} color="#fff" />
                <Text style={styles.badgeText}>Blog</Text>
              </View>
              <Text style={styles.dateText}>{date}</Text>
            </View>
          </LinearGradient>
        </>
      ) : (
        <View style={[styles.fallbackCard, { backgroundColor: themeColors.primaryLight + '20' }]}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.cardMeta}>
            <View style={[styles.typeBadge, { backgroundColor: themeColors.primary }]}>
              <Ionicons name="newspaper-outline" size={11} color="#fff" />
              <Text style={styles.badgeText}>Blog</Text>
            </View>
            <Text style={[styles.dateText, { color: themeColors.textSecondary }]}>{date}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// =============================================================================
// YOUTUBE CARD (inside carousel)
// =============================================================================

interface YouTubeCardInnerProps {
  video: YouTubeVideo;
  themeColors: any;
  isPlaying: boolean;
  onPlay: () => void;
  onStateChange: (state: string) => void;
}

function YouTubeCard({ video, themeColors, isPlaying, onPlay, onStateChange }: YouTubeCardInnerProps) {
  return (
    <View style={styles.cardInner}>
      {!isPlaying ? (
        <>
          <Image
            source={{ uri: video.thumbnail }}
            style={[StyleSheet.absoluteFillObject, { backgroundColor: themeColors.skeleton }]}
            resizeMode="cover"
          />
          {/* Play button overlay */}
          <TouchableOpacity
            style={styles.playOverlay}
            onPress={onPlay}
            activeOpacity={0.8}
          >
            <View style={styles.playButtonInner}>
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
          {/* YouTube badge top-left */}
          <View style={styles.youtubeLabel}>
            <Ionicons name="logo-youtube" size={14} color="#fff" />
            <Text style={styles.youtubeLabelText}>YouTube</Text>
          </View>
          {/* Title overlay at bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.bottomGradient}
          >
            <Text style={styles.cardTitle} numberOfLines={2}>
              {video.title}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={styles.watchText}>Watch now</Text>
            </View>
          </LinearGradient>
        </>
      ) : (
        <View style={styles.inPlacePlayer}>
          <YouTubeEmbed
            videoId={video.videoId}
            playing={isPlaying}
            onStateChange={onStateChange}
          />
        </View>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollContent: {
    paddingLeft: spacing.lg,
    paddingRight: PEEK_WIDTH,
  },

  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
  },

  cardInner: {
    flex: 1,
    position: 'relative',
  },

  // Bottom gradient overlay (shared by blog + YouTube)
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xxxl,
    justifyContent: 'flex-end',
  },

  fallbackCard: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
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

  cardTitle: {
    fontSize: typography.size.md,
    fontWeight: '700',
    lineHeight: typography.size.md * typography.lineHeight.tight,
    color: '#fff',
    marginBottom: spacing.xs,
  },

  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.xs,
    gap: 3,
  },

  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },

  dateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.size.xs,
  },

  watchText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: typography.size.xs,
    fontWeight: '600',
  },

  // YouTube play overlay (FeedCard pattern)
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
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
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.xs,
    gap: 4,
    zIndex: 1,
  },

  youtubeLabelText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: '500',
  },

  // Inline player
  inPlacePlayer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  // Progress indicator (bar + counter)
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },

  indicatorTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },

  indicatorFill: {
    height: '100%',
    borderRadius: 1.5,
  },

  indicatorText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
  },
});

export default MediaCarousel;
