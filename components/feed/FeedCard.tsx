// =============================================================================
// FEED CARD - A single post/feed item in the list
// =============================================================================
// Displays author, content, media (images/YouTube), reactions, and comments.
// Now includes onCommentPress for opening comment sheet directly!
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
      };
    }
  }
  
  // 2. Check for single image in meta.media_preview
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
  
  // 4. Check for YouTube links in message
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = message.match(youtubeRegex) || messageRendered.match(youtubeRegex);
  if (youtubeMatch) {
    return {
      type: 'youtube',
      youtubeId: youtubeMatch[1],
    };
  }
  
  return { type: 'none' };
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
  onCommentPress?: () => void; // NEW: Open comment sheet directly
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
  onCommentPress,
}: FeedCardProps) {
  const [imageLoading, setImageLoading] = useState(true);
  
  // Extract data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  
  const spaceName = feed.space?.title || null;
  const timestamp = formatRelativeTime(feed.created_at);
  
  // Content processing
  const rawContent = stripHtmlTags(feed.message_rendered || feed.message || '');
  const displayContent = truncateText(rawContent, 300);
  
  // Media detection
  const media = detectMedia(feed);
  const hasImage = media.type === 'image' || media.type === 'images';
  const hasYouTube = media.type === 'youtube';
  
  // Stats
  const reactionsCount = typeof feed.reactions_count === 'string'
    ? parseInt(feed.reactions_count, 10)
    : feed.reactions_count || 0;
  const commentsCount = typeof feed.comments_count === 'string'
    ? parseInt(feed.comments_count, 10)
    : feed.comments_count || 0;
  const hasUserReact = feed.has_user_react || false;
  
  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* ===== Header ===== */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.authorRow}
          onPress={onAuthorPress}
          activeOpacity={0.7}
        >
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
      
      {/* ===== Single Image ===== */}
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
          />
          {/* Multiple images indicator */}
          {media.type === 'images' && media.imageUrls && media.imageUrls.length > 1 && (
            <View style={styles.imageCount}>
              <Text style={styles.imageCountText}>
                +{media.imageUrls.length - 1}
              </Text>
            </View>
          )}
        </View>
      )}
      
      {/* ===== YouTube Thumbnail ===== */}
      {hasYouTube && media.youtubeId && (
        <View style={styles.mediaContainer}>
          <Image 
            source={{ uri: `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg` }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶️</Text>
          </View>
        </View>
      )}
      
      {/* ===== Footer ===== */}
      <View style={styles.footer}>
        <View style={styles.reactions}>
          <TouchableOpacity 
            style={[
              styles.reactionButton,
              hasUserReact && styles.reactionButtonActive
            ]}
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
        
        {/* Comment button - NOW CLICKABLE! */}
        <TouchableOpacity 
          style={styles.commentButton}
          onPress={(e) => {
            e.stopPropagation(); // Prevent card press
            onCommentPress?.();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.statIcon}>💬</Text>
          <Text style={styles.statCount}>
            {formatCompactNumber(commentsCount)}
          </Text>
        </TouchableOpacity>
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  
  // Content
  content: {
    fontSize: typography.size.md,
    color: colors.text,
    lineHeight: typography.size.md * 1.5,
  },
  
  // Media
  mediaContainer: {
    marginTop: spacing.md,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.skeleton,
    position: 'relative',
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
  
  imageCount: {
    position: 'absolute',
    bottom: spacing.sm,
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
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  playIcon: {
    fontSize: 24,
    marginLeft: 4,
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: sizing.borderRadius.full,
  },
  
  reactionButtonActive: {
    backgroundColor: colors.primaryLight + '30',
  },
  
  reactionIcon: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  
  reactionCount: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  
  // Comment button
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: sizing.borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
  },
  
  statIcon: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  
  statCount: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});

export default FeedCard;
