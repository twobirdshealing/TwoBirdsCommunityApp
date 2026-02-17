// =============================================================================
// BLOG COMMENT SHEET - Comments panel for WordPress blog posts
// =============================================================================
// Simplified version of CommentSheet.tsx adapted for WP comments API.
// No reactions, no image attachments, no edit/delete, no mentions.
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { WPComment } from '@/types/blog';
import { blogApi } from '@/services/api';
import { Avatar } from '@/components/common/Avatar';
import { BottomSheet } from '@/components/common/BottomSheet';
import { formatRelativeTime } from '@/utils/formatDate';
import { stripHtmlTags } from '@/utils/htmlToText';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface BlogCommentSheetProps {
  visible: boolean;
  postId: number | null;
  onClose: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function BlogCommentSheet({ visible, postId, onClose }: BlogCommentSheetProps) {
  const { colors: themeColors } = useTheme();
  const router = useRouter();

  const [comments, setComments] = useState<WPComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input state
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<WPComment | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Comments
  // ---------------------------------------------------------------------------

  const fetchComments = async () => {
    if (!postId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await blogApi.getBlogComments(postId);

      if (!response.success) {
        setError(response.error?.message || 'Failed to load comments');
        return;
      }

      // Flatten: show top-level comments, then insert replies after their parent
      const topLevel = response.data.comments.filter((c) => c.parent === 0);
      const replies = response.data.comments.filter((c) => c.parent !== 0);

      const flattened: WPComment[] = [];
      topLevel.forEach((comment) => {
        flattened.push(comment);
        // Find replies to this comment
        replies
          .filter((r) => r.parent === comment.id)
          .forEach((reply) => flattened.push(reply));
      });

      setComments(flattened);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && postId) {
      fetchComments();
    }
    if (!visible) {
      // Reset state on close
      setComments([]);
      setCommentText('');
      setReplyingTo(null);
      setError(null);
    }
  }, [visible, postId]);

  // ---------------------------------------------------------------------------
  // Submit Comment
  // ---------------------------------------------------------------------------

  const handleSubmitComment = async () => {
    if (!postId) return;

    const trimmed = commentText.trim();
    if (!trimmed) return;

    setIsSubmitting(true);

    try {
      const response = await blogApi.createBlogComment({
        post: postId,
        content: trimmed,
        parent: replyingTo ? getReplyParentId() : 0,
      });

      if (response.success) {
        setCommentText('');
        setReplyingTo(null);
        fetchComments(); // Refresh list
      } else {
        throw new Error(response.error?.message || 'Failed to post comment');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Reply Handling
  // ---------------------------------------------------------------------------

  const handleReply = (comment: WPComment) => {
    setReplyingTo(comment);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  // Always reply to the top-level parent (same as FC CommentSheet)
  const getReplyParentId = (): number => {
    if (!replyingTo) return 0;
    return replyingTo.parent > 0 ? replyingTo.parent : replyingTo.id;
  };

  // ---------------------------------------------------------------------------
  // Navigate to Author Profile
  // ---------------------------------------------------------------------------

  const handleAuthorPress = async (wpUserId: number) => {
    if (wpUserId === 0) return; // Guest comment
    const slug = await blogApi.getWpUserSlug(wpUserId);
    if (slug) {
      onClose();
      router.push(`/profile/${slug}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Render Comment Item
  // ---------------------------------------------------------------------------

  const renderComment = ({ item }: { item: WPComment }) => {
    const isReply = item.parent > 0;
    const avatarUrl = item.author_avatar_urls?.['96'] || item.author_avatar_urls?.['48'] || null;
    const commentContent = stripHtmlTags(item.content.rendered);

    return (
      <View style={[styles.commentItem, isReply && [styles.commentReply, { borderLeftColor: themeColors.border }]]}>
        <TouchableOpacity onPress={() => handleAuthorPress(item.author)} disabled={item.author === 0}>
          <Avatar source={avatarUrl} size="sm" fallback={item.author_name} />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <TouchableOpacity onPress={() => handleAuthorPress(item.author)} disabled={item.author === 0}>
              <Text style={[styles.commentAuthor, { color: themeColors.text }]}>
                {item.author_name}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.commentTime, { color: themeColors.textTertiary }]}>
              {formatRelativeTime(item.date)}
            </Text>
          </View>
          <Text style={[styles.commentText, { color: themeColors.text }]}>
            {commentContent}
          </Text>
          <TouchableOpacity style={styles.replyAction} onPress={() => handleReply(item)}>
            <Text style={[styles.replyActionText, { color: themeColors.textSecondary }]}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Can Submit
  // ---------------------------------------------------------------------------

  const canSubmit = commentText.trim().length > 0 && !isSubmitting;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightMode="percentage"
      heightPercentage={75}
      title="Comments"
      keyboardAvoiding
    >
      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
          <TouchableOpacity
            onPress={fetchComments}
            style={[styles.retryButton, { backgroundColor: themeColors.primary }]}
          >
            <Text style={[styles.retryText, { color: themeColors.textInverse }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>{'\uD83D\uDCAC'}</Text>
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Comments Yet</Text>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            Be the first to comment!
          </Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderComment}
          contentContainerStyle={styles.commentsList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <View style={[styles.replyIndicator, { backgroundColor: themeColors.primaryLight + '20' }]}>
          <Text style={[styles.replyIndicatorText, { color: themeColors.textSecondary }]}>
            Replying to{' '}
            <Text style={[styles.replyName, { color: themeColors.primary }]}>
              {replyingTo.author_name}
            </Text>
          </Text>
          <TouchableOpacity onPress={cancelReply}>
            <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Comment Input */}
      <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
          placeholder={replyingTo ? 'Write your reply...' : 'Write a comment...'}
          placeholderTextColor={themeColors.textTertiary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: themeColors.primary },
            !canSubmit && [styles.sendButtonDisabled, { backgroundColor: themeColors.textTertiary }],
          ]}
          onPress={handleSubmitComment}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={themeColors.textInverse} />
          ) : (
            <Ionicons name="send" size={20} color={themeColors.textInverse} />
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  errorText: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.md,
  },

  retryText: {
    fontWeight: '600',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  emptyText: {
    fontSize: typography.size.md,
  },

  commentsList: {
    padding: spacing.lg,
    paddingBottom: 100,
  },

  commentItem: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },

  commentReply: {
    marginLeft: spacing.xl,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
  },

  commentContent: {
    flex: 1,
    marginLeft: spacing.md,
  },

  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  commentAuthor: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginRight: spacing.sm,
  },

  commentTime: {
    fontSize: typography.size.xs,
  },

  commentText: {
    fontSize: typography.size.md,
    lineHeight: 20,
  },

  replyAction: {
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },

  replyActionText: {
    fontSize: typography.size.sm,
  },

  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  replyIndicatorText: {
    fontSize: typography.size.sm,
  },

  replyName: {
    fontWeight: '600',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },

  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    fontSize: typography.size.md,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {},
});

export default BlogCommentSheet;
