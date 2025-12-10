// =============================================================================
// FEED CARD - A single post/feed item in the list
// =============================================================================
// Displays author, content, media (images/YouTube), reactions, and comments.
// Properly detects media from:
//   - meta.media_items (multiple images array)
//   - meta.media_preview (single image)
//   - message content (YouTube links)
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { colors } from '@/constants/colors';
import { shadows, sizing, spacing, typography } from '@/constants/layout';
import { Feed } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlTags, truncateText } from '@/utils/htmlToText';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// -----------------------------------------------------------------------------
// Media Detection Helper
// -----------------------------------------------------------------------------

interface MediaInfo {
  type: 'image' | 'images' | 'youtube' | 'none';
  imageUrl?: string;
  imageUrls?: string[];  // For multiple images
  youtubeId?: string;
}

function detectMedia(feed: Feed): MediaInfo {
  const message = feed.message || '';
  const messageRendered = feed.message_rendered || '';
  const meta = feed.meta || {};
  
  // 1. Check for multiple images in meta.media_items (array of images)
  if (meta.media_items && Array.isArray(meta.media_items) && meta.media_items.length > 0) {
    const imageUrls = meta.media_items
      .filter((item: any) => item.type === 'image' && item.url)
      .map((item: any) => item.url);
    
    if (imageUrls.length > 1) {
      return {
        type: 'images',
        imageUrls: imageUrls,
        imageUrl: imageUrls[0], // First image as fallback
      };
    } else if (imageUrls.length === 1) {
      return {
        type: 'image',
        imageUrl: imageUrls[0],
      };
    }
  }
  
  // 2. Check for single uploaded image in meta.media_preview
  if (meta.media_preview?.image) {
    return {
      type: 'image',
      imageUrl: meta.media_preview.image,
    };
  }
  
  // 3. Check for featured_image
  if (feed.featured_image) {
    return {
      type: 'image',
      imageUrl: feed.featured_image,
    };
  }
  
  // 4. Check for YouTube in message
  const youtubePatterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of youtubePatterns) {
    const match = message.match(pattern) || messageRendered.match(pattern);
    if (match) {
      return {
        type: 'youtube',
        youtubeId: match[1],
      };
    }
  }
  
  return { type: 'none' };
}

// Remove URLs from display text
function cleanMessageText(text: string): string {
  return text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface FeedCardProps {
  feed: Feed;
  onPress?: () => void;
  onReact?: (type: 'like' | 'love') => void;
  onAuthorPress?: () => void;
  onSpacePress?: () => void;
  showFullContent?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function FeedCard({
  feed,
  onPress,
  onReact,
  onAuthorPress,
  onSpacePress,
  showFullContent = false,
}: FeedCardProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  // Extract author data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  
  const spaceName = feed.space?.title;
  const timestamp = formatRelativeTime(feed.created_at);
  
  // Get content and clean it
  const rawContent = stripHtmlTags(feed.message_rendered || feed.message);
  const content = cleanMessageText(rawContent);
  const displayContent = showFullContent ? content : truncateText(content, 200);
  
  // Detect media
  const media = detectMedia(feed);
  const hasImage = media.type === 'image' && media.imageUrl && !imageError;
  const hasImages = media.type === 'images' && media.imageUrls && media.imageUrls.length > 0;
  const hasYouTube = media.type === 'youtube' && media.youtubeId;
  
  // Stats
  const commentsCount = typeof feed.comments_count === 'string' 
    ? parseInt(feed.comments_count, 10) 
    : feed.comments_count || 0;
  const reactionsCount = typeof feed.reactions_count === 'string'
    ? parseInt(feed.reactions_count, 10)
    : feed.reactions_count || 0;

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* ===== Header: Avatar + Author + Timestamp ===== */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onAuthorPress} style={styles.authorRow}>
          <Avatar 
            source={authorAvatar} 
            size="md" 
            verified={isVerified}
            fallback={authorName}
          />
          
          <View style={styles.authorInfo}>
            <Text style={styles.authorName} numberOfLines={1}>
              {authorName}
            </Text>
            
            <View style={styles.metaRow}>
              <Text style={styles.timestamp}>{timestamp}</Text>
              {spaceName && (
                <>
                  <Text style={styles.dot}>•</Text>
                  <TouchableOpacity onPress={onSpacePress}>
                    <Text style={styles.spaceName} numberOfLines={1}>
                      {spaceName}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
      
      {/* ===== Title ===== */}
      {feed.title && (
        <Text style={styles.title} numberOfLines={3}>
          {feed.title}
        </Text>
      )}
      
      {/* ===== Content ===== */}
      {displayContent.length > 0 && (
        <Text style={styles.content} numberOfLines={6}>
          {displayContent}
        </Text>
      )}
      
      {/* ===== Single Image Media ===== */}
      {hasImage && (
        <View style={styles.mediaContainer}>
          {imageLoading && (
            <View style={styles.mediaPlaceholder}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
          <Image 
            source={{ uri: media.imageUrl }}
            style={[styles.mediaImage, imageLoading && { opacity: 0 }]}
            resizeMode="cover"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
        </View>
      )}
      
      {/* ===== Multiple Images (Gallery) ===== */}
      {hasImages && media.imageUrls && (
        <View style={styles.galleryContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryScroll}
          >
            {media.imageUrls.map((url, index) => (
              <Image
                key={index}
                source={{ uri: url }}
                style={styles.galleryImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          <View style={styles.imageCountBadge}>
            <Text style={styles.imageCountText}>{media.imageUrls.length} photos</Text>
          </View>
        </View>
      )}
      
      {/* ===== YouTube Media ===== */}
      {hasYouTube && (
        <View style={styles.youtubeContainer}>
          <Image 
            source={{ uri: `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg` }}
            style={styles.youtubeThumbnail}
            resizeMode="cover"
          />
          <View style={styles.youtubeOverlay}>
            <View style={styles.youtubePlayButton}>
              <Text style={styles.youtubePlayIcon}>▶</Text>
            </View>
          </View>
          <View style={styles.youtubeLabel}>
            <Text style={styles.youtubeLabelText}>YouTube</Text>
          </View>
        </View>
      )}
      
      {/* ===== Image Error State ===== */}
      {imageError && media.type === 'image' && (
        <View style={styles.mediaError}>
          <Text style={styles.mediaErrorIcon}>🖼️</Text>
          <Text style={styles.mediaErrorText}>Image unavailable</Text>
        </View>
      )}
      
      {/* ===== Footer: Reactions + Comments ===== */}
      <View style={styles.footer}>
        <View style={styles.reactions}>
          <TouchableOpacity 
            style={styles.reactionButton}
            onPress={() => onReact?.('like')}
          >
            <Text style={styles.reactionIcon}>👍</Text>
            {reactionsCount > 0 && (
              <Text style={styles.reactionCount}>
                {formatCompactNumber(reactionsCount)}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.reactionButton}
            onPress={() => onReact?.('love')}
          >
            <Text style={styles.reactionIcon}>❤️</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.stats}>
          <Text style={styles.statIcon}>💬</Text>
          <Text style={styles.statCount}>
            {formatCompactNumber(commentsCount)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.lg,
    borderRadius: sizing.borderRadius.lg,
    ...shadows.sm,
  },
  
  // Header
  header: {
    marginBottom: spacing.md,
  },
  
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  authorInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  
  authorName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold as any,
    color: colors.text,
  },
  
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  
  timestamp: {
    fontSize: typography.size.sm,
    color: colors.textTertiary,
  },
  
  dot: {
    fontSize: typography.size.sm,
    color: colors.textTertiary,
    marginHorizontal: spacing.xs,
  },
  
  spaceName: {
    fontSize: typography.size.sm,
    color: colors.primary,
    maxWidth: 150,
  },
  
  // Title
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold as any,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  
  // Content
  content: {
    fontSize: typography.size.md,
    color: colors.text,
    lineHeight: typography.size.md * 1.5,
  },
  
  // Single Image Media Container
  mediaContainer: {
    marginTop: spacing.md,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.skeleton,
    height: 200,
  },
  
  mediaPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.skeleton,
  },
  
  mediaImage: {
    width: '100%',
    height: 200,
  },
  
  // Gallery (Multiple Images)
  galleryContainer: {
    marginTop: spacing.md,
    position: 'relative',
  },
  
  galleryScroll: {
    paddingRight: spacing.md,
  },
  
  galleryImage: {
    width: 200,
    height: 200,
    borderRadius: sizing.borderRadius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.skeleton,
  },
  
  imageCountBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  
  imageCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Media Error
  mediaError: {
    marginTop: spacing.md,
    height: 200,
    borderRadius: sizing.borderRadius.md,
    backgroundColor: colors.skeleton,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  mediaErrorIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  
  mediaErrorText: {
    fontSize: typography.size.sm,
    color: colors.textTertiary,
  },
  
  // YouTube
  youtubeContainer: {
    marginTop: spacing.md,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  
  youtubeThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: colors.skeleton,
  },
  
  youtubeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  
  youtubePlayButton: {
    width: 60,
    height: 42,
    backgroundColor: 'rgba(255,0,0,0.9)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  youtubePlayIcon: {
    color: '#fff',
    fontSize: 20,
    marginLeft: 3,
  },
  
  youtubeLabel: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  
  youtubeLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
    padding: spacing.xs,
  },
  
  reactionIcon: {
    fontSize: 18,
  },
  
  reactionCount: {
    marginLeft: spacing.xs,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  statIcon: {
    fontSize: 16,
  },
  
  statCount: {
    marginLeft: spacing.xs,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});

export default FeedCard;