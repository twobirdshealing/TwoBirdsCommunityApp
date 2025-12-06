// =============================================================================
// FEED CARD - A single post/feed item in the list
// =============================================================================
// Displays author, content, reactions, and comments count.
// Tap to view full post (Phase 1), tap reactions to react (Phase 1).
//
// Usage:
//   <FeedCard 
//     feed={feedItem} 
//     onPress={() => navigate('feed', { id: feed.id })}
//     onReact={(type) => handleReact(feed.id, type)}
//   />
// =============================================================================

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { Feed } from '@/types';
import { formatRelativeTime } from '@/utils/formatDate';
import { formatCompactNumber } from '@/utils/formatNumber';
import { stripHtmlTags, truncateText } from '@/utils/htmlToText';
import { Avatar } from '@/components/common/Avatar';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface FeedCardProps {
  // The feed data
  feed: Feed;
  
  // Called when card is tapped (navigate to detail)
  onPress?: () => void;
  
  // Called when user taps reaction (Phase 1)
  onReact?: (type: 'like' | 'love') => void;
  
  // Called when user taps author (navigate to profile)
  onAuthorPress?: () => void;
  
  // Called when user taps space name (navigate to space)
  onSpacePress?: () => void;
  
  // Show full content or truncated preview
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
  // Extract data with safe defaults
  const author = feed.xprofile;
  const authorName = author?.display_name || 'Unknown';
  const authorAvatar = author?.avatar || null;
  const isVerified = author?.is_verified === 1;
  
  const spaceName = feed.space?.title;
  const timestamp = formatRelativeTime(feed.created_at);
  
  const content = stripHtmlTags(feed.message_rendered || feed.message);
  const displayContent = showFullContent ? content : truncateText(content, 200);
  
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
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName} numberOfLines={1}>
                {authorName}
              </Text>
            </View>
            
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
      
      {/* ===== Title (if exists) ===== */}
      {feed.title && (
        <Text style={styles.title} numberOfLines={2}>
          {feed.title}
        </Text>
      )}
      
      {/* ===== Content ===== */}
      <Text style={styles.content}>
        {displayContent}
      </Text>
      
      {/* ===== Featured Image (if exists) ===== */}
      {feed.featured_image && (
        <Image 
          source={{ uri: feed.featured_image }}
          style={styles.featuredImage}
          resizeMode="cover"
        />
      )}
      
      {/* ===== Footer: Reactions + Comments ===== */}
      <View style={styles.footer}>
        {/* Reaction Buttons */}
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
        
        {/* Comments Count */}
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
  
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  authorName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
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
    fontWeight: typography.weight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  
  // Content
  content: {
    fontSize: typography.size.md,
    color: colors.text,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  
  // Featured Image
  featuredImage: {
    width: '100%',
    height: 200,
    borderRadius: sizing.borderRadius.md,
    marginTop: spacing.md,
    backgroundColor: colors.skeleton,
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
