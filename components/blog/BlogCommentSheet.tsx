// =============================================================================
// BLOG COMMENT SHEET - Comments panel for WordPress blog posts
// =============================================================================
// Simplified version of CommentSheet.tsx adapted for WP comments API.
// No reactions, no image attachments, no edit/delete, no mentions.
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { SITE_URL } from '@/constants/config';
import { WPComment } from '@/types/blog';
import { blogApi } from '@/services/api/blog';
import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  PlaceholderBridge,
} from '@10play/tentap-editor';
import { htmlToMarkdown } from '@/utils/htmlToMarkdown';
import { BottomSheet, BottomSheetFlatList, BottomSheetFooter } from '@/components/common/BottomSheet';
import type { BottomSheetFooterProps } from '@/components/common/BottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { formatRelativeTime } from '@/utils/formatDate';
import { HtmlContent } from '@/components/common/HtmlContent';
import { hapticLight, hapticWarning } from '@/utils/haptics';
import { MarkdownToolbar } from '@/components/composer/MarkdownToolbar';

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
  const { user } = useAuth();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  // Comment content width: window - list padding(16*2) - avatar(32) - avatar margin(12)
  const commentContentWidth = windowWidth - spacing.lg * 2 - sizing.avatar.sm - spacing.md;

  const [comments, setComments] = useState<WPComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<WPComment | null>(null);

  // Edit mode state
  const [editingComment, setEditingComment] = useState<WPComment | null>(null);
  // Menu state
  const [menuComment, setMenuComment] = useState<WPComment | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | undefined>();
  const menuButtonRefs = useRef<Record<number, View | null>>({});

  // ---------------------------------------------------------------------------
  // 10tap Editor Bridge for comment input
  // ---------------------------------------------------------------------------

  const commentEditor = useEditorBridge({
    initialContent: '',
    autofocus: false,
    avoidIosKeyboard: false, // gorhom bottom sheet handles keyboard
    bridgeExtensions: [
      ...TenTapStartKit,
      PlaceholderBridge.configureExtension({
        placeholder: 'Write a comment...',
      }),
    ],
  });

  // Inject theme CSS into the comment editor WebView
  useEffect(() => {
    if (!commentEditor) return;
    commentEditor.injectCSS(`
      body {
        color: ${themeColors.text};
        background: transparent;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 15px;
        line-height: 1.4;
        padding: 0 12px;
        margin: 0;
      }
      h2 { font-size: 18px; font-weight: 600; margin: 8px 0; }
      h3 { font-size: 16px; font-weight: 600; margin: 6px 0; }
      h4 { font-size: 15px; font-weight: 600; margin: 6px 0; }
      p { margin: 4px 0; }
      a { color: ${themeColors.primary}; text-decoration: underline; }
      blockquote {
        border-left: 3px solid ${themeColors.primary};
        padding-left: 10px;
        margin: 6px 0;
        color: ${themeColors.textSecondary};
        font-style: italic;
      }
      ul, ol { padding-left: 20px; margin: 4px 0; }
      li { margin: 2px 0; }
      code {
        background: ${themeColors.backgroundSecondary};
        padding: 1px 3px;
        border-radius: 3px;
        font-size: 13px;
      }
      pre {
        background: ${themeColors.backgroundSecondary};
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
      }
      pre code { background: none; padding: 0; }
      hr { border: none; border-top: 1px solid ${themeColors.border}; margin: 8px 0; }
      strong { font-weight: 700; }
      del, s { text-decoration: line-through; }
      .ProseMirror-focused { outline: none; }
      .is-editor-empty:first-child::before {
        color: ${themeColors.textTertiary};
        font-style: normal;
      }
    `, 'theme');
  }, [commentEditor, themeColors]);

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
      commentEditor.setContent('');
      setReplyingTo(null);
      setError(null);
    }
  }, [visible, postId]);

  // ---------------------------------------------------------------------------
  // Submit Comment
  // ---------------------------------------------------------------------------

  const handleSubmitComment = async () => {
    hapticLight();
    if (!postId) return;

    // Get content from 10tap editor and convert to markdown
    const html = await commentEditor.getHTML();
    const markdown = htmlToMarkdown(html);
    if (!markdown.trim()) return;

    setIsSubmitting(true);

    try {
      // EDIT MODE
      if (editingComment) {
        const response = await blogApi.updateBlogComment(editingComment.id, markdown);

        if (response.success) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === editingComment.id
                ? { ...c, content: { ...c.content, rendered: html } }
                : c
            )
          );
          commentEditor.setContent('');
          setEditingComment(null);
        } else {
          throw new Error(response.error?.message || 'Failed to update comment');
        }
        return;
      }

      // CREATE MODE
      const response = await blogApi.createBlogComment({
        post: postId,
        content: markdown,
        parent: replyingTo ? getReplyParentId() : 0,
      });

      if (response.success) {
        commentEditor.setContent('');
        setReplyingTo(null);
        fetchComments();
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
    hapticLight();
    setReplyingTo(comment);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    commentEditor.setContent('');
  };

  const cancelEdit = () => {
    setEditingComment(null);
    commentEditor.setContent('');
  };

  // Always reply to the top-level parent (same as FC CommentSheet)
  const getReplyParentId = (): number => {
    if (!replyingTo) return 0;
    return replyingTo.parent > 0 ? replyingTo.parent : replyingTo.id;
  };

  // ---------------------------------------------------------------------------
  // Navigate to Author Profile
  // ---------------------------------------------------------------------------

  const handleAuthorPress = async (comment: WPComment) => {
    if (comment.author === 0) return; // Guest comment
    // Use server-embedded slug (instant)
    const slug = comment.fcom_author_slug;
    if (slug) {
      onClose();
      router.push(`/profile/${slug}`);
      return;
    }
    // Fallback for old comments without embedded slug
    const fetchedSlug = await blogApi.getWpUserSlug(comment.author);
    if (fetchedSlug) {
      onClose();
      router.push(`/profile/${fetchedSlug}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Comment Menu Actions
  // ---------------------------------------------------------------------------

  const handleCommentMenu = (comment: WPComment) => {
    hapticLight();
    const ref = menuButtonRefs.current[comment.id];
    if (ref) {
      (ref as any).measureInWindow?.((x: number, y: number, width: number, height: number) => {
        const screenWidth = Dimensions.get('window').width;
        setMenuAnchor({ top: y + height + 4, right: screenWidth - x - width });
        setMenuComment(comment);
      });
    } else {
      setMenuComment(comment);
    }
  };

  const getCommentMenuItems = (): DropdownMenuItem[] => {
    if (!menuComment) return [];
    const isOwner = Number(user?.id) === menuComment.author;
    const comment = menuComment;

    const items: DropdownMenuItem[] = [
      { key: 'copy', label: 'Copy Link', icon: 'link-outline', onPress: () => { setMenuComment(null); handleCopyLink(comment); } },
    ];

    if (isOwner) {
      items.push(
        { key: 'edit', label: 'Edit', icon: 'create-outline', onPress: () => { setMenuComment(null); handleEditComment(comment); } },
        { key: 'delete', label: 'Delete', icon: 'trash-outline', onPress: () => { setMenuComment(null); handleDeleteComment(comment); }, destructive: true },
      );
    }

    return items;
  };

  const handleCopyLink = async (comment: WPComment) => {
    hapticLight();
    const url = comment.link || `${SITE_URL}/?p=${comment.post}#comment-${comment.id}`;
    try {
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied!', 'Link copied to clipboard');
    } catch (err) {
      if (__DEV__) console.error('Copy failed:', err);
      Alert.alert('Comment Link', url);
    }
  };

  const handleEditComment = (comment: WPComment) => {
    setEditingComment(comment);
    commentEditor.setContent(comment.content.rendered);
    setReplyingTo(null);
  };

  const handleDeleteComment = (comment: WPComment) => {
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
            try {
              const response = await blogApi.deleteBlogComment(comment.id);
              if (response.success) {
                setComments((prev) => prev.filter((c) => c.id !== comment.id));
              } else {
                Alert.alert('Error', response.error?.message || 'Failed to delete');
              }
            } catch (err) {
              if (__DEV__) console.error('Delete error:', err);
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Render Comment Item
  // ---------------------------------------------------------------------------

  const renderComment = ({ item }: { item: WPComment }) => {
    const isReply = item.parent > 0;
    const avatarUrl = item.fcom_author_avatar || item.author_avatar_urls?.['96'] || item.author_avatar_urls?.['48'] || null;
    const displayName = item.author_name;
    const isVerified = item.fcom_author_is_verified === 1;

    return (
      <View style={[styles.commentItem, isReply && [styles.commentReply, { borderLeftColor: themeColors.border }]]}>
        <TouchableOpacity onPress={() => handleAuthorPress(item)} disabled={item.author === 0}>
          <Avatar source={avatarUrl} size="sm" fallback={displayName} />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <TouchableOpacity
              style={styles.commentHeaderLeft}
              onPress={() => handleAuthorPress(item)}
              disabled={item.author === 0}
              activeOpacity={0.7}
            >
              <UserDisplayName
                name={displayName}
                verified={isVerified}
                badgeSlugs={item.fcom_author_badge_slugs}
                size="sm"
              />
            </TouchableOpacity>
            <TouchableOpacity
              ref={(el: any) => { menuButtonRefs.current[item.id] = el; }}
              style={styles.commentMenuButton}
              onPress={() => handleCommentMenu(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color={themeColors.textTertiary} />
            </TouchableOpacity>
          </View>
          <View style={styles.commentTextRow}>
            <View style={styles.commentTextContent}>
              <HtmlContent
                html={item.content.rendered || ''}
                contentWidth={commentContentWidth}
                onLinkNavigate={onClose}
              />
            </View>
            <Text style={[styles.commentTimeInline, { color: themeColors.textTertiary }]}>
              {formatRelativeTime(item.date)}
            </Text>
          </View>
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

  const canSubmit = !isSubmitting;

  // ---------------------------------------------------------------------------
  // Safe area insets (for footer bottom spacing)
  // ---------------------------------------------------------------------------

  const insets = useSafeAreaInsets();

  // ---------------------------------------------------------------------------
  // Footer — sticky input pinned to bottom via gorhom footerComponent
  // ---------------------------------------------------------------------------

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <View style={{ backgroundColor: themeColors.surface }}>
        {/* Reply indicator */}
        {replyingTo && !editingComment && (
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

        {/* Edit indicator */}
        {editingComment && (
          <View style={[styles.replyIndicator, { backgroundColor: themeColors.warning + '20' }]}>
            <Text style={[styles.replyIndicatorText, { color: themeColors.textSecondary }]}>
              Editing comment
            </Text>
            <TouchableOpacity onPress={cancelEdit}>
              <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Markdown Formatting Toolbar */}
        <MarkdownToolbar editor={commentEditor} compact />

        {/* Comment Input — 10tap RichText editor + send button */}
        <View style={[styles.inputContainer, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
          <View style={styles.commentEditorWrapper}>
            <RichText
              editor={commentEditor}
              style={styles.commentRichText}
              scrollEnabled={true}
              nestedScrollEnabled={true}
            />
          </View>
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
              <Ionicons name={editingComment ? "checkmark" : "send"} size={20} color={themeColors.textInverse} />
            )}
          </TouchableOpacity>
        </View>
        </View>
      </BottomSheetFooter>
    ),
    [replyingTo, editingComment, commentEditor, canSubmit,
     isSubmitting, themeColors, insets.bottom],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Comments"
      footerComponent={renderFooter}
    >
        {/* Scrollable content area — fills remaining space above input */}
        <View style={styles.contentArea}>
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
              <Ionicons name="chatbubble-outline" size={48} color={themeColors.textTertiary} style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Comments Yet</Text>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                Be the first to comment!
              </Text>
            </View>
          ) : (
            <BottomSheetFlatList
              data={comments}
              keyExtractor={(item: WPComment) => item.id.toString()}
              renderItem={renderComment}
              contentContainerStyle={styles.commentsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
    </BottomSheet>

    {/* Comment Options Menu */}
    <DropdownMenu
      visible={!!menuComment}
      onClose={() => setMenuComment(null)}
      items={getCommentMenuItems()}
      anchor={menuAnchor}
    />
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.md,
  },

  retryText: {
    fontWeight: '600',
  },

  emptyIcon: {
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
    paddingBottom: 160,
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

  commentTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  commentTextContent: {
    flex: 1,
  },

  commentTimeInline: {
    fontSize: typography.size.xs,
    marginLeft: spacing.sm,
    marginTop: 2,
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

  commentEditorWrapper: {
    flex: 1,
    minHeight: 40,
    maxHeight: 150,
    borderRadius: 12,
    overflow: 'hidden',
  },

  commentRichText: {
    flex: 1,
    minHeight: 40,
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
