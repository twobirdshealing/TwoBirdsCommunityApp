// =============================================================================
// COMMENT SHEET - Full-screen comments panel with rich text editor
// =============================================================================
// Rendered as a dedicated stack screen (app/comments/[postId].tsx) — NOT a
// Modal, because RN Modal creates an Android Dialog that blocks WebView touches.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { RichText } from '@10play/tentap-editor';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { htmlToMarkdown } from '@/utils/htmlToMarkdown';
import * as Clipboard from 'expo-clipboard';
import { hapticLight, hapticWarning } from '@/utils/haptics';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { useThemedEditor } from '@/hooks/useThemedEditor';
import { Comment } from '@/types/comment';
import { commentsApi } from '@/services/api/comments';
import { mediaApi } from '@/services/api/media';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Button } from '@/components/common/Button';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { ReportModal } from '@/components/common/ReportModal';
import { MarkdownToolbar } from '@/components/composer/MarkdownToolbar';
import { GifPickerModal } from '@/components/composer/GifPickerModal';
import { GifAttachment } from '@/types/gif';
import { MediaViewer } from '@/components/media/MediaViewer';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { HtmlContent } from '@/components/common/HtmlContent';
import { CommentItem } from './CommentItem';
import { useAuth } from '@/contexts/AuthContext';
import { SITE_URL } from '@/constants/config';
import { createLogger } from '@/utils/logger';

const log = createLogger('Comments');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CommentSheetProps {
  postId: number | null;
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

export function CommentSheet({ postId, feedSlug, onClose, onCommentAdded }: CommentSheetProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  // Comment content width: window - list padding(16*2) - avatar(32) - avatar margin(12)
  const commentContentWidth = windowWidth - spacing.lg * 2 - sizing.avatar.sm - spacing.md;
  const [comments, setComments] = useState<Comment[]>([]);
  const [stickyComment, setStickyComment] = useState<Comment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  // Comment input state
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [gifAttachment, setGifAttachment] = useState<GifAttachment | null>(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit mode state
  const [editingComment, setEditingComment] = useState<Comment | null>(null);

  // Comment image viewer state (null = hidden)
  const [commentMedia, setCommentMedia] = useState<{ images: Array<{ url: string }>; index: number } | null>(null);
  // Menu state
  const [menuComment, setMenuComment] = useState<Comment | null>(null);
  const [reportComment, setReportComment] = useState<Comment | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | undefined>();
  const menuButtonRefs = useRef<Record<number, View | null>>({});

  // ---------------------------------------------------------------------------
  // 10tap Editor Bridge for comment input
  // ---------------------------------------------------------------------------

  const commentEditor = useThemedEditor({ placeholder: 'Write a comment...' });

  // ---------------------------------------------------------------------------
  // Fetch Comments
  // ---------------------------------------------------------------------------

  const fetchComments = async () => {
    if (!postId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await commentsApi.getComments(postId);

      if (!response.success) {
        setError(response.error?.message || 'Failed to load comments');
        return;
      }

      // Handle pinned comment (FC 2.2.01+)
      setStickyComment(response.data.sticky_comment || null);

      // Flatten nested comments for display
      const allComments: Comment[] = [];

      response.data.comments?.forEach((comment: Comment) => {
        allComments.push(comment);
        // Add replies after parent
        if (comment.replies && comment.replies.length > 0) {
          comment.replies.forEach((reply: Comment) => {
            allComments.push(reply);
          });
        }
      });

      setComments(allComments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      fetchComments();
    }
  }, [postId]);

  // ---------------------------------------------------------------------------
  // Handle Image Pick
  // ---------------------------------------------------------------------------

  const handleGifPress = () => {
    hapticLight();
    setShowGifPicker(true);
  };

  const handleGifSelect = (gif: GifAttachment) => {
    setGifAttachment(gif);
    setAttachedImages([]); // Mutual exclusivity: GIF clears images
  };

  const handleGifRemove = () => setGifAttachment(null);

  const handlePickImage = async () => {
    hapticLight();
    setGifAttachment(null); // Mutual exclusivity: images clear GIF
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setIsUploading(true);

        const response = await mediaApi.uploadMedia(
          asset.uri,
          asset.mimeType || 'image/jpeg',
          asset.fileName || 'comment-image.jpg',
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
      log.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  // ---------------------------------------------------------------------------
  // Submit Comment
  // ---------------------------------------------------------------------------

  const handleSubmitComment = async () => {
    hapticLight();
    if (!postId) return;

    // Get HTML from 10tap editor and convert to markdown
    const html = await commentEditor.getHTML();
    const markdown = htmlToMarkdown(html);
    if (!markdown.trim() && attachedImages.length === 0 && !gifAttachment) return;

    setIsSubmitting(true);

    try {
      // EDIT MODE
      if (editingComment) {
        const response = await commentsApi.updateComment(postId, editingComment.id, {
          comment: markdown,
          content_type: 'markdown',
        });

        if (response.success) {
          // Update local state
          setComments(prev => prev.map(c =>
            c.id === editingComment.id
              ? { ...c, message: markdown, message_rendered: html }
              : c
          ));
          commentEditor.setContent('');
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

      // GIF attachment via meta.media_preview
      const meta = gifAttachment ? {
        media_preview: {
          image: gifAttachment.image,
          type: 'image' as const,
          provider: 'inline', // Server converts to 'giphy'
          width: gifAttachment.width,
          height: gifAttachment.height,
        },
      } : undefined;

      log('Submitting comment:', {
        comment: markdown,
        parent_id: parentId,
        replyingToId: replyingTo?.id,
        replyingToParentId: replyingTo?.parent_id,
        hasImages: !!media_images,
        hasGif: !!gifAttachment,
      });

      const response = await commentsApi.createComment(postId, {
        comment: markdown,
        content_type: 'markdown',
        parent_id: parentId,
        media_images,
        meta,
      });

      if (response.success) {
        // Clear input
        commentEditor.setContent('');
        setAttachedImages([]);
        setGifAttachment(null);
        setReplyingTo(null);
        // Refresh comments
        fetchComments();
        cacheEvents.emit(CACHE_EVENTS.FEEDS);
      } else {
        throw new Error(response.error?.message || 'Failed to post comment');
      }
    } catch (err) {
      log.error('Submit error:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Reply to comment - FIXED: Always reply to top-level parent
  // ---------------------------------------------------------------------------

  const handleReply = (comment: Comment) => {
    hapticLight();
    // If this comment has a parent_id, it's already a reply
    // We should reply to the TOP-LEVEL comment, not nest deeper
    // Also pre-fill with @username mention
    setReplyingTo(comment);

    // Add @username mention to input
    const username = comment.xprofile?.username || comment.xprofile?.display_name || '';
    if (username) {
      commentEditor.setContent(`<p>@${username} </p>`);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
    commentEditor.setContent('');
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

  const handleCommentReaction = async (comment: Comment, reactionType: string = 'like') => {
    if (!postId) return;

    const hasReacted = !!(comment.has_user_react || comment.user_reaction_type);
    const currentType = comment.user_reaction_type || null;
    const isSameType = hasReacted && currentType === reactionType;
    const willRemove = isSameType;

    // Optimistic update
    setComments(prevComments =>
      prevComments.map(c => {
        if (c.id !== comment.id) return c;

        const currentCount = typeof c.reactions_count === 'string'
          ? parseInt(c.reactions_count, 10)
          : c.reactions_count || 0;

        if (willRemove) {
          return {
            ...c,
            has_user_react: false,
            user_reaction_type: null,
            user_reaction_icon_url: null,
            user_reaction_name: null,
            reactions_count: currentCount - 1,
            reaction_total: currentCount - 1,
          };
        } else {
          return {
            ...c,
            has_user_react: true,
            user_reaction_type: reactionType,
            user_reaction_icon_url: null,
            user_reaction_name: null,
            reactions_count: hasReacted ? currentCount : currentCount + 1,
            reaction_total: hasReacted ? currentCount : currentCount + 1,
          };
        }
      })
    );

    try {
      await commentsApi.reactToComment(postId, comment.id, willRemove, reactionType);
    } catch (err) {
      log.error('Reaction error:', err);
      // Revert on error
      setComments(prevComments =>
        prevComments.map(c => c.id === comment.id ? comment : c)
      );
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update reaction');
    }
  };

  // ---------------------------------------------------------------------------
  // Comment Menu Actions
  // ---------------------------------------------------------------------------

  const handleCommentMenu = (comment: Comment) => {
    hapticLight();
    const ref = menuButtonRefs.current[comment.id];
    if (ref) {
      (ref as any).measureInWindow?.((x: number, y: number, width: number, height: number) => {
        setMenuAnchor({ top: y + height + 4, right: windowWidth - x - width });
        setMenuComment(comment);
      });
    } else {
      setMenuComment(comment);
    }
  };

  const getCommentMenuItems = (): DropdownMenuItem[] => {
    if (!menuComment) return [];
    const isOwner = user?.id === Number(menuComment.user_id);
    const comment = menuComment;
    const isTopLevel = !comment.parent_id;
    const isPinned = Number(comment.is_sticky) === 1;

    const items: DropdownMenuItem[] = [
      { key: 'copy', label: 'Copy Link', icon: 'link-outline', onPress: () => { setMenuComment(null); handleCopyLink(comment); } },
    ];

    // Pin/unpin: only top-level comments, server enforces mod/admin permission
    if (isTopLevel) {
      items.push({
        key: 'pin',
        label: isPinned ? 'Unpin' : 'Pin Comment',
        icon: isPinned ? 'pin-outline' : 'pin',
        onPress: () => { setMenuComment(null); handlePinComment(comment); },
      });
    }

    if (isOwner) {
      items.push(
        { key: 'edit', label: 'Edit', icon: 'create-outline', onPress: () => { setMenuComment(null); handleEditComment(comment); } },
        { key: 'delete', label: 'Delete', icon: 'trash-outline', onPress: () => { setMenuComment(null); handleDeleteComment(comment); }, destructive: true },
      );
    }

    if (!isOwner) {
      items.push({ key: 'report', label: 'Report', icon: 'flag-outline', onPress: () => { setMenuComment(null); setReportComment(comment); }, destructive: true });
    }

    return items;
  };

  const handleCopyLink = async (comment: Comment) => {
    // Build URL like: https://site.com/portal/post/feed-slug?comment_id=123
    const slug = feedSlug || `feed-${postId}`;
    const url = `${SITE_URL}/portal/post/${slug}?comment_id=${comment.id}`;

    try {
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied!', 'Link copied to clipboard');
    } catch (err) {
      // If clipboard fails, show URL so user can manually copy
      log.error('Copy failed:', err);
      Alert.alert('Comment Link', url);
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingComment(comment);
    commentEditor.setContent(comment.message_rendered || comment.message);
    setReplyingTo(null);
  };

  const handleDeleteComment = (comment: Comment) => {
    hapticWarning();
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!postId) return;

            try {
              const response = await commentsApi.deleteComment(postId, comment.id);

              if (response.success) {
                // Remove from local state
                setComments(prev => prev.filter(c => c.id !== comment.id));
                cacheEvents.emit(CACHE_EVENTS.FEEDS);
              } else {
                Alert.alert('Error', response.error?.message || 'Failed to delete');
              }
            } catch (err) {
              log.error('Delete error:', err);
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  const cancelEdit = () => {
    setEditingComment(null);
    commentEditor.setContent('');
  };

  // ---------------------------------------------------------------------------
  // Pin/Unpin Comment (mod/admin — server enforces permission)
  // ---------------------------------------------------------------------------

  const handlePinComment = async (comment: Comment) => {
    if (!postId) return;
    const isPinned = Number(comment.is_sticky) === 1;

    try {
      const response = await commentsApi.pinComment(postId, comment.id, !isPinned);
      if (response.success) {
        fetchComments(); // Refresh to get updated sticky state
      } else {
        Alert.alert('Error', response.error?.message || 'Failed to update pin');
      }
    } catch (err) {
      log.error('Pin error:', err);
      Alert.alert('Error', 'Failed to update pin');
    }
  };

  // handleFormat removed — 10tap editor handles formatting via MarkdownToolbar

  // ---------------------------------------------------------------------------
  // Render comment item (delegated to memoized CommentItem)
  // ---------------------------------------------------------------------------

  const handleImagePress = React.useCallback((images: Array<{ url: string }>, index: number) => {
    setCommentMedia({ images, index });
  }, []);

  const renderComment = React.useCallback(({ item }: { item: Comment }) => (
    <CommentItem
      item={item}
      themeColors={themeColors}
      commentContentWidth={commentContentWidth}
      menuButtonRefs={menuButtonRefs}
      onMenu={handleCommentMenu}
      onReply={handleReply}
      onReaction={handleCommentReaction}
      onImagePress={handleImagePress}
      onLinkNavigate={onClose}
    />
  ), [themeColors, commentContentWidth, handleCommentMenu, handleReply, handleCommentReaction, handleImagePress, onClose]);

  // ---------------------------------------------------------------------------
  // Can Submit
  // ---------------------------------------------------------------------------

  const canSubmit = !isSubmitting && !isUploading;

  // ---------------------------------------------------------------------------
  // Safe area insets (for footer bottom spacing)
  // ---------------------------------------------------------------------------

  const insets = useSafeAreaInsets();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <KeyboardAvoidingView behavior="padding" style={styles.modalContainer}>
      <SafeAreaView style={[styles.modalContainer, { backgroundColor: themeColors.surface }]} edges={['top']}>
          {/* Header */}
          <PageHeader left={<HeaderIconButton icon="close" onPress={onClose} />} center={<HeaderTitle>Comments</HeaderTitle>} />

          {/* Comments list */}
          <View style={[styles.contentArea, { backgroundColor: themeColors.background }]}>
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={themeColors.primary} />
              </View>
            ) : error ? (
              <View style={styles.centered}>
                <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
                <Button title="Try Again" onPress={fetchComments} style={styles.retryButton} />
              </View>
            ) : comments.length === 0 && !stickyComment ? (
              <View style={styles.centered}>
                <Ionicons name="chatbubble-outline" size={48} color={themeColors.textTertiary} style={styles.emptyIcon} />
                <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Comments Yet</Text>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Be the first to comment!</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item: Comment) => item.id.toString()}
                renderItem={renderComment}
                ListHeaderComponent={stickyComment ? (
                  <View style={[styles.pinnedCommentContainer, { borderBottomColor: themeColors.border }]}>
                    <View style={styles.pinnedLabel}>
                      <Ionicons name="pin" size={12} color={themeColors.textTertiary} />
                      <Text style={[styles.pinnedLabelText, { color: themeColors.textTertiary }]}>Pinned</Text>
                    </View>
                    {renderComment({ item: stickyComment })}
                  </View>
                ) : null}
                contentContainerStyle={styles.commentsList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>

          {/* Editor section */}
          <View style={[styles.editorSection, { borderTopColor: themeColors.border, backgroundColor: themeColors.surface }]}>
            {/* Reply indicator */}
            {replyingTo && !editingComment && (
              <View style={[styles.replyIndicator, { backgroundColor: withOpacity(themeColors.primary, 0.12) }]}>
                <Text style={[styles.replyText, { color: themeColors.textSecondary }]}>
                  Replying to <Text style={[styles.replyName, { color: themeColors.primary }]}>@{replyingTo.xprofile?.username || replyingTo.xprofile?.display_name}</Text>
                </Text>
                <Pressable onPress={cancelReply}>
                  <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
                </Pressable>
              </View>
            )}

            {/* Edit indicator */}
            {editingComment && (
              <View style={[styles.replyIndicator, styles.editIndicator, { backgroundColor: withOpacity(themeColors.warning, 0.12) }]}>
                <Text style={[styles.replyText, { color: themeColors.textSecondary }]}>
                  Editing comment
                </Text>
                <Pressable onPress={cancelEdit}>
                  <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
                </Pressable>
              </View>
            )}

            {/* GIF Preview */}
            {gifAttachment && (
              <View style={styles.attachedImagesContainer}>
                <View style={styles.attachedImageWrapper}>
                  <Image source={{ uri: gifAttachment.previewUrl }} style={styles.attachedImage} contentFit="cover" />
                  <Pressable
                    style={styles.removeImageButton}
                    onPress={handleGifRemove}
                  >
                    <Ionicons name="close-circle" size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Attached Images Preview */}
            {attachedImages.length > 0 && (
              <View style={styles.attachedImagesContainer}>
                {attachedImages.map((img, idx) => (
                  <View key={idx} style={styles.attachedImageWrapper}>
                    <Image source={{ uri: img.url }} style={styles.attachedImage} contentFit="cover" />
                    <Pressable
                      style={styles.removeImageButton}
                      onPress={() => removeImage(idx)}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {isUploading && (
                  <View style={[styles.uploadingIndicator, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                    <ActivityIndicator size="small" color={themeColors.primary} />
                  </View>
                )}
              </View>
            )}

            {/* Rich text editor */}
            <View style={[styles.commentEditorWrapper, { backgroundColor: themeColors.surface }]}>
              <RichText
                editor={commentEditor}
                style={[styles.commentRichText, { backgroundColor: themeColors.surface }]}
              />
            </View>

            {/* Markdown Formatting Toolbar */}
            <MarkdownToolbar editor={commentEditor} compact />

            {/* Action bar — image picker + GIF picker + send button */}
            <View style={[styles.inputContainer, { borderTopColor: themeColors.border }]}>
              <Pressable
                style={styles.imageButton}
                onPress={handlePickImage}
                disabled={isUploading || attachedImages.length >= 4 || !!gifAttachment}
              >
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={(attachedImages.length >= 4 || gifAttachment) ? themeColors.textTertiary : themeColors.primary}
                />
              </Pressable>

              <Pressable
                style={styles.imageButton}
                onPress={handleGifPress}
                disabled={!!gifAttachment}
              >
                <Text style={{
                  fontSize: typography.size.sm,
                  fontWeight: typography.weight.bold,
                  color: gifAttachment ? themeColors.primary : themeColors.textSecondary,
                }}>GIF</Text>
              </Pressable>

              <View style={{ flex: 1 }} />

              <AnimatedPressable
                style={[styles.sendButton, { backgroundColor: themeColors.primary }, !canSubmit && [styles.sendButtonDisabled, { backgroundColor: themeColors.textTertiary }]]}
                onPress={handleSubmitComment}
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={themeColors.textInverse} />
                ) : (
                  <Ionicons name={editingComment ? "checkmark" : "send"} size={20} color={themeColors.textInverse} />
                )}
              </AnimatedPressable>
            </View>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
      <View style={{ height: insets.bottom, backgroundColor: themeColors.surface }} />

      {/* Comment Options Menu */}
      <DropdownMenu
        visible={!!menuComment}
        onClose={() => setMenuComment(null)}
        items={getCommentMenuItems()}
        anchor={menuAnchor}
      />

      {/* Report Comment Modal */}
      <ReportModal
        visible={!!reportComment}
        onClose={() => setReportComment(null)}
        contentType="comment"
        postId={postId || 0}
        parentId={reportComment?.id}
        userId={Number(reportComment?.user_id || 0)}
      />

      {/* GIF Picker Modal */}
      <GifPickerModal
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
      />

      {/* Comment Image Viewer */}
      <MediaViewer
        visible={!!commentMedia}
        images={commentMedia?.images ?? []}
        initialIndex={commentMedia?.index ?? 0}
        onClose={() => setCommentMedia(null)}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },

  editorSection: {
    borderTopWidth: 1,
  },

  contentArea: {
    flex: 1,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  errorText: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    marginTop: spacing.md,
  },

  emptyIcon: {
    marginBottom: spacing.md,
  },

  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },

  emptyText: {
    fontSize: typography.size.md,
  },

  commentsList: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },

  pinnedCommentContainer: {
    borderBottomWidth: 1,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
  },

  pinnedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },

  pinnedLabelText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },

  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  replyText: {
    fontSize: typography.size.sm,
  },

  replyName: {
    fontWeight: typography.weight.semibold,
  },

  editIndicator: {
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
    borderRadius: sizing.borderRadius.sm,
  },

  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: sizing.borderRadius.full,
  },

  uploadingIndicator: {
    width: 60,
    height: 60,
    borderRadius: sizing.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },

  imageButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    justifyContent: 'center',
    alignItems: 'center',
  },

  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.lg,
    fontSize: typography.size.md,
  },

  commentEditorWrapper: {
    height: 120,
  },

  commentRichText: {
    flex: 1,
  },

  sendButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    borderRadius: sizing.iconButton / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {
  },
});

export default CommentSheet;
