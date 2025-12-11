// =============================================================================
// FULL SCREEN POST - Instagram-style full-screen post viewer
// =============================================================================
// - Uses expo-image for better caching
// - ScrollView for horizontal paging (no virtualization needed for few pages)
// - Memoized thumbnails to prevent unnecessary re-renders
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/layout';
import { Feed } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlPreserveBreaks } from '@/utils/htmlToText';
import { Image } from 'expo-image';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const HEADER_HEIGHT = 120;
const FOOTER_HEIGHT = 160;
const ACTIONS_WIDTH = 60;

// -----------------------------------------------------------------------------
// Thumbnail Strip
// -----------------------------------------------------------------------------

interface ThumbnailStripProps {
  imageUrls: string[];
  currentPage: number;
  onPageSelect: (index: number) => void;
}

// Memoized thumbnail image - prevents re-render when parent updates
const ThumbImage = memo(({ url }: { url: string }) => (
  <Image 
    source={{ uri: url }}
    style={styles.thumbImage}
    contentFit="cover"
    cachePolicy="memory-disk"
  />
), () => true);

const ThumbnailStrip = ({ imageUrls, currentPage, onPageSelect }: ThumbnailStripProps) => (
  <View style={styles.thumbnails}>
    <View style={styles.thumbStrip}>
      {/* Text page thumbnail */}
      <TouchableOpacity
        style={[styles.thumbItem, currentPage === 0 && styles.thumbActive]}
        onPress={() => onPageSelect(0)}
      >
        <Text style={styles.thumbText}>Aa</Text>
      </TouchableOpacity>
      
      {/* Image thumbnails */}
      {imageUrls.map((url, i) => (
        <TouchableOpacity
          key={`thumb-${i}`}
          style={[styles.thumbItem, currentPage === i + 1 && styles.thumbActive]}
          onPress={() => onPageSelect(i + 1)}
        >
          <ThumbImage url={url} />
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// -----------------------------------------------------------------------------
// Media Detection
// -----------------------------------------------------------------------------

interface MediaInfo {
  imageUrl?: string;
  imageUrls?: string[];
}

function detectMedia(feed: Feed): MediaInfo {
  const meta = feed.meta || {};
  
  if (meta.media_items?.length > 0) {
    const urls = meta.media_items
      .filter((item: any) => item.type === 'image' && item.url)
      .map((item: any) => item.url);
    if (urls.length > 0) {
      return { imageUrls: urls, imageUrl: urls[0] };
    }
  }
  
  if (meta.media_preview?.image) {
    return { imageUrl: meta.media_preview.image, imageUrls: [meta.media_preview.image] };
  }
  
  if (feed.featured_image) {
    return { imageUrl: feed.featured_image, imageUrls: [feed.featured_image] };
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
  onReact: (type: 'like' | 'love') => void;
  onCommentPress: () => void;
  onAuthorPress: () => void;
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
}: FullScreenPostProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const [liked, setLiked] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  const CONTENT_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;
  const CONTENT_WIDTH = SCREEN_WIDTH - ACTIONS_WIDTH - spacing.lg;

  // Data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  const timestamp = formatRelativeTime(feed.created_at);
  
  const rawContent = stripHtmlPreserveBreaks(feed.message_rendered || feed.message);
  const content = rawContent.replace(/https?:\/\/[^\s]+/gi, '').trim();
  
  // Dynamic font size
  const totalChars = (feed.title?.length || 0) + content.length;
  const fontSize = totalChars < 30 ? 34 : totalChars < 80 ? 28 : totalChars < 150 ? 24 : 
                   totalChars < 300 ? 20 : totalChars < 500 ? 17 : totalChars < 800 ? 15 : 13;
  const titleSize = Math.min(40, fontSize + 6);
  
  // Media
  const media = detectMedia(feed);
  const hasImages = media.imageUrls && media.imageUrls.length > 0;
  const imageCount = media.imageUrls?.length || 0;
  
  // Stats
  const commentsCount = parseInt(String(feed.comments_count || 0), 10);
  const reactionsCount = parseInt(String(feed.reactions_count || 0), 10);

  // Bounce animation for scroll hint
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: 8, duration: 250, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 5, duration: 200, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleLike = useCallback(() => {
    setLiked(prev => !prev);
    onReact('like');
  }, [onReact]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (page !== currentPage) {
      setCurrentPage(page);
    }
  }, [SCREEN_WIDTH, currentPage]);

  const goToPage = useCallback((index: number) => {
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  }, [SCREEN_WIDTH]);

  const isDark = hasImages || currentPage > 0;

  // Render text page
  const renderTextPage = () => (
    <View style={[styles.page, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      {hasImages && media.imageUrl ? (
        <>
          <Image
            source={{ uri: media.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={3}
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
        {feed.title && (
          <Text style={[styles.title, !isDark && styles.textDark, { fontSize: titleSize, lineHeight: titleSize * 1.2 }]}>
            {feed.title}
          </Text>
        )}
        {content.length > 0 && (
          <Text style={[styles.message, !isDark && styles.textDark, { fontSize, lineHeight: fontSize * 1.4 }]}>
            {content}
          </Text>
        )}
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
        {media.imageUrls?.map((url, i) => renderImagePage(url, i))}
      </ScrollView>

      {/* HEADER: Avatar + Author */}
      <TouchableOpacity style={styles.header} onPress={onAuthorPress} activeOpacity={0.8}>
        <Avatar source={authorAvatar} size="lg" verified={isVerified} fallback={authorName} />
        <View style={styles.authorInfo}>
          <Text style={[styles.authorName, !isDark && styles.textDark]}>{authorName}</Text>
          <Text style={[styles.timestamp, !isDark && styles.timestampLight]}>{timestamp}</Text>
        </View>
      </TouchableOpacity>

      {/* HEADER: Close button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      {/* RIGHT: Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Text style={styles.actionIcon}>{liked ? '❤️' : '🤍'}</Text>
          <Text style={[styles.actionCount, !isDark && styles.textDark]}>
            {formatCompactNumber(reactionsCount + (liked ? 1 : 0))}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onCommentPress}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={[styles.actionCount, !isDark && styles.textDark]}>
            {formatCompactNumber(commentsCount)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>📤</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>🔖</Text>
        </TouchableOpacity>
      </View>

      {/* FOOTER: Thumbnails */}
      {hasImages && media.imageUrls && (
        <ThumbnailStrip 
          imageUrls={media.imageUrls}
          currentPage={currentPage}
          onPageSelect={goToPage}
        />
      )}

      {/* FOOTER: Scroll indicator */}
      <Animated.View style={[styles.scrollHint, { transform: [{ translateY: bounceAnim }] }]}>
        <Text style={[styles.scrollArrow, !isDark && styles.scrollArrowLight]}>⌄</Text>
      </Animated.View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  
  contentArea: {
    position: 'absolute',
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
  
  title: {
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  
  message: {
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  
  textDark: {
    color: colors.text,
    textShadowColor: 'transparent',
  },
  
  fullImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  
  imageCounter: {
    position: 'absolute',
    top: HEADER_HEIGHT,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  
  imageCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  header: {
    position: 'absolute',
    top: 55,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  
  authorInfo: {
    marginLeft: spacing.md,
  },
  
  authorName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  timestamp: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  timestampLight: {
    color: colors.textSecondary,
    textShadowColor: 'transparent',
  },
  
  closeButton: {
    position: 'absolute',
    top: 55,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  
  closeIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  
  actions: {
    position: 'absolute',
    right: spacing.sm,
    top: '32%',
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
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  thumbnails: {
    position: 'absolute',
    bottom: 90,
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
  
  // IMPORTANT: Always have border (transparent when inactive) to prevent layout shift
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
  
  thumbText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  
  scrollHint: {
    position: 'absolute',
    bottom: 35,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  
  scrollArrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 30,
  },
  
  scrollArrowLight: {
    color: 'rgba(0,0,0,0.25)',
  },
});

export default FullScreenPost;