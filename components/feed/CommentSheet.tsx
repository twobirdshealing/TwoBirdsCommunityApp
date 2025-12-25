// =============================================================================
// COMMENT SHEET - Slide-up comments panel with real input
// =============================================================================
// FIXED: Use 'comment' not 'message' for API
// FIXED: Add media_images support for image comments
// FIXED: Comment reactions use {state: 1} format
// FIXED: Swipe down on handle to close
// FIXED: Reply uses top-level parent_id with @mention
// ADDED: 3-dot menu with Copy Link, Edit, Delete
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { Comment } from '@/types';
import { commentsApi, mediaApi } from '@/services/api';
import { Avatar } from '@/components/common/Avatar';
import { formatRelativeTime } from '@/utils/formatDate';
import { stripHtmlTags } from '@/utils/htmlToText';
import { useAuth } from '@/contexts/AuthContext';
import { SITE_URL } from '@/constants/config';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CommentSheetProps {
  visible: boolean;
  feedId: number | null;
  feedSlug?: string;  // For copy link URL
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

export function CommentSheet({ visible, feedId, feedSlug, onClose, onCommentAdded }: CommentSheetProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  
  // Comment input state
  const [commentText, setCommentText] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edit mode state
  const [editingComment, setEditingComment] = useState<Comment | null>(null);

  // Swipe to close
  const translateY = useRef(new Animated.Value(0)).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow downward movement
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down more than 100px, close the sheet
        if (gestureState.dy > 100) {
          Animated.timing(translateY, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Reset position when opening
  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

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
      setEditingComment(null);
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
  // Now supports both create and edit modes
  // ---------------------------------------------------------------------------

  const handleSubmitComment = async () => {
    if (!feedId) return;
    
    const trimmedText = commentText.trim();
    if (!trimmedText && attachedImages.length === 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      // EDIT MODE
      if (editingComment) {
        console.log('[CommentSheet] Updating comment:', editingComment.id);
        
        const response = await commentsApi.updateComment(feedId, editingComment.id, {
          comment: trimmedText,
        });

        if (response.success) {
          // Update in local state
          setComments(prev => prev.map(c => 
            c.id === editingComment.id 
              ? { ...c, message: trimmedText, message_rendered: `<p>${trimmedText}</p>` }
              : c
          ));
          setCommentText('');
          setEditingComment(null);
        } else {
          throw new Error(response.error?.message || 'Failed to update comment');
        }
        return;
      }

      // CREATE MODE
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

      const parentId = getReplyParentId();
      
      console.log('[CommentSheet] Submitting comment:', {
        comment: trimmedText,
        parent_id: parentId,
        replyingToId: replyingTo?.id,
        replyingToParentId: replyingTo?.parent_id,
        hasImages: !!media_images,
      });

      const response = await commentsApi.createComment(feedId, {
        comment: trimmedText,
        parent_id: parentId,
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
  // Reply to comment - FIXED: Always reply to top-level parent
  // ---------------------------------------------------------------------------

  const handleReply = (comment: Comment) => {
    // If this comment has a parent_id, it's already a reply
    // We should reply to the TOP-LEVEL comment, not nest deeper
    // Also pre-fill with @username mention
    setReplyingTo(comment);
    
    // Add @username mention to input
    const username = comment.xprofile?.username || comment.xprofile?.display_name || '';
    if (username) {
      setCommentText(`@${username} `);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  // Get the correct parent_id for replies
  // If replying to a reply, use the reply's parent_id (top-level comment)
  // If replying to a top-level comment, use its ID
  const getReplyParentId = (): number | undefined => {
    if (!replyingTo) return undefined;
    
    // If the comment we're replying to already has a parent_id,
    // use THAT parent_id (the top-level comment)
    if (replyingTo.parent_id) {
      return replyingTo.parent_id;
    }
    
    // Otherwise this IS a top-level comment, use its ID
    return replyingTo.id;
  };

  // ---------------------------------------------------------------------------
  // Handle Comment Reaction - FIXED: Uses {state: 1} format
  // ---------------------------------------------------------------------------

  const handleCommentReaction = async (comment: Comment) => {
    if (!feedId) return;
    
    const hasReacted = comment.has_user_react || false;
    
    // Optimistic update
    setComments(prevComments =>
      prevComments.map(c => {
        if (c.id === comment.id) {
          const currentCount = typeof c.reactions_count === 'string'
            ? parseInt(c.reactions_count, 10)
            : c.reactions_count || 0;
          
          return {
            ...c,
            has_user_react: !hasReacted,
            reactions_count: hasReacted ? currentCount - 1 : currentCount + 1,
          };
        }
        return c;
      })
    );
    
    try {
      await commentsApi.reactToComment(feedId, comment.id, hasReacted);
    } catch (err) {
      console.error('[CommentSheet] Reaction error:', err);
      // Revert on error
      setComments(prevComments =>
        prevComments.map(c => c.id === comment.id ? comment : c)
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Comment Menu Actions
  // ---------------------------------------------------------------------------

  const handleCommentMenu = (comment: Comment) => {
    const isOwner = user?.id === Number(comment.user_id);
    
    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Copy Link'];
      if (isOwner) {
        options.push('Edit', 'Delete');
      }
      
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: isOwner ? options.indexOf('Delete') : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleCopyLink(comment);
          else if (isOwner && buttonIndex === 2) handleEditComment(comment);
          else if (isOwner && buttonIndex === 3) handleDeleteComment(comment);
        }
      );
    } else {
      // Android - Cancel first so it appears at bottom
      const buttons: any[] = [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Copy Link', onPress: () => handleCopyLink(comment) },
      ];
      
      if (isOwner) {
        buttons.push({ text: 'Edit', onPress: () => handleEditComment(comment) });
        buttons.push({ 
          text: 'Delete', 
          onPress: () => handleDeleteComment(comment),
          style: 'destructive'
        });
      }
      
      Alert.alert(
        'Comment Options',
        'Choose an action',
        buttons,
        { cancelable: true }
      );
    }
  };

  const handleCopyLink = async (comment: Comment) => {
    // Build URL like: https://site.com/portal/post/feed-slug?comment_id=123
    const slug = feedSlug || `feed-${feedId}`;
    const url = `${SITE_URL}/portal/post/${slug}?comment_id=${comment.id}`;
    
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied!', 'Link copied to clipboard');
    } catch (err) {
      // If clipboard fails, show URL so user can manually copy
      console.error('Copy failed:', err);
      Alert.alert('Comment Link', url);
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingComment(comment);
    setCommentText(stripHtmlTags(comment.message_rendered || comment.message));
    setReplyingTo(null);
  };

  const handleDeleteComment = (comment: Comment) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!feedId) return;
            
            try {
              const response = await commentsApi.deleteComment(feedId, comment.id);
              
              if (response.success) {
                // Remove from local state
                setComments(prev => prev.filter(c => c.id !== comment.id));
                onCommentAdded?.(); // Refresh parent
              } else {
                Alert.alert('Error', response.error?.message || 'Failed to delete');
              }
            } catch (err) {
              console.error('Delete error:', err);
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setCommentText('');
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

    // Check for images in comment - multiple possible locations
    // API might return as media_images, media_items, or media_preview
    const meta = item.meta || {};
    let commentImages: Array<{ url: string }> = [];
    
    if (meta.media_images && Array.isArray(meta.media_images)) {
      commentImages = meta.media_images;
    } else if (meta.media_items && Array.isArray(meta.media_items)) {
      commentImages = meta.media_items;
    } else if (meta.media_preview?.image) {
      commentImages = [{ url: meta.media_preview.image }];
    }

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
            <View style={styles.commentHeaderLeft}>
              <Text style={styles.commentAuthor}>{authorName}</Text>
              <Text style={styles.commentTime}>{timestamp}</Text>
            </View>
            {/* 3-dot menu */}
            <TouchableOpacity
              style={styles.commentMenuButton}
              onPress={() => handleCommentMenu(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
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
          
          {/* Comment actions - FIXED: Working reactions */}
          <View style={styles.commentActions}>
            <TouchableOpacity 
              style={styles.commentAction}
              onPress={() => handleCommentReaction(item)}
            >
              <Text style={[
                styles.commentActionText,
                item.has_user_react && styles.commentActionActive
              ]}>
                {item.has_user_react ? '❤️' : '🤍'} {
                  typeof item.reactions_count === 'string'
                    ? parseInt(item.reactions_count, 10) || ''
                    : item.reactions_count || ''
                }
              </Text>
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

      {/* Sheet - Now animated for swipe */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY }] }
        ]}
      >
        <KeyboardAvoidingView
          style={styles.sheetInner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Handle - Swipeable */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
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

        {/* Reply indicator - shows who you're mentioning */}
        {replyingTo && !editingComment && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyText}>
              Replying to <Text style={styles.replyName}>@{replyingTo.xprofile?.username || replyingTo.xprofile?.display_name}</Text>
            </Text>
            <TouchableOpacity onPress={cancelReply}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Edit indicator */}
        {editingComment && (
          <View style={[styles.replyIndicator, styles.editIndicator]}>
            <Text style={styles.replyText}>
              Editing comment
            </Text>
            <TouchableOpacity onPress={cancelEdit}>
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
            placeholder={replyingTo ? 'Write your reply...' : 'Write a comment...'}
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
              <Ionicons name={editingComment ? "checkmark" : "send"} size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
      </Animated.View>
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

  sheetInner: {
    flex: 1,
  },

  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    cursor: 'grab',
  },

  handle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
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
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  commentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  commentMenuButton: {
    padding: 4,
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

  commentActionActive: {
    color: colors.error,
    fontWeight: '600',
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

  editIndicator: {
    backgroundColor: colors.warning + '20',
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
