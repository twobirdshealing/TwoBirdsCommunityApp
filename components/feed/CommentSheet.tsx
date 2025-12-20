// =============================================================================
// COMMENT SHEET - Slide-up comments panel with real input
// =============================================================================
// FIXED: Use 'comment' not 'message' for API
// FIXED: Add media_images support for image comments
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { Comment } from '@/types';
import { commentsApi, mediaApi } from '@/services/api';
import { Avatar } from '@/components/common/Avatar';
import { formatRelativeTime } from '@/utils/formatDate';
import { stripHtmlTags } from '@/utils/htmlToText';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CommentSheetProps {
  visible: boolean;
  feedId: number | null;
  onClose: () => void;
  onCommentAdded?: () => void;
}

interface AttachedImage {
  url: string;
  width: number;
  height: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CommentSheet({ visible, feedId, onClose, onCommentAdded }: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  
  // Comment input state
  const [commentText, setCommentText] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setCommentText('');
      setAttachedImages([]);
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
  // Image Picker
  // ---------------------------------------------------------------------------

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 4 - attachedImages.length,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setIsUploading(true);

      for (const asset of result.assets) {
        const fileName = asset.uri.split('/').pop() || 'image.jpg';
        const fileType = asset.mimeType || 'image/jpeg';

        const response = await mediaApi.uploadMedia(
          asset.uri,
          fileType,
          fileName,
          'comment'
        );

        if (response.success && response.data) {
          setAttachedImages(prev => [
            ...prev,
            {
              url: response.data!.url,
              width: asset.width || 0,
              height: asset.height || 0,
            },
          ]);
        } else {
          Alert.alert('Upload Failed', response.error?.message || 'Could not upload image');
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  // ---------------------------------------------------------------------------
  // Submit Comment - FIXED: Use 'comment' not 'message'
  // ---------------------------------------------------------------------------

  const handleSubmitComment = async () => {
    if (!feedId) return;
    
    const trimmedText = commentText.trim();
    if (!trimmedText && attachedImages.length === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Build media_images array if we have attachments
      const media_images = attachedImages.length > 0
        ? attachedImages.map(img => ({
            url: img.url,
            type: 'image',
            width: 0,
            height: 0,
            provider: 'uploader',
          }))
        : undefined;

      const response = await commentsApi.createComment(feedId, {
        comment: trimmedText,  // FIXED: Use 'comment' not 'message'
        parent_id: replyingTo?.id,
        media_images,
      });

      if (response.success) {
        // Clear input
        setCommentText('');
        setAttachedImages([]);
        setReplyingTo(null);
        // Refresh comments
        fetchComments();
        // Notify parent
        onCommentAdded?.();
      } else {
        throw new Error(response.error?.message || 'Failed to post comment');
      }
    } catch (err) {
      console.error('[CommentSheet] ERROR:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
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

    // Check for images in comment
    const commentImages = item.meta?.media_images || [];

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
          
          {/* Comment images */}
          {commentImages.length > 0 && (
            <View style={styles.commentImages}>
              {commentImages.map((img: any, idx: number) => (
                <Image
                  key={idx}
                  source={{ uri: img.url }}
                  style={styles.commentImage}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}
          
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
  // Can Submit
  // ---------------------------------------------------------------------------

  const canSubmit = (commentText.trim().length > 0 || attachedImages.length > 0) && !isSubmitting && !isUploading;

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
            <Ionicons name="close" size={24} color={colors.textSecondary} />
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
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Attached Images Preview */}
        {attachedImages.length > 0 && (
          <View style={styles.attachedImagesContainer}>
            {attachedImages.map((img, idx) => (
              <View key={idx} style={styles.attachedImageWrapper}>
                <Image source={{ uri: img.url }} style={styles.attachedImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(idx)}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {isUploading && (
              <View style={styles.uploadingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>
        )}

        {/* Comment Input */}
        <View style={styles.inputContainer}>
          {/* Image picker button */}
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handlePickImage}
            disabled={isUploading || attachedImages.length >= 4}
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={attachedImages.length >= 4 ? colors.textTertiary : colors.primary}
            />
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            style={styles.textInput}
            placeholder={replyingTo ? `Reply to ${replyingTo.xprofile?.display_name}...` : 'Write a comment...'}
            placeholderTextColor={colors.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={2000}
          />

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.sendButton, !canSubmit && styles.sendButtonDisabled]}
            onPress={handleSubmitComment}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
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
    lineHeight: 20,
  },

  commentImages: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },

  commentImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },

  commentActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.md,
  },

  commentAction: {
    paddingVertical: spacing.xs,
  },

  commentActionText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight + '20',
  },

  replyText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  replyName: {
    fontWeight: '600',
    color: colors.primary,
  },

  attachedImagesContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  attachedImageWrapper: {
    position: 'relative',
  },

  attachedImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },

  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
  },

  uploadingIndicator: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },

  imageButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 20,
    fontSize: typography.size.md,
    color: colors.text,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {
    backgroundColor: colors.textTertiary,
  },
});

export default CommentSheet;
