// =============================================================================
// FEED CARD - A single post/feed item in the list
// =============================================================================
// UPDATED: Added PIN TO TOP option in menu for admins
// - Bookmark icon
// - 3-dot menu: Copy Link, Pin (admin), Edit (owner), Delete (owner)
// - Sticky badge for pinned posts
// =============================================================================

import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { hapticLight, hapticMedium, hapticWarning } from '@/utils/haptics';
import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { YouTubeEmbed } from '@/components/media/YouTubeEmbed';
import { MediaViewer } from '@/components/media/MediaViewer';
import { ReactionPicker } from './ReactionPicker';
import { ReactionBreakdownModal } from './ReactionBreakdownModal';
import { ReactionIcon } from './ReactionIcon';
import { useTheme } from '@/contexts/ThemeContext';
import { useReactionConfig } from '@/hooks/useReactionConfig';
import { shadows, sizing, spacing, typography } from '@/constants/layout';
import { Feed, ReactionType } from '@/types/feed';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlTags } from '@/utils/htmlToText';
import { HtmlContent } from '@/components/common/HtmlContent';
import { useAuth } from '@/contexts/AuthContext';
import { SITE_URL } from '@/constants/config';
import { REACTION_EMOJI, REACTION_COLORS, REACTION_NAMES } from '@/constants/reactions';
import { extractYouTubeId } from '@/utils/youtube';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';

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

  // 2. Check for YouTube in meta.media_preview (oembed from native web)
  if (meta.media_preview?.provider === 'youtube' &&
      meta.media_preview?.content_type === 'video' &&
      meta.media_preview.url) {
    const videoId = extractYouTubeId(meta.media_preview.url);
    if (videoId) {
      return { type: 'youtube', youtubeId: videoId };
    }
  }

  // 3. Check for single image in meta.media_preview (skip if youtube provider)
  if (meta.media_preview?.image && meta.media_preview?.provider !== 'youtube') {
    return { type: 'image', imageUrl: meta.media_preview.image };
  }

  // 4. Check for featured_image
  if (feed.featured_image) {
    return { type: 'image', imageUrl: feed.featured_image };
  }

  // 5. Check for YouTube links in message text (fallback)
  const videoIdFromMessage = extractYouTubeId(message) || extractYouTubeId(messageRendered);
  if (videoIdFromMessage) {
    return { type: 'youtube', youtubeId: videoIdFromMessage };
  }

  return { type: 'none' };
}

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface FeedCardProps {
  feed: Feed;
  onReact?: (type: ReactionType) => void;
  onAuthorPress?: () => void;
  onSpacePress?: () => void;
  onCommentPress?: () => void;
  onBookmarkToggle?: (isBookmarked: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;  // Pin callback (only passed if user can pin)
  canModerate?: boolean; // If true, shows Edit/Delete/Pin for any post (admin/mod)
  variant?: 'compact' | 'full';  // compact = list view (truncated), full = single post view
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function FeedCard({
  feed,
  onReact,
  onAuthorPress,
  onSpacePress,
  onCommentPress,
  onBookmarkToggle,
  onEdit,
  onDelete,
  onPin,
  canModerate = false,
  variant = 'compact',
}: FeedCardProps) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const { reactions, getReaction, display } = useReactionConfig();
  const defaultReactionId = reactions[0]?.id || 'like';
  const [isBookmarked, setIsBookmarked] = useState(feed.bookmarked || false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | undefined>();
  const [reactionAnchor, setReactionAnchor] = useState<{ top: number; left: number } | undefined>();
  const menuButtonRef = useRef<View>(null);
  const reactionButtonRef = useRef<View>(null);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Extract data
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  const isOwner = user?.id === Number(feed.user_id);
  const isSticky = feed.is_sticky === true || feed.is_sticky === 1;
  const canPin = !!onPin; // If onPin is passed, user can pin
  const canEditOrDelete = isOwner || canModerate;
  
  const spaceName = feed.space?.title || null;
  const timestamp = formatRelativeTime(feed.created_at);
  
  // Content processing
  const rawHtml = feed.message_rendered || feed.message || '';
  const plainTextLength = stripHtmlTags(rawHtml).length;
  const isLongContent = variant === 'compact' && plainTextLength > 300;
  const [expanded, setExpanded] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  // Card has marginHorizontal: spacing.md (12) + padding: spacing.lg (16) on each side
  const contentWidth = windowWidth - spacing.md * 2 - spacing.lg * 2;
  
  // Media detection
  const media = detectMedia(feed);
  const hasImage = media.type === 'image' || media.type === 'images';
  const hasYouTube = media.type === 'youtube';
  
  // Stats
  const reactionsCount = feed.reaction_total
    ? feed.reaction_total
    : typeof feed.reactions_count === 'string'
      ? parseInt(feed.reactions_count, 10)
      : feed.reactions_count || 0;
  const commentsCount = typeof feed.comments_count === 'string'
    ? parseInt(feed.comments_count, 10)
    : feed.comments_count || 0;
  const hasUserReact = feed.has_user_react || false;
  const userReactionType = feed.user_reaction_type || null;
  const userReactionConfig = getReaction(userReactionType || defaultReactionId);
  const userReactionIconUrl = feed.user_reaction_icon_url || userReactionConfig?.icon_url || null;
  const userReactionEmoji = userReactionConfig?.emoji || (userReactionType ? REACTION_EMOJI[userReactionType] : '👍');
  const userReactionName = feed.user_reaction_name || userReactionConfig?.name || (userReactionType ? REACTION_NAMES[userReactionType] : 'Like');
  const userReactionColor = userReactionConfig?.color || (userReactionType ? REACTION_COLORS[userReactionType] : undefined);
  const reactionBreakdown = feed.reaction_breakdown || [];

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBookmarkPress = () => {
    hapticLight();
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

  // Build menu items for Android DropdownMenu
  const getMenuItems = (): DropdownMenuItem[] => {
    const items: DropdownMenuItem[] = [
      { key: 'copy', label: 'Copy Link', icon: 'link-outline', onPress: () => { setShowMenu(false); handleCopyLink(); } },
    ];

    if (canPin) {
      items.push({
        key: 'pin',
        label: isSticky ? 'Unpin from Top' : 'Pin to Top',
        icon: 'pin-outline',
        onPress: () => { setShowMenu(false); onPin?.(); },
      });
    }

    if (canEditOrDelete) {
      items.push(
        { key: 'edit', label: 'Edit', icon: 'create-outline', onPress: () => { setShowMenu(false); onEdit?.(); } },
        { key: 'delete', label: 'Delete', icon: 'trash-outline', onPress: () => { setShowMenu(false); handleDelete(); }, destructive: true },
      );
    }

    return items;
  };

  const handleMenuPress = () => {
    hapticLight();
    (menuButtonRef.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      const screenWidth = Dimensions.get('window').width;
      setMenuAnchor({ top: y + height + 4, right: screenWidth - x - width });
      setShowMenu(true);
    });
  };

  const handleDelete = () => {
    hapticWarning();
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
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      {/* ===== Sticky Indicator ===== */}
      {isSticky && (
        <View style={[styles.stickyBadge, { backgroundColor: themeColors.primaryLight + '20' }]}>
          <Ionicons name="pin" size={12} color={themeColors.primary} />
          <Text style={[styles.stickyText, { color: themeColors.primary }]}>Pinned</Text>
        </View>
      )}

      {/* ===== Header ===== */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={onAuthorPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`View ${authorName}'s profile`}
        >
          <Avatar
            source={authorAvatar}
            size="md"
            fallback={authorName}
          />

          <View style={styles.authorInfo}>
            <UserDisplayName
              name={authorName}
              verified={isVerified}
              badgeSlugs={author?.meta?.badge_slug}
              numberOfLines={1}
            />

            <View style={styles.metaRow}>
              <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>{timestamp}</Text>
              {spaceName && (
                <>
                  <Text style={[styles.dot, { color: themeColors.textTertiary }]}>•</Text>
                  <TouchableOpacity onPress={onSpacePress}>
                    <Text style={[styles.spaceName, { color: themeColors.primary }]} numberOfLines={1}>
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
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark post'}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isBookmarked ? themeColors.primary : themeColors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            ref={menuButtonRef}
            style={styles.headerButton}
            onPress={handleMenuPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Post options"
          >
            <Ionicons name="ellipsis-vertical" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== Title ===== */}
      {feed.title && (
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={variant === 'full' ? undefined : 3}>
          {feed.title}
        </Text>
      )}

      {/* ===== Content ===== */}
      {rawHtml.length > 0 && (
        <View style={[
          styles.contentContainer,
          variant !== 'full' && !expanded ? styles.contentCollapsed : undefined,
        ]}>
          <HtmlContent html={rawHtml} contentWidth={contentWidth} />
        </View>
      )}

      {/* ===== Show More / Show Less ===== */}
      {isLongContent && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
          <Text style={[styles.showMoreText, { color: themeColors.primary }]}>
            {expanded ? 'Show less' : 'Show more'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ===== Image Grid - Tappable to open Media Viewer ===== */}
      {hasImage && (() => {
        const allUrls = media.type === 'images' && media.imageUrls ? media.imageUrls : media.imageUrl ? [media.imageUrl] : [];
        const count = allUrls.length;
        const gridGap = 3;
        const extraCount = count > 4 ? count - 4 : 0;

        const renderGridImage = (url: string, index: number, style: any, isLast4Plus?: boolean) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.9}
            onPress={() => {
              setMediaViewerIndex(index);
              setShowMediaViewer(true);
            }}
            style={style}
          >
            <Image
              source={{ uri: url }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            {isLast4Plus && extraCount > 0 && (
              <View style={styles.gridOverlay}>
                <Text style={styles.gridOverlayText}>+{extraCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        );

        if (count === 1) {
          return (
            <View style={[styles.mediaContainer, { backgroundColor: themeColors.background }]}>
              {renderGridImage(allUrls[0], 0, styles.gridSingle)}
            </View>
          );
        }

        if (count === 2) {
          return (
            <View style={[styles.mediaContainer, styles.gridRow, { backgroundColor: themeColors.background, gap: gridGap }]}>
              {renderGridImage(allUrls[0], 0, styles.gridHalf)}
              {renderGridImage(allUrls[1], 1, styles.gridHalf)}
            </View>
          );
        }

        if (count === 3) {
          return (
            <View style={[styles.mediaContainer, styles.gridRow, { backgroundColor: themeColors.background, gap: gridGap, height: 260 }]}>
              {renderGridImage(allUrls[0], 0, styles.gridHalf)}
              <View style={[styles.gridHalf, { gap: gridGap }]}>
                {renderGridImage(allUrls[1], 1, styles.gridStackItem)}
                {renderGridImage(allUrls[2], 2, styles.gridStackItem)}
              </View>
            </View>
          );
        }

        // 4+ images: 2x2 grid, with +N overlay on 4th if >4
        return (
          <View style={[styles.mediaContainer, { backgroundColor: themeColors.background, height: 260 }]}>
            <View style={[styles.gridRow, { flex: 1, gap: gridGap }]}>
              {renderGridImage(allUrls[0], 0, styles.gridHalf)}
              {renderGridImage(allUrls[1], 1, styles.gridHalf)}
            </View>
            <View style={{ height: gridGap }} />
            <View style={[styles.gridRow, { flex: 1, gap: gridGap }]}>
              {renderGridImage(allUrls[2], 2, styles.gridHalf)}
              {renderGridImage(allUrls[3], 3, styles.gridHalf, count > 4)}
            </View>
          </View>
        );
      })()}
      
      {/* ===== YouTube Video ===== */}
      {hasYouTube && media.youtubeId && (
        <View style={styles.mediaContainer}>
          {!isVideoPlaying ? (
            // Show thumbnail with play button
            <>
              <Image
                source={{ uri: `https://img.youtube.com/vi/${media.youtubeId}/hqdefault.jpg` }}
                style={styles.mediaImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => setIsVideoPlaying(true)}
                activeOpacity={0.8}
              >
                <View style={styles.playButtonInner}>
                  <Ionicons name="play" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
              <View style={styles.youtubeLabel}>
                <Ionicons name="logo-youtube" size={12} color="#fff" />
              </View>
            </>
          ) : (
            // Show in-place player
            <View style={styles.inPlacePlayer}>
              <YouTubeEmbed
                videoId={media.youtubeId}
                playing={isVideoPlaying}
                onStateChange={(state) => {
                  if (state === 'ended') {
                    setIsVideoPlaying(false);
                  }
                }}
              />
            </View>
          )}
        </View>
      )}
      
      {/* ===== Footer (matches web layout: left actions + right summary) ===== */}
      <View style={[styles.footer, { borderTopColor: themeColors.borderLight }]}>
        {/* Left side: reaction + comment buttons */}
        <View style={styles.footerLeft}>
          {/* Reaction Button - tap for default like, long-press for picker */}
          <TouchableOpacity
            ref={reactionButtonRef}
            style={[
              styles.footerButton,
              hasUserReact && [
                styles.reactionButtonActive,
                { backgroundColor: (userReactionColor || themeColors.primary) + '15' },
              ],
            ]}
            onPress={() => {
              hapticLight();
              if (hasUserReact && userReactionType) {
                onReact?.(userReactionType);
              } else {
                onReact?.(defaultReactionId as ReactionType);
              }
            }}
            onLongPress={() => {
              hapticMedium();
              (reactionButtonRef.current as any)?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
                setReactionAnchor({ top: y, left: x + width / 2 });
                setShowReactionPicker(true);
              });
            }}
            delayLongPress={400}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={hasUserReact ? 'Remove reaction' : 'React to post'}
            accessibilityHint="Long press for more reactions"
          >
            <View style={{ opacity: hasUserReact ? 1 : 0.4 }}>
              <ReactionIcon iconUrl={userReactionIconUrl} emoji={userReactionEmoji} size={35} />
            </View>
          </TouchableOpacity>

          {/* Comment button */}
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => onCommentPress?.()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={commentsCount > 0 ? `${commentsCount} comments` : 'Comment'}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chatbubble-outline" size={20} color={themeColors.textSecondary} />
              {commentsCount > 0 && (
                <Text style={[styles.reactionSummaryCount, { color: themeColors.textSecondary }]}>
                  {formatCompactNumber(commentsCount)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Right side: reaction breakdown summary (tappable) */}
        {reactionBreakdown.length > 0 && reactionsCount > 0 && (
          <TouchableOpacity
            style={styles.footerRight}
            onPress={() => setShowBreakdown(true)}
            activeOpacity={0.7}
          >
            <View style={styles.reactionEmojiStack}>
              {reactionBreakdown.slice(0, display.count).map((item, i) => (
                <View
                  key={item.type}
                  style={[
                    styles.reactionStackIcon,
                    { zIndex: 10 + i, marginLeft: i === 0 ? 0 : -display.overlap },
                  ]}
                >
                  <ReactionIcon
                    iconUrl={item.icon_url}
                    emoji={item.emoji || REACTION_EMOJI[item.type as ReactionType]}
                    size={22}
                    stroke={display.stroke}
                    borderColor={themeColors.borderLight}
                  />
                </View>
              ))}
            </View>
            <Text style={[styles.reactionSummaryCount, { color: themeColors.textSecondary }]}>
              {formatCompactNumber(reactionsCount)}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ===== Reaction Picker Modal ===== */}
      <ReactionPicker
        visible={showReactionPicker}
        onSelect={(type) => onReact?.(type)}
        onClose={() => setShowReactionPicker(false)}
        currentType={userReactionType}
        anchor={reactionAnchor}
      />

      {/* ===== Reaction Breakdown Modal ===== */}
      <ReactionBreakdownModal
        visible={showBreakdown}
        onClose={() => setShowBreakdown(false)}
        objectType="feed"
        objectId={feed.id}
      />

      {/* ===== Media Viewer Overlay ===== */}
      {hasImage && (
        <MediaViewer
          visible={showMediaViewer}
          images={
            media.type === 'images' && media.imageUrls
              ? media.imageUrls.map((url) => ({ url }))
              : media.imageUrl
              ? [{ url: media.imageUrl }]
              : []
          }
          initialIndex={mediaViewerIndex}
          onClose={() => setShowMediaViewer(false)}
        />
      )}

      {/* ===== Post Options Menu ===== */}
      <DropdownMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={getMenuItems()}
        anchor={menuAnchor}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
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
    borderRadius: sizing.borderRadius.sm,
    alignSelf: 'flex-start',
  },

  stickyText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
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
  
  
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  
  timestamp: {
    fontSize: typography.size.sm,
  },

  dot: {
    fontSize: typography.size.sm,
    marginHorizontal: spacing.xs,
  },

  spaceName: {
    fontSize: typography.size.sm,
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
    marginBottom: spacing.sm,
    lineHeight: 24,
  },

  // Content
  contentContainer: {
    marginBottom: spacing.sm,
  },

  contentCollapsed: {
    maxHeight: 132, // ~6 lines at lineHeight 22
    overflow: 'hidden' as const,
  },

  showMoreText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  
  // Media Grid
  mediaContainer: {
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.md,
    height: 200,
    overflow: 'hidden',
    borderRadius: sizing.borderRadius.md,
    marginLeft: 0,
    marginRight: 0,
  },

  mediaImage: {
    width: '100%',
    height: '100%',
  },

  gridRow: {
    flexDirection: 'row',
  },

  gridSingle: {
    flex: 1,
  },

  gridHalf: {
    flex: 1,
  },

  gridStackItem: {
    flex: 1,
  },

  gridImage: {
    width: '100%',
    height: '100%',
  },

  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  gridOverlayText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  playButtonInner: {
    width: 48,
    height: 34,
    borderRadius: sizing.borderRadius.sm,
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  youtubeLabel: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.xs,
  },

  playIcon: {
    fontSize: 24,
  },

  inPlacePlayer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  // Footer (web-matching layout: left actions + right summary)
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },

  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  footerButton: {
    padding: spacing.xs,
    borderRadius: sizing.borderRadius.md,
  },

  reactionButtonActive: {},

  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  reactionEmojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  reactionStackIcon: {
    // marginLeft and zIndex set inline from display config
  },

  reactionSummaryCount: {
    fontSize: typography.size.sm,
  },
});

export default FeedCard;
