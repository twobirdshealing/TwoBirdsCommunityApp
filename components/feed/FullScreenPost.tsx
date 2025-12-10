// =============================================================================
// FULL SCREEN POST - Instagram-style full-screen post viewer
// =============================================================================
// UI Layout:
// - TOP LEFT: Avatar + Author name (prominent)
// - TOP RIGHT: Close button (X)
// - CENTER: Title + Message content
// - RIGHT SIDE: Action buttons (like, comment, share, bookmark)
// - BOTTOM: Thumbnail strip for images (if multiple), subtle scroll indicator
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Feed } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlPreserveBreaks, truncateText } from '@/utils/htmlToText';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native';

// -----------------------------------------------------------------------------
// Media Detection
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
  
  // Check for multiple images in meta.media_items
  if (meta.media_items && Array.isArray(meta.media_items) && meta.media_items.length > 0) {
    const imageUrls = meta.media_items
      .filter((item: any) => item.type === 'image' && item.url)
      .map((item: any) => item.url);
    
    if (imageUrls.length > 1) {
      return { type: 'images', imageUrls, imageUrl: imageUrls[0] };
    } else if (imageUrls.length === 1) {
      return { type: 'image', imageUrl: imageUrls[0], imageUrls };
    }
  }
  
  // Check for single image in meta.media_preview
  if (meta.media_preview?.image) {
    return { 
      type: 'image', 
      imageUrl: meta.media_preview.image,
      imageUrls: [meta.media_preview.image],
    };
  }
  
  // Check for featured_image
  if (feed.featured_image) {
    return { 
      type: 'image', 
      imageUrl: feed.featured_image,
      imageUrls: [feed.featured_image],
    };
  }
  
  // Check for YouTube
  const youtubePatterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of youtubePatterns) {
    const match = message.match(pattern) || messageRendered.match(pattern);
    if (match) {
      return { type: 'youtube', youtubeId: match[1] };
    }
  }
  
  return { type: 'none' };
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
  const flatListRef = useRef<FlatList>(null);
  const bounceAnim = useRef(new Animated.Value(0)).current;

  // Extract data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  
  // Preserve line breaks in content
  const rawContent = stripHtmlPreserveBreaks(feed.message_rendered || feed.message);
  // Remove URLs but keep line breaks
  const content = rawContent.replace(/https?:\/\/[^\s]+/gi, '').trim();
  // Truncate only if VERY long (800+ chars) - Instagram style
  const displayContent = content.length > 800 ? truncateText(content, 800) : content;
  const timestamp = formatRelativeTime(feed.created_at);
  
  // Dynamic font size - fill the space better
  const getMessageFontSize = () => {
    const len = displayContent.length;
    if (len < 50) return 32;      // Very short - big and bold
    if (len < 100) return 26;     // Short - nice and readable
    if (len < 200) return 22;     // Medium
    if (len < 400) return 18;     // Longer
    if (len < 600) return 16;     // Long
    return 14;                     // Very long - compact
  };
  const messageFontSize = getMessageFontSize();
  
  // Title size scales with message
  const titleFontSize = Math.min(36, messageFontSize + 8);
  
  // Media detection
  const media = detectMedia(feed);
  const hasImages = (media.type === 'image' || media.type === 'images') && media.imageUrls && media.imageUrls.length > 0;
  const imageCount = media.imageUrls?.length || 0;
  const totalPages = hasImages ? 1 + imageCount : 1;
  
  const commentsCount = typeof feed.comments_count === 'string'
    ? parseInt(feed.comments_count, 10)
    : feed.comments_count || 0;
  const reactionsCount = typeof feed.reactions_count === 'string'
    ? parseInt(feed.reactions_count, 10)
    : feed.reactions_count || 0;

  // Bounce animation for scroll hint
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(bounceAnim, { toValue: 10, duration: 300, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 6, duration: 200, useNativeDriver: true }),
          Animated.timing(bounceAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isActive, bounceAnim]);

  // Handle like
  const handleLike = useCallback(() => {
    setLiked(prev => !prev);
    onReact('like');
  }, [onReact]);

  // Handle horizontal scroll
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPage(page);
  }, [SCREEN_WIDTH]);

  // Jump to page from thumbnail
  const jumpToPage = (index: number) => {
    flatListRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  // Render text content page (page 0)
  const renderTextPage = () => (
    <View style={[styles.page, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      {/* Background image (dimmed) */}
      {hasImages && media.imageUrl && (
        <>
          <Image
            source={{ uri: media.imageUrl }}
            style={styles.backgroundImage}
            resizeMode="cover"
            blurRadius={2}
          />
          <View style={styles.backgroundOverlay} />
        </>
      )}
      
      {/* White background for text-only posts */}
      {!hasImages && <View style={styles.whiteBackground} />}
      
      {/* Main Content - Title + Message */}
      <View style={styles.mainContent}>
        {feed.title && (
          <Text 
            style={[
              styles.title, 
              !hasImages && styles.titleDark,
              { fontSize: titleFontSize }
            ]} 
            numberOfLines={2}
          >
            {feed.title}
          </Text>
        )}
        {displayContent.length > 0 && (
          <Text 
            style={[
              styles.message, 
              !hasImages && styles.messageDark,
              { fontSize: messageFontSize, lineHeight: messageFontSize * 1.4 }
            ]}
          >
            {displayContent}
          </Text>
        )}
      </View>
    </View>
  );

  // Render image page
  const renderImagePage = (imageUrl: string, index: number) => (
    <View style={[styles.page, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]} key={index}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.fullImage}
        resizeMode="contain"
      />
      {/* Image counter */}
      <View style={styles.imageCounter}>
        <Text style={styles.imageCounterText}>
          {index + 1} / {imageCount}
        </Text>
      </View>
    </View>
  );

  // Build pages array
  const pages = [
    { type: 'text', key: 'text' },
    ...(media.imageUrls || []).map((url, idx) => ({ type: 'image', url, key: `img-${idx}` })),
  ];

  const isDarkMode = hasImages || currentPage > 0;

  return (
    <View style={[styles.container, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      {/* Horizontal swipeable pages */}
      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => {
          if (item.type === 'text') {
            return renderTextPage();
          } else {
            return renderImagePage(item.url!, index - 1);
          }
        }}
      />

      {/* TOP LEFT: Avatar + Author */}
      <TouchableOpacity style={styles.authorContainer} onPress={onAuthorPress}>
        <Avatar
          source={authorAvatar}
          size="lg"
          verified={isVerified}
          fallback={authorName}
        />
        <View style={styles.authorInfo}>
          <Text style={[styles.authorName, !isDarkMode && styles.authorNameDark]}>
            {authorName}
          </Text>
          <Text style={[styles.timestamp, !isDarkMode && styles.timestampDark]}>
            {timestamp}
          </Text>
        </View>
      </TouchableOpacity>

      {/* TOP RIGHT: Close button */}
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={onClose}
        activeOpacity={0.7}
      >
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      {/* RIGHT SIDE: Action buttons */}
      <View style={styles.actionsColumn}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Text style={styles.actionIcon}>
            {liked ? '❤️' : '🤍'}
          </Text>
          <Text style={[styles.actionCount, !isDarkMode && styles.actionCountDark]}>
            {formatCompactNumber(reactionsCount + (liked ? 1 : 0))}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onCommentPress}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={[styles.actionCount, !isDarkMode && styles.actionCountDark]}>
            {formatCompactNumber(commentsCount)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📤</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>🔖</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM: Thumbnail strip (if multiple images) */}
      {hasImages && imageCount > 0 && (
        <View style={styles.thumbnailContainer}>
          <View style={styles.thumbnailStrip}>
            {/* Text page indicator */}
            <TouchableOpacity
              style={[
                styles.thumbnailItem,
                currentPage === 0 && styles.thumbnailActive,
              ]}
              onPress={() => flatListRef.current?.scrollToIndex({ index: 0, animated: true })}
            >
              <Text style={styles.thumbnailText}>Aa</Text>
            </TouchableOpacity>
            
            {/* Image thumbnails */}
            {media.imageUrls?.map((url, idx) => (
              <TouchableOpacity
                key={`thumb-${idx}-${url}`}
                style={[
                  styles.thumbnailItem,
                  currentPage === idx + 1 && styles.thumbnailActive,
                ]}
                onPress={() => jumpToPage(idx)}
              >
                <Image
                  source={{ uri: url, cache: 'force-cache' }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                  defaultSource={{ uri: url }}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* BOTTOM: Scroll indicator (animated bounce) */}
      <Animated.View 
        style={[
          styles.scrollIndicator,
          { transform: [{ translateY: bounceAnim }] }
        ]}
      >
        <Text style={[styles.scrollArrow, !isDarkMode && styles.scrollArrowDark]}>⌄</Text>
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

  // Backgrounds
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },

  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },

  whiteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },

  // Main content
  mainContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: 140,
    paddingBottom: 180,
    maxWidth: '85%',
    alignItems: 'center',
    maxHeight: '80%',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textInverse,
    textAlign: 'center',
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  titleDark: {
    color: colors.text,
    textShadowColor: 'transparent',
  },

  message: {
    fontSize: 18,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  messageDark: {
    color: colors.text,
    textShadowColor: 'transparent',
  },

  // Full image view
  fullImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },

  imageCounter: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },

  imageCounterText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '600',
  },

  // TOP LEFT: Author
  authorContainer: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },

  authorInfo: {
    marginLeft: spacing.md,
  },

  authorName: {
    color: colors.textInverse,
    fontSize: typography.size.lg,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  authorNameDark: {
    color: colors.text,
    textShadowColor: 'transparent',
  },

  timestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: typography.size.sm,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  timestampDark: {
    color: colors.textSecondary,
    textShadowColor: 'transparent',
  },

  // TOP RIGHT: Close button
  closeButton: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  closeIcon: {
    color: colors.textInverse,
    fontSize: 20,
    fontWeight: 'bold',
  },

  // RIGHT SIDE: Actions
  actionsColumn: {
    position: 'absolute',
    right: spacing.md,
    top: '35%',
    alignItems: 'center',
    zIndex: 10,
  },

  actionButton: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    padding: spacing.xs,
  },

  actionIcon: {
    fontSize: 30,
  },

  actionCount: {
    color: colors.textInverse,
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  actionCountDark: {
    color: colors.text,
    textShadowColor: 'transparent',
  },

  // BOTTOM: Thumbnail strip
  thumbnailContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },

  thumbnailStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 6,
  },

  thumbnailItem: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginHorizontal: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  thumbnailActive: {
    borderWidth: 2,
    borderColor: colors.textInverse,
  },

  thumbnailImage: {
    width: '100%',
    height: '100%',
  },

  thumbnailText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },

  // BOTTOM: Scroll indicator
  scrollIndicator: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },

  scrollArrow: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 32,
    fontWeight: '300',
  },

  scrollArrowDark: {
    color: 'rgba(0, 0, 0, 0.3)',
  },
});

export default FullScreenPost;