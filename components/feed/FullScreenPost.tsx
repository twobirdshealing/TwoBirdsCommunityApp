// =============================================================================
// FULL SCREEN POST - TikTok-style swipeable post viewer  
// =============================================================================
// FIXES:
// 1. Wrapped ALL emoji in <Text> tags (was causing crash)
// 2. Added bottomInset for safe area padding
// 3. Removed X close button
// =============================================================================

import React, { useRef, useState } from 'react';
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
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/layout';
import { Feed } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtml } from '@/utils/profileUtils';
import { Avatar } from '../common';

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
  const [liked, setLiked] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const bounceAnim = useRef(new Animated.Value(0)).current;

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
  
  // Dark text on light background
  const isDark = !hasImages;
  
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

      {/* RIGHT: Actions */}
      <View style={[styles.actions, { bottom: FOOTER_HEIGHT + bottomInset }]}>
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
      </View>

      {/* Thumbnails for multiple images */}
      {imageCount > 1 && (
        <View style={[styles.thumbnails, { bottom: FOOTER_HEIGHT + bottomInset + 10 }]}>
          <View style={styles.thumbStrip}>
            <TouchableOpacity
              style={[styles.thumbItem, currentPage === 0 && styles.thumbActive]}
              onPress={() => scrollRef.current?.scrollTo({ x: 0, animated: true })}
            >
              <Text style={styles.thumbText}>Aa</Text>
            </TouchableOpacity>
            {media.imageUrls?.map((url, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.thumbItem, currentPage === i + 1 && styles.thumbActive]}
                onPress={() => scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * (i + 1), animated: true })}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  
  contentArea: {
    position: 'absolute',
    justifyContent: 'center',
    paddingRight: spacing.md,
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
  
  textDark: {
    color: colors.text,
    textShadowColor: 'transparent',
  },
  
  fullImage: {
    width: '100%',
    height: '100%',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  timestamp: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  timestampLight: {
    color: colors.textSecondary,
    textShadowColor: 'transparent',
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
  
  thumbText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default FullScreenPost;
