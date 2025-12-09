// =============================================================================
// FULL SCREEN POST - Instagram-style full-screen post viewer
// =============================================================================
// Shows post in full-screen with:
// - Image as background (for image posts)
// - YouTube player (for video posts) 
// - Gradient background (for text-only posts)
// - Overlay UI for reactions, comments, author info
// =============================================================================

import React, { useState, useCallback } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import YoutubePlayer from 'react-native-youtube-iframe';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Feed } from '@/types';
import { Avatar } from '@/components/common/Avatar';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlTags } from '@/utils/htmlToText';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// -----------------------------------------------------------------------------
// Media Detection (same as FeedCard)
// -----------------------------------------------------------------------------

interface MediaInfo {
  type: 'image' | 'youtube' | 'none';
  imageUrl?: string;
  youtubeId?: string;
}

function detectMedia(feed: Feed): MediaInfo {
  const message = feed.message || '';
  const messageRendered = feed.message_rendered || '';
  const meta = feed.meta || {};
  
  // 1. Check meta.media_preview.image
  if (meta.media_preview?.image) {
    return { type: 'image', imageUrl: meta.media_preview.image };
  }
  
  // 2. Check featured_image
  if (feed.featured_image) {
    return { type: 'image', imageUrl: feed.featured_image };
  }
  
  // 3. Check for YouTube
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
  const [liked, setLiked] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

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
  const hasImage = media.type === 'image' && media.imageUrl && !imageError;
  const hasYouTube = media.type === 'youtube' && media.youtubeId;
  const hasMedia = hasImage || hasYouTube;
  
  const commentsCount = typeof feed.comments_count === 'string'
    ? parseInt(feed.comments_count, 10)
    : feed.comments_count || 0;
  const reactionsCount = typeof feed.reactions_count === 'string'
    ? parseInt(feed.reactions_count, 10)
    : feed.reactions_count || 0;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  
  let lastTap: number | null = null;
  
  const handleDoubleTap = () => {
    const now = Date.now();
    if (lastTap && now - lastTap < 300) {
      handleLike();
    }
    lastTap = now;
  };

  const handleLike = () => {
    if (!liked) {
      setLiked(true);
      setShowHeart(true);
      onReact('like');
      setTimeout(() => setShowHeart(false), 1000);
    }
  };

  const onYouTubeStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setPlaying(false);
    }
  }, []);

  const openYouTubeExternal = () => {
    if (media.youtubeId) {
      Linking.openURL(`https://www.youtube.com/watch?v=${media.youtubeId}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Background Content */}
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View style={styles.contentArea}>
          
          {/* Image Background */}
          {hasImage && (
            <>
              {imageLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
              <Image
                source={{ uri: media.imageUrl }}
                style={styles.backgroundImage}
                resizeMode="cover"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            </>
          )}
          
          {/* YouTube Player */}
          {hasYouTube && (
            <View style={styles.youtubeWrapper}>
              <YoutubePlayer
                height={SCREEN_WIDTH * 0.5625} // 16:9 aspect ratio
                width={SCREEN_WIDTH}
                play={playing && isActive}
                videoId={media.youtubeId}
                onChangeState={onYouTubeStateChange}
              />
              
              {/* Play overlay when not playing */}
              {!playing && (
                <TouchableOpacity 
                  style={styles.youtubePlayOverlay}
                  onPress={() => setPlaying(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.bigPlayButton}>
                    <Text style={styles.bigPlayIcon}>▶</Text>
                  </View>
                  <Text style={styles.tapToPlay}>Tap to play</Text>
                </TouchableOpacity>
              )}
              
              {/* External link button */}
              <TouchableOpacity 
                style={styles.externalLinkButton}
                onPress={openYouTubeExternal}
              >
                <Text style={styles.externalLinkText}>Open in YouTube ↗</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Gradient Background (text-only posts) */}
          {!hasMedia && (
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.backgroundGradient}
            />
          )}

          {/* Text Content Overlay */}
          {(!hasYouTube && content.length > 0) && (
            <View style={[styles.textContainer, hasImage && styles.textOverlay]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {feed.title && (
                  <Text style={styles.postTitle}>{feed.title}</Text>
                )}
                {!hasImage && content.length > 0 && (
                  <Text style={styles.postText}>{content}</Text>
                )}
              </ScrollView>
            </View>
          )}

          {/* Double-tap heart animation */}
          {showHeart && (
            <View style={styles.heartAnimation}>
              <Text style={styles.heartEmoji}>❤️</Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Info Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
      >
        <TouchableOpacity style={styles.authorRow} onPress={onAuthorPress}>
          <Avatar
            source={authorAvatar}
            size="md"
            verified={isVerified}
            fallback={authorName}
          />
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>
        </TouchableOpacity>

        {hasImage && content.length > 0 && (
          <Text style={styles.caption} numberOfLines={3}>
            {feed.title ? `${feed.title}\n` : ''}{content}
          </Text>
        )}
      </LinearGradient>

      {/* Right Side Actions */}
      <View style={styles.actionsColumn}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Text style={[styles.actionIcon, liked && styles.actionIconActive]}>
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

      {/* Swipe hint */}
      <View style={styles.swipeHint}>
        <Text style={styles.swipeHintText}>↕ Swipe for more</Text>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },

  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // YouTube
  youtubeWrapper: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },

  youtubePlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  bigPlayButton: {
    width: 80,
    height: 56,
    backgroundColor: 'rgba(255,0,0,0.9)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bigPlayIcon: {
    color: '#fff',
    fontSize: 28,
    marginLeft: 4,
  },

  tapToPlay: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },

  externalLinkButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },

  externalLinkText: {
    color: '#fff',
    fontSize: 12,
  },

  // Text content
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 100,
    paddingBottom: 200,
  },
  
  textOverlay: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  postTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textInverse,
    textAlign: 'center',
    marginBottom: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },

  postText: {
    fontSize: 20,
    color: colors.textInverse,
    textAlign: 'center',
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },

  // Heart animation
  heartAnimation: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },

  heartEmoji: {
    fontSize: 100,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
  },

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  closeIcon: {
    color: colors.textInverse,
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Bottom overlay
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 70,
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
    paddingTop: 60,
  },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  authorInfo: {
    marginLeft: spacing.md,
  },

  authorName: {
    color: colors.textInverse,
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  timestamp: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.size.sm,
  },

  caption: {
    color: colors.textInverse,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.4,
  },

  // Right side actions
  actionsColumn: {
    position: 'absolute',
    right: spacing.md,
    bottom: 120,
    alignItems: 'center',
  },

  actionButton: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  actionIcon: {
    fontSize: 28,
  },

  actionIconActive: {
    transform: [{ scale: 1.1 }],
  },

  actionCount: {
    color: colors.textInverse,
    fontSize: typography.size.sm,
    marginTop: 4,
  },

  // Swipe hint
  swipeHint: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  swipeHintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: typography.size.sm,
  },
});

export default FullScreenPost;
