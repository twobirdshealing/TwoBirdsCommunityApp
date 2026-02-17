// =============================================================================
// COMMENT SHEET - Slide-up comments panel with real input
// =============================================================================
// FIXED: Use 'comment' not 'message' for API
// FIXED: Add media_images support for image comments
// FIXED: Comment reactions use {state: 1} format
// FIXED: Swipe down on handle to close
// FIXED: Reply uses top-level parent_id with @mention
// FIXED: Mentions are now clickable and link to profiles
// FIXED: Reply button no longer has emoji (cleaner look)
// ADDED: 3-dot menu with Copy Link, Edit, Delete
// REFACTORED: Uses shared BottomSheet component
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { Comment } from '@/types';
import { ReactionType } from '@/types/feed';
import { commentsApi, mediaApi } from '@/services/api';
import { Avatar } from '@/components/common/Avatar';
import { ProfileBadge } from '@/components/common/ProfileBadge';
import { BottomSheet } from '@/components/common/BottomSheet';
import { ReactionPicker } from './ReactionPicker';
import { ReactionBreakdownModal } from './ReactionBreakdownModal';
import { ReactionIcon } from './ReactionIcon';
import { formatRelativeTime } from '@/utils/formatDate';
import { stripHtmlTags } from '@/utils/htmlToText';
import { useAuth } from '@/contexts/AuthContext';
import { useReactionConfig, useBadgeDefinitions } from '@/hooks';
import { updateBreakdownOptimistically } from '@/utils/reactionHelpers';
import { SITE_URL } from '@/constants/config';
import { REACTION_EMOJI } from '@/constants/reactions';

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
// Mention Parsing Helper
// -----------------------------------------------------------------------------

interface TextPart {
  type: 'text' | 'mention';
  content: string;
  username?: string;
  displayName?: string;
}

/**
 * Parse HTML to extract mentions and plain text
 * API returns: <a href="https://site.com/portal/u/username/">Display Name</a> some text
 * We need to make mentions clickable
 */
function parseCommentContent(html: string): TextPart[] {
  if (!html) return [];

  const parts: TextPart[] = [];

  // Regex to match profile links in format:
  // <a href="https://staging.twobirdschurch.com/portal/u/bluejay/">James Elrod</a>
  // Captures: username from URL, display name from link text
  const mentionRegex = /<a\s+href=["'](?:https?:\/\/[^\/]+)?\/portal\/u\/([^"'\/]+)\/?["'][^>]*>([^<]+)<\/a>/gi;

  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(html)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const textBefore = html.substring(lastIndex, match.index);
      const strippedText = stripHtmlTags(textBefore);
      if (strippedText) {
        parts.push({ type: 'text', content: strippedText });
      }
    }

    // Add the mention
    parts.push({
      type: 'mention',
      content: match[2], // Display name
      username: match[1], // Username from URL
      displayName: match[2],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < html.length) {
    const remainingText = html.substring(lastIndex);
    const strippedText = stripHtmlTags(remainingText);
    if (strippedText) {
      parts.push({ type: 'text', content: strippedText });
    }
  }

  // If no mentions found, just return stripped text
  if (parts.length === 0) {
    const stripped = stripHtmlTags(html);
    if (stripped) {
      parts.push({ type: 'text', content: stripped });
    }
  }

  return parts;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CommentSheet({ visible, feedId, feedSlug, onClose, onCommentAdded }: CommentSheetProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const { reactions, getReaction, display } = useReactionConfig();
  const { resolveBadges } = useBadgeDefinitions();
  const defaultReactionId = reactions[0]?.id || 'like';
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

  // Reaction picker state
  const [reactionPickerComment, setReactionPickerComment] = useState<Comment | null>(null);
  // Breakdown modal state
  const [breakdownComment, setBreakdownComment] = useState<Comment | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Comments
  // ---------------------------------------------------------------------------

  const fetchComments = async () => {
    if (!feedId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await commentsApi.getComments(feedId);

      if (!response.success) {
        setError(response.error?.message || 'Failed to load comments');
        return;
      }

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
    if (visible && feedId) {
      fetchComments();
    }
  }, [visible, feedId]);

  // ---------------------------------------------------------------------------
  // Handle Image Pick
  // ---------------------------------------------------------------------------

  const handlePickImage = async () => {
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
  // Submit Comment
  // ---------------------------------------------------------------------------

  const handleSubmitComment = async () => {
    if (!feedId) return;

    const trimmedText = commentText.trim();
    if (!trimmedText && attachedImages.length === 0) return;

    setIsSubmitting(true);

    try {
      // EDIT MODE
      if (editingComment) {
        const response = await commentsApi.updateComment(feedId, editingComment.id, {
          comment: trimmedText,
        });

        if (response.success) {
          // Update local state
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

  const handleCommentReaction = async (comment: Comment, reactionType: ReactionType = 'like') => {
    if (!feedId) return;

    // Derive hasReacted from user_reaction_type (has_user_react not always in API)
    const hasReacted = !!(comment.has_user_react || comment.user_reaction_type);
    const currentType = comment.user_reaction_type || null;
    const isSameType = hasReacted && currentType === reactionType;
    const willRemove = isSameType;
    const willSwap = hasReacted && !isSameType;
    const action = willRemove ? 'remove' : willSwap ? 'swap' : 'add';

    // Optimistic update (matches useFeedReactions pattern)
    setComments(prevComments =>
      prevComments.map(c => {
        if (c.id !== comment.id) return c;

        const currentCount = typeof c.reactions_count === 'string'
          ? parseInt(c.reactions_count, 10)
          : c.reactions_count || 0;
        const updatedBreakdown = updateBreakdownOptimistically(
          c.reaction_breakdown || [], reactionType, action,
          currentType as ReactionType | null, getReaction,
        );

        if (willRemove) {
          return {
            ...c,
            has_user_react: false,
            user_reaction_type: null,
            user_reaction_icon_url: null,
            user_reaction_name: null,
            reactions_count: currentCount - 1,
            reaction_total: currentCount - 1,
            reaction_breakdown: updatedBreakdown,
          };
        } else if (willSwap) {
          return {
            ...c,
            user_reaction_type: reactionType,
            user_reaction_icon_url: null,
            user_reaction_name: null,
            reaction_breakdown: updatedBreakdown,
          };
        } else {
          return {
            ...c,
            has_user_react: true,
            user_reaction_type: reactionType,
            user_reaction_icon_url: null,
            user_reaction_name: null,
            reactions_count: currentCount + 1,
            reaction_total: currentCount + 1,
            reaction_breakdown: updatedBreakdown,
          };
        }
      })
    );

    try {
      if (willSwap) {
        const { swapReactionType } = await import('@/services/api/feeds');
        await swapReactionType(comment.id, 'comment', reactionType);
      } else {
        await commentsApi.reactToComment(feedId, comment.id, willRemove, reactionType);
      }
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
  // Navigate to profile
  // ---------------------------------------------------------------------------

  const handleMentionPress = (username: string) => {
    onClose(); // Close comment sheet first
    router.push({
      pathname: '/profile/[username]',
      params: { username },
    });
  };

  // ---------------------------------------------------------------------------
  // Render comment text with clickable mentions
  // ---------------------------------------------------------------------------

  const renderCommentText = (html: string) => {
    const parts = parseCommentContent(html);

    if (parts.length === 0) {
      return null;
    }

    // If only one text part, render simple Text
    if (parts.length === 1 && parts[0].type === 'text') {
      return <Text style={[styles.commentText, { color: themeColors.text }]}>{parts[0].content}</Text>;
    }

    // Render with clickable mentions
    return (
      <Text style={[styles.commentText, { color: themeColors.text }]}>
        {parts.map((part, index) => {
          if (part.type === 'mention' && part.username) {
            return (
              <Text
                key={index}
                style={[styles.mentionText, { color: themeColors.primary }]}
                onPress={() => handleMentionPress(part.username!)}
              >
                {part.content}
                {/* Add space after mention for natural reading */}
                <Text style={[styles.commentText, { color: themeColors.text }]}> </Text>
              </Text>
            );
          }
          return <Text key={index}>{part.content}</Text>;
        })}
      </Text>
    );
  };

  // ---------------------------------------------------------------------------
  // Render comment item
  // ---------------------------------------------------------------------------

  const renderComment = ({ item }: { item: Comment }) => {
    const author = item.xprofile;
    const authorName = author?.display_name || 'Unknown';
    const authorAvatar = author?.avatar || null;
    const isVerified = author?.is_verified === 1;
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
      <View style={[styles.commentItem, isReply && [styles.commentReply, { borderLeftColor: themeColors.border }]]}>
        <Avatar
          source={authorAvatar}
          size="sm"
          verified={isVerified}
          fallback={authorName}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <View style={styles.commentHeaderLeft}>
              <Text style={[styles.commentAuthor, { color: themeColors.text }]}>{authorName}</Text>
              {resolveBadges(author?.meta?.badge_slug || []).map((badge) => (
                <ProfileBadge key={badge.slug} badge={badge} />
              ))}
              <Text style={[styles.commentTime, { color: themeColors.textTertiary }]}>{timestamp}</Text>
            </View>
            {/* 3-dot menu */}
            <TouchableOpacity
              style={styles.commentMenuButton}
              onPress={() => handleCommentMenu(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color={themeColors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Comment text with clickable mentions */}
          {renderCommentText(item.message_rendered || item.message)}

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

          {/* Comment actions - Multi-reaction support */}
          <View style={styles.commentActions}>
            <View style={styles.commentActionsLeft}>
              {(() => {
                const hasReacted = !!(item.has_user_react || item.user_reaction_type);
                const reactionType = item.user_reaction_type || defaultReactionId;
                const rConfig = getReaction(reactionType);
                const iconUrl = item.user_reaction_icon_url || rConfig?.icon_url || null;
                const emoji = rConfig?.emoji || REACTION_EMOJI[reactionType] || '👍';
                const reactionColor = rConfig?.color || themeColors.primary;

                return (
                  <TouchableOpacity
                    style={[
                      styles.commentReactionButton,
                      hasReacted && { backgroundColor: reactionColor + '15' },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const type = item.user_reaction_type || defaultReactionId;
                      handleCommentReaction(item, type);
                    }}
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setReactionPickerComment(item);
                    }}
                    delayLongPress={400}
                  >
                    <View style={{ opacity: hasReacted ? 1 : 0.4 }}>
                      <ReactionIcon iconUrl={iconUrl} emoji={emoji} size={35} />
                    </View>
                  </TouchableOpacity>
                );
              })()}
              <TouchableOpacity
                style={styles.commentAction}
                onPress={() => handleReply(item)}
              >
                <Text style={[styles.commentActionText, { color: themeColors.textSecondary }]}>Reply</Text>
              </TouchableOpacity>
            </View>
            {/* Right side: reaction breakdown summary */}
            {(() => {
              const breakdown = item.reaction_breakdown || [];
              const totalReactions = typeof item.reactions_count === 'string'
                ? parseInt(item.reactions_count, 10) : item.reactions_count || 0;
              if (breakdown.length === 0 || totalReactions === 0) return null;
              return (
                <TouchableOpacity
                  style={styles.commentBreakdown}
                  onPress={() => setBreakdownComment(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.commentEmojiStack}>
                    {breakdown.slice(0, display.count).map((bd, i) => (
                      <View
                        key={bd.type}
                        style={{ zIndex: 10 + i, marginLeft: i === 0 ? 0 : -3 }}
                      >
                        <ReactionIcon
                          iconUrl={bd.icon_url}
                          emoji={bd.emoji || REACTION_EMOJI[bd.type as ReactionType]}
                          size={22}
                          stroke={display.stroke}
                          borderColor={themeColors.borderLight}
                        />
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.commentActionText, { color: themeColors.textSecondary }]}>
                    {totalReactions}
                  </Text>
                </TouchableOpacity>
              );
            })()}
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
    <>
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
            <TouchableOpacity onPress={fetchComments} style={[styles.retryButton, { backgroundColor: themeColors.primary }]}>
              <Text style={[styles.retryText, { color: themeColors.textInverse }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Comments Yet</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Be the first to comment!</Text>
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
          <View style={[styles.replyIndicator, { backgroundColor: themeColors.primaryLight + '20' }]}>
            <Text style={[styles.replyText, { color: themeColors.textSecondary }]}>
              Replying to <Text style={[styles.replyName, { color: themeColors.primary }]}>@{replyingTo.xprofile?.username || replyingTo.xprofile?.display_name}</Text>
            </Text>
            <TouchableOpacity onPress={cancelReply}>
              <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Edit indicator */}
        {editingComment && (
          <View style={[styles.replyIndicator, styles.editIndicator, { backgroundColor: themeColors.warning + '20' }]}>
            <Text style={[styles.replyText, { color: themeColors.textSecondary }]}>
              Editing comment
            </Text>
            <TouchableOpacity onPress={cancelEdit}>
              <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
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
              <View style={[styles.uploadingIndicator, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                <ActivityIndicator size="small" color={themeColors.primary} />
              </View>
            )}
          </View>
        )}

        {/* Comment Input */}
        <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
          {/* Image picker button */}
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handlePickImage}
            disabled={isUploading || attachedImages.length >= 4}
          >
            <Ionicons
              name="image-outline"
              size={24}
              color={attachedImages.length >= 4 ? themeColors.textTertiary : themeColors.primary}
            />
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            style={[styles.textInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
            placeholder={replyingTo ? 'Write your reply...' : 'Write a comment...'}
            placeholderTextColor={themeColors.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={2000}
          />

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: themeColors.primary }, !canSubmit && [styles.sendButtonDisabled, { backgroundColor: themeColors.textTertiary }]]}
            onPress={handleSubmitComment}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={themeColors.textInverse} />
            ) : (
              <Ionicons name={editingComment ? "checkmark" : "send"} size={20} color={themeColors.textInverse} />
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Reaction Picker for comments */}
      <ReactionPicker
        visible={!!reactionPickerComment}
        onSelect={(type) => {
          if (reactionPickerComment) {
            handleCommentReaction(reactionPickerComment, type);
          }
        }}
        onClose={() => setReactionPickerComment(null)}
        currentType={reactionPickerComment?.user_reaction_type || null}
      />

      {/* Reaction Breakdown Modal for comments */}
      <ReactionBreakdownModal
        visible={!!breakdownComment}
        onClose={() => setBreakdownComment(null)}
        objectType="comment"
        objectId={breakdownComment?.id || 0}
      />
    </>
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
    marginRight: spacing.sm,
  },

  commentTime: {
    fontSize: typography.size.xs,
  },

  commentText: {
    fontSize: typography.size.md,
    lineHeight: 20,
  },

  mentionText: {
    fontWeight: '600',
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  commentActionsLeft: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },

  commentAction: {
    paddingVertical: spacing.xs,
  },

  commentReactionButton: {
    padding: spacing.xs,
    borderRadius: sizing.borderRadius.md,
  },

  commentActionText: {
    fontSize: typography.size.sm,
  },

  commentActionActive: {
    fontWeight: '600',
  },

  commentBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  commentEmojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
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

  sendButtonDisabled: {
  },
});

export default CommentSheet;
