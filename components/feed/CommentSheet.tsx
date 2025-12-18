// =============================================================================
// COMMENT SHEET - Slide-up comments panel with real input
// =============================================================================
// Displays comments for a post in a bottom sheet.
// Now includes REAL composer for adding comments!
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { Comment } from '@/types';
import { commentsApi } from '@/services/api';
import { Avatar } from '@/components/common/Avatar';
import { formatRelativeTime } from '@/utils/formatDate';
import { stripHtmlTags } from '@/utils/htmlToText';
import { Composer, ComposerSubmitData } from '@/components/composer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface CommentSheetProps {
  visible: boolean;
  feedId: number | null;
  onClose: () => void;
  onCommentAdded?: () => void; // Callback to refresh parent feed
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CommentSheet({ visible, feedId, onClose, onCommentAdded }: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch comments when sheet opens
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (visible && feedId) {
      fetchComments();
    }
    
    // Reset when closed
    if (!visible) {
      setReplyingTo(null);
    }
  }, [visible, feedId]);

  const fetchComments = async () => {
    if (!feedId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await commentsApi.getComments(feedId);
      
      if (response.success) {
        setComments(response.data.comments || []);
      } else {
        setError('Failed to load comments');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Create Comment
  // ---------------------------------------------------------------------------

  const handleSubmitComment = async (data: ComposerSubmitData) => {
    if (!feedId) return;

    try {
      const response = await commentsApi.createComment(feedId, {
        message: data.message,
        content_type: data.content_type,
        parent_id: data.parent_id,
        // Note: meta with media_items if attachments exist
        ...(data.meta && { meta: data.meta }),
      });

      if (response.success) {
        // Refresh comments
        fetchComments();
        // Clear reply state
        setReplyingTo(null);
        // Notify parent
        onCommentAdded?.();
      } else {
        throw new Error(response.error?.message || 'Failed to post comment');
      }
    } catch (err) {
      console.error('Comment error:', err);
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // Reply to comment
  // ---------------------------------------------------------------------------

  const handleReply = (comment: Comment) => {
    setReplyingTo(comment);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  // ---------------------------------------------------------------------------
  // Render comment item
  // ---------------------------------------------------------------------------

  const renderComment = ({ item }: { item: Comment }) => {
    const author = item.xprofile;
    const authorName = author?.display_name || 'Unknown';
    const authorAvatar = author?.avatar || null;
    const isVerified = author?.is_verified === 1;
    const content = stripHtmlTags(item.message_rendered || item.message);
    const timestamp = formatRelativeTime(item.created_at);
    const isReply = item.parent_id !== null;

    return (
      <View style={[styles.commentItem, isReply && styles.commentReply]}>
        <Avatar
          source={authorAvatar}
          size="sm"
          verified={isVerified}
          fallback={authorName}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentAuthor}>{authorName}</Text>
            <Text style={styles.commentTime}>{timestamp}</Text>
          </View>
          <Text style={styles.commentText}>{content}</Text>
          
          {/* Comment actions */}
          <View style={styles.commentActions}>
            <TouchableOpacity style={styles.commentAction}>
              <Text style={styles.commentActionText}>❤️ Like</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.commentAction}
              onPress={() => handleReply(item)}
            >
              <Text style={styles.commentActionText}>↩️ Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Handle */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchComments} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No Comments Yet</Text>
            <Text style={styles.emptyText}>Be the first to comment!</Text>
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
          <View style={styles.replyIndicator}>
            <Text style={styles.replyText}>
              Replying to <Text style={styles.replyName}>{replyingTo.xprofile?.display_name}</Text>
            </Text>
            <TouchableOpacity onPress={cancelReply}>
              <Text style={styles.replyCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Comment Input - REAL COMPOSER! */}
        <View style={styles.inputContainer}>
          <Composer
            mode={replyingTo ? 'reply' : 'comment'}
            feedId={feedId || undefined}
            parentId={replyingTo?.id}
            placeholder={replyingTo ? `Reply to ${replyingTo.xprofile?.display_name}...` : 'Write a comment...'}
            onSubmit={handleSubmitComment}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.surface,
    borderTopLeftRadius: sizing.borderRadius.xl,
    borderTopRightRadius: sizing.borderRadius.xl,
  },

  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.text,
  },

  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  closeIcon: {
    fontSize: 18,
    color: colors.textSecondary,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  errorText: {
    color: colors.error,
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.md,
  },

  retryText: {
    color: colors.textInverse,
    fontWeight: '600',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
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
    borderLeftColor: colors.border,
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
    color: colors.text,
    marginRight: spacing.sm,
  },

  commentTime: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
  },

  commentText: {
    fontSize: typography.size.md,
    color: colors.text,
    lineHeight: typography.size.md * 1.4,
  },

  commentActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },

  commentAction: {
    marginRight: spacing.lg,
  },

  commentActionText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  // Reply indicator
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  replyText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  replyName: {
    fontWeight: '600',
    color: colors.text,
  },

  replyCancelText: {
    fontSize: 16,
    color: colors.textSecondary,
    padding: spacing.sm,
  },

  // Input container
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
  },
});

export default CommentSheet;
