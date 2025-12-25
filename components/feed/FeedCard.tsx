// =============================================================================
// FEED CARD - A single post/feed item in the list
// =============================================================================
// UPDATED: Added PIN TO TOP option in menu for admins
// - Bookmark icon
// - 3-dot menu: Copy Link, Pin (admin), Edit (owner), Delete (owner)
// - Sticky badge for pinned posts
// =============================================================================

import React, { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '@/components/common/Avatar';
import { colors } from '@/constants/colors';
import { shadows, sizing, spacing, typography } from '@/constants/layout';
import { Feed } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlTags, truncateText } from '@/utils/htmlToText';
import { useAuth } from '@/contexts/AuthContext';
import { SITE_URL } from '@/constants/config';

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
      return { type: 'images', imageUrls, imageUrl: imageUrls[0] };
    } else if (imageUrls.length === 1) {
      return { type: 'image', imageUrl: imageUrls[0] };
    }
  }
  
  // 2. Check for single image in meta.media_preview
  if (meta.media_preview?.image) {
    return { type: 'image', imageUrl: meta.media_preview.image };
  }
  
  // 3. Check for featured_image
  if (feed.featured_image) {
    return { type: 'image', imageUrl: feed.featured_image };
  }
  
  // 4. Check for YouTube links in message
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = message.match(youtubeRegex) || messageRendered.match(youtubeRegex);
  if (youtubeMatch) {
    return { type: 'youtube', youtubeId: youtubeMatch[1] };
  }
  
  return { type: 'none' };
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface FeedCardProps {
  feed: Feed;
  onPress?: () => void;
  onReact?: (type: 'like') => void;
  onAuthorPress?: () => void;
  onSpacePress?: () => void;
  onCommentPress?: () => void;
  onBookmarkToggle?: (isBookmarked: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;  // NEW: Pin callback (only passed if user can pin)
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
  onBookmarkToggle,
  onEdit,
  onDelete,
  onPin,
}: FeedCardProps) {
  const { user } = useAuth();
  const [imageLoading, setImageLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(feed.bookmarked || false);
  
  // Extract data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  const isOwner = user?.id === Number(feed.user_id);
  const isSticky = feed.is_sticky === true || feed.is_sticky === 1;
  const canPin = !!onPin; // If onPin is passed, user can pin
  
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

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBookmarkPress = () => {
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    onBookmarkToggle?.(newState);
  };

  const handleCopyLink = async () => {
    const url = `${SITE_URL}/portal/post/${feed.slug}`;
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied!', 'Link copied to clipboard');
    } catch (err) {
      Alert.alert('Link', url);
    }
  };

  const handleMenuPress = () => {
    // Debug: Log what options will be shown
    console.log('[FEEDCARD MENU DEBUG]', {
      isOwner,
      canPin,
      onPinProvided: !!onPin,
      isSticky,
      feedId: feed.id,
      userId: user?.id,
      feedUserId: feed.user_id,
    });

    if (Platform.OS === 'ios') {
      // Build options array
      const options: string[] = ['Cancel', 'Copy Link'];
      
      // Pin option (for admins/mods)
      if (canPin) {
        options.push(isSticky ? 'Unpin from Top' : 'Pin to Top');
      }
      
      // Owner options
      if (isOwner) {
        options.push('Edit', 'Delete');
      }
      
      const cancelIndex = 0;
      const destructiveIndex = isOwner ? options.indexOf('Delete') : undefined;
      
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
        },
        (buttonIndex) => {
          const selectedOption = options[buttonIndex];
          
          if (selectedOption === 'Copy Link') handleCopyLink();
          else if (selectedOption === 'Pin to Top' || selectedOption === 'Unpin from Top') onPin?.();
          else if (selectedOption === 'Edit') onEdit?.();
          else if (selectedOption === 'Delete') handleDelete();
        }
      );
    } else {
      // Android - Build buttons array
      const buttons: any[] = [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy Link', onPress: handleCopyLink },
      ];
      
      // Pin option (for admins/mods)
      if (canPin) {
        buttons.push({ 
          text: isSticky ? 'Unpin from Top' : 'Pin to Top', 
          onPress: onPin 
        });
      }
      
      // Owner options
      if (isOwner) {
        buttons.push({ text: 'Edit', onPress: onEdit });
        buttons.push({ text: 'Delete', onPress: handleDelete, style: 'destructive' });
      }
      
      Alert.alert(
        'Post Options',
        'Choose an action',
        buttons,
        { cancelable: true }
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* ===== Sticky Indicator ===== */}
      {isSticky && (
        <View style={styles.stickyBadge}>
          <Ionicons name="pin" size={12} color={colors.primary} />
          <Text style={styles.stickyText}>Pinned</Text>
        </View>
      )}

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

        {/* Header Actions: Bookmark + Menu */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleBookmarkPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isBookmarked ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleMenuPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
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
        {/* Single Like Button */}
        <TouchableOpacity 
          style={[
            styles.reactionButton,
            hasUserReact && styles.reactionButtonActive
          ]}
          onPress={() => onReact?.('like')}
        >
          <Text style={styles.reactionIcon}>{hasUserReact ? '👍' : '👍'}</Text>
          <Text style={[styles.reactionCount, hasUserReact && styles.reactionCountActive]}>
            {reactionsCount > 0 ? formatCompactNumber(reactionsCount) : 'Like'}
          </Text>
        </TouchableOpacity>
        
        {/* Comment button */}
        <TouchableOpacity 
          style={styles.commentButton}
          onPress={(e) => {
            e.stopPropagation();
            onCommentPress?.();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.statIcon}>💬</Text>
          <Text style={styles.statCount}>
            {commentsCount > 0 ? formatCompactNumber(commentsCount) : 'Comment'}
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

  // Sticky badge
  stickyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: sizing.borderRadius.sm,
    alignSelf: 'flex-start',
  },

  stickyText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
    color: colors.primary,
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
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  
  // Content
  content: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  
  // Media
  mediaContainer: {
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.md,
    height: 200,
    backgroundColor: colors.background,
  },
  
  mediaPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
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
  },
  
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.lg,
  },
  
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: sizing.borderRadius.md,
  },
  
  reactionButtonActive: {
    backgroundColor: colors.primaryLight + '20',
  },
  
  reactionIcon: {
    fontSize: 18,
    marginRight: spacing.xs,
  },
  
  reactionCount: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  
  reactionCountActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
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
