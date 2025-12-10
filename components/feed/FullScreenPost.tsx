// =============================================================================
// FULL SCREEN POST - Instagram-style full-screen post viewer
// =============================================================================
// Shows post in full-screen with:
// - Title + Message as main content (centered)
// - Image as dimmed background (decorative) for image posts
// - Clean white background for text-only posts
// - Swipe LEFT/RIGHT to view full images (if post has images)
// - Swipe UP/DOWN to navigate between posts
// - Page indicators (dots) for multi-image posts
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Feed } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlTags } from '@/utils/htmlToText';
import React, { useCallback, useRef, useState } from 'react';
import {
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
// Media Detection - handles both single and multiple images
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
  
  // 1. Check for multiple images in meta.media_items
  if (meta.media_items && Array.isArray(meta.media_items) && meta.media_items.length > 0) {
    const imageUrls = meta.media_items
      .filter((item: any) => item.type === 'image' && item.url)
      .map((item: any) => item.url);
    
    if (imageUrls.length > 1) {
      return {
        type: 'images',
        imageUrls: imageUrls,
        imageUrl: imageUrls[0],
      };
    } else if (imageUrls.length === 1) {
      return {
        type: 'image',
        imageUrl: imageUrls[0],
        imageUrls: imageUrls,
      };
    }
  }
  
  // 2. Check for single image in meta.media_preview
  if (meta.media_preview?.image) {
    return { 
      type: 'image', 
      imageUrl: meta.media_preview.image,
      imageUrls: [meta.media_preview.image],
    };
  }
  
  // 3. Check for featured_image
  if (feed.featured_image) {
    return { 
      type: 'image', 
      imageUrl: feed.featured_image,
      imageUrls: [feed.featured_image],
    };
  }
  
  // 4. Check for YouTube
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

function cleanText(text: string): string {
  return text.replace(/https?:\/\/[^\s]+/gi, '').replace(/\s+/g, ' ').trim();
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

  // Extract data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  
  const rawContent = stripHtmlTags(feed.message_rendered || feed.message);
  const content = cleanText(rawContent);
  const timestamp = formatRelativeTime(feed.created_at);
  
  // Media detection
  const media = detectMedia(feed);
  const hasImages = (media.type === 'image' || media.type === 'images') && media.imageUrls && media.imageUrls.length > 0;
  const imageCount = media.imageUrls?.length || 0;
  const totalPages = hasImages ? 1 + imageCount : 1; // Text page + image pages
  
  const commentsCount = typeof feed.comments_count === 'string'
    ? parseInt(feed.comments_count, 10)
    : feed.comments_count || 0;
  const reactionsCount = typeof feed.reactions_count === 'string'
    ? parseInt(feed.reactions_count, 10)
    : feed.reactions_count || 0;

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

  // Render text content page (page 0)
  const renderTextPage = () => (
    <View style={[styles.page, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}>
      {/* Background image (dimmed, decorative) */}
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
          <Text style={[
            styles.title,
            !hasImages && styles.titleDark
          ]}>
            {feed.title}
          </Text>
        )}
        {content.length > 0 && (
          <Text style={[
            styles.message,
            !hasImages && styles.messageDark
          ]}>
            {content}
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

      {/* Close button - always visible */}
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={onClose}
        activeOpacity={0.7}
      >
        <Text style={styles.closeIcon}>✕</Text>
      </TouchableOpacity>

      {/* Right Side Actions - always visible */}
      <View style={styles.actionsColumn}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Text style={styles.actionIcon}>
            {liked ? '❤️' : '🤍'}
          </Text>
          <Text style={styles.actionCount}>
            {formatCompactNumber(reactionsCount + (liked ? 1 : 0))}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onCommentPress}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>
            {formatCompactNumber(commentsCount)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionCount}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>🔖</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom area - Author info */}
      <View style={styles.bottomArea}>
        <TouchableOpacity style={styles.authorRow} onPress={onAuthorPress}>
          <Avatar
            source={authorAvatar}
            size="md"
            verified={isVerified}
            fallback={authorName}
          />
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, !hasImages && currentPage === 0 && styles.authorNameDark]}>
              {authorName}
            </Text>
            <Text style={[styles.timestamp, !hasImages && currentPage === 0 && styles.timestampDark]}>
              {timestamp}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Page indicators (dots) - only show if multiple pages */}
        {totalPages > 1 && (
          <View style={styles.pageIndicators}>
            {pages.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === currentPage && styles.dotActive,
                  !hasImages && currentPage === 0 && styles.dotDark,
                ]}
              />
            ))}
          </View>
        )}

        {/* Swipe hints */}
        <View style={styles.swipeHints}>
          {hasImages && (
            <Text style={[styles.swipeHintText, !hasImages && currentPage === 0 && styles.swipeHintDark]}>
              ← → {currentPage === 0 ? 'Swipe for images' : 'Swipe for more'}
            </Text>
          )}
          <Text style={[styles.swipeHintText, !hasImages && currentPage === 0 && styles.swipeHintDark]}>
            ↕ Swipe for more posts
          </Text>
        </View>
      </View>
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

  // Main content (title + message)
  mainContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    maxWidth: '90%',
    alignItems: 'center',
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

  // Close button
  closeButton: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  closeIcon: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Right side actions
  actionsColumn: {
    position: 'absolute',
    right: spacing.md,
    top: '40%',
    alignItems: 'center',
    zIndex: 10,
  },

  actionButton: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.xs,
  },

  actionIcon: {
    fontSize: 28,
  },

  actionCount: {
    color: colors.textInverse,
    fontSize: typography.size.sm,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Bottom area
  bottomArea: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 70,
    paddingHorizontal: spacing.lg,
    zIndex: 10,
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
    color: colors.textInverse,
    fontSize: typography.size.md,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  authorNameDark: {
    color: colors.text,
    textShadowColor: 'transparent',
  },

  timestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: typography.size.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  timestampDark: {
    color: colors.textSecondary,
    textShadowColor: 'transparent',
  },

  // Page indicators (dots)
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },

  dotActive: {
    backgroundColor: colors.textInverse,
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  dotDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },

  // Swipe hints
  swipeHints: {
    alignItems: 'center',
  },

  swipeHintText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: typography.size.sm,
    marginBottom: 2,
  },

  swipeHintDark: {
    color: colors.textTertiary,
  },
});

export default FullScreenPost;