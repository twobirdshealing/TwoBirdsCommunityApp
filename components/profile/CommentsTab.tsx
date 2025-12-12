// =============================================================================
// COMMENTS TAB - Display user's comments in timeline format
// =============================================================================

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { ProfileComment } from '@/types';
import { stripHtml, getPostExcerpt, formatTimeAgo } from '@/utils/profileUtils';

interface CommentsTabProps {
  comments: ProfileComment[];
  loading?: boolean;
}

export function CommentsTab({ comments = [], loading }: CommentsTabProps) {
  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Loading comments...</Text>
      </View>
    );
  }

  if (!Array.isArray(comments) || comments.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={styles.emptyText}>No comments yet</Text>
      </View>
    );
  }

  const handlePostPress = async (comment: ProfileComment) => {
    const url = comment.post?.permalink || 
                `https://staging.twobirdschurch.com/portal/feed/${comment.post?.slug}`;
    
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  return (
    <View style={styles.container}>
      {comments.map((comment, index) => {
        const postExcerpt = getPostExcerpt(comment.post);
        const commentText = stripHtml(comment.message_rendered || comment.message);
        const hasMediaPreview = comment.meta?.media_preview?.image;
        const reactionsCount = Number(comment.reactions_count) || 0;
        const isLast = index === comments.length - 1;

        return (
          <View key={comment.id} style={styles.commentCard}>
            <View style={styles.timeline}>
              <View style={styles.timelineDotContainer}>
                <View style={styles.timelineDot} />
              </View>
              {!isLast && <View style={styles.timelineLine} />}
            </View>

            <View style={styles.commentContent}>
              <TouchableOpacity 
                onPress={() => handlePostPress(comment)} 
                activeOpacity={0.7}
              >
                <Text style={styles.postLink} numberOfLines={2}>
                  {postExcerpt}
                </Text>
              </TouchableOpacity>

              <Text style={styles.commentText} numberOfLines={4}>
                {commentText}
              </Text>

              {hasMediaPreview && (
                <Image
                  source={{ uri: comment.meta.media_preview.image }}
                  style={styles.mediaPreview}
                  resizeMode="cover"
                />
              )}

              <View style={styles.commentFooter}>
                <Text style={styles.commentTime}>
                  {formatTimeAgo(comment.created_at)}
                </Text>
                
                {reactionsCount > 0 && (
                  <>
                    <View style={styles.footerDivider} />
                    <Text style={styles.reactions}>
                      ❤️ {reactionsCount}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },

  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  commentCard: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },

  timeline: {
    width: 40,
    alignItems: 'center',
    marginRight: spacing.md,
  },

  timelineDotContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },

  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  timelineLine: {
    position: 'absolute',
    top: 20,
    bottom: -spacing.lg,
    width: 2,
    backgroundColor: colors.border,
  },

  commentContent: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  postLink: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
    marginBottom: spacing.sm,
  },

  commentText: {
    fontSize: typography.size.sm,
    color: colors.text,
    lineHeight: typography.size.sm * 1.5,
    marginBottom: spacing.sm,
  },

  mediaPreview: {
    width: '100%',
    height: 150,
    borderRadius: sizing.borderRadius.sm,
    backgroundColor: colors.skeleton,
    marginTop: spacing.sm,
  },

  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  commentTime: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
  },

  footerDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },

  reactions: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
});

export default CommentsTab;
