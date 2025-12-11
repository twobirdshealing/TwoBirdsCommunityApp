// =============================================================================
// PROFILE SCREEN - User profile with tabs
// =============================================================================
// Matches native Fluent Community profile layout:
// - Cover photo + avatar
// - Display name, username, bio
// - Following/Followers stats
// - Tabs: About, Posts, Spaces, Comments
// - Settings gear (own profile) with logout
// =============================================================================

import { ErrorMessage, LoadingSpinner } from '@/components/common';
import { FeedCard } from '@/components/feed';
import {
  AboutTab,
  ProfileHeader,
  ProfileTab,
  ProfileTabs,
  SettingsModal,
} from '@/components/profile';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { feedsApi, profilesApi } from '@/services/api';
import { Feed, Profile } from '@/types';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Types - Based on actual API response from /profile/{username}/comments
// -----------------------------------------------------------------------------

interface ProfileComment {
  id: number;
  user_id: string;
  post_id: string;
  parent_id: string | null;
  reactions_count: string;
  message: string;
  message_rendered: string;
  meta: {
    media_preview?: {
      media_id: number | null;
      type: string;
      width: number;
      height: number;
      provider: string;
      image: string;
    };
  };
  type: string;
  content_type: string;
  status: string;
  is_sticky: string;
  created_at: string;
  updated_at: string;
  post: {
    id: number;
    title: string;
    message: string;
    type: string;
    space_id: string | null;
    slug: string;
    created_at: string;
    permalink: string;
    space: {
      id: number;
      title: string;
      slug: string;
      type: string;
    } | null;
  };
}

// -----------------------------------------------------------------------------
// Helper Functions - Match native Vue app (from app.js analysis)
// -----------------------------------------------------------------------------

// Strip HTML tags from message_rendered
function stripHtml(html: string): string {
  return html?.replace(/<[^>]*>/g, '') || '';
}

// Get post excerpt like native app's getPostExcerpt method
function getPostExcerpt(post: ProfileComment['post'], maxLength: number = 50): string {
  if (!post) return '';
  
  let excerpt = '';
  if (post.title) {
    excerpt = post.title;
  } else {
    excerpt = stripHtml(post.message).substring(0, maxLength);
    if (stripHtml(post.message).length > maxLength) {
      excerpt += '...';
    }
  }
  
  // Add type indicator like native app (except for "text")
  const type = post.type;
  if (type && type !== 'text') {
    excerpt += ` (${type})`;
  }
  
  return excerpt;
}

// Format relative time like native app's humanDateDiff
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  
  return date.toLocaleDateString();
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Tabs
  const [activeTab, setActiveTab] = useState<ProfileTab>('about');
  
  // Tab content - ALWAYS initialize as empty arrays
  const [posts, setPosts] = useState<Feed[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsPagination, setCommentsPagination] = useState({
    page: 1,
    total: 0,
    lastPage: 1,
  });
  
  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch Profile
  // ---------------------------------------------------------------------------

  const fetchProfile = useCallback(async (isRefresh = false) => {
    if (!user?.username) {
      setError('Not logged in');
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }

      const response = await profilesApi.getProfile(user.username);

      if (response.success) {
        setProfile(response.data.profile);
      } else {
        setError(response.error?.message || 'Failed to load profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.username]);

  // Initial load
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ---------------------------------------------------------------------------
  // Tab Content Fetchers
  // ---------------------------------------------------------------------------

  const fetchPosts = useCallback(async () => {
    if (!profile?.user_id) return;
    
    setPostsLoading(true);
    try {
      const response = await feedsApi.getFeeds({ user_id: profile.user_id });
      if (response.success && response.data?.feeds?.data) {
        setPosts(response.data.feeds.data);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [profile?.user_id]);

  const fetchSpaces = useCallback(async () => {
    if (!user?.username) return;
    
    setSpacesLoading(true);
    try {
      const response = await profilesApi.getUserSpaces(user.username);
      if (response.success && response.data?.spaces) {
        setSpaces(response.data.spaces);
      } else {
        setSpaces([]);
      }
    } catch (err) {
      console.error('Failed to fetch spaces:', err);
      setSpaces([]);
    } finally {
      setSpacesLoading(false);
    }
  }, [user?.username]);

  // Fetch comments - matches native Vue implementation
  // Native: this.$get("profile/"+this.username+"/comments", {page, per_page})
  // Response: { comments: { data: [...], total: N }, xprofile: {...} }
  const fetchComments = useCallback(async (page: number = 1) => {
    if (!user?.username) return;
    
    setCommentsLoading(true);
    try {
      const response = await profilesApi.getUserComments(user.username, page, 10);
      
      // API returns: { comments: { data: [...], total: N, ... }, xprofile: {...} }
      // Native Vue: this.comments = e.comments.data
      if (response.success && response.data?.comments?.data) {
        setComments(response.data.comments.data);
        setCommentsPagination({
          page: response.data.comments.current_page || 1,
          total: response.data.comments.total || 0,
          lastPage: response.data.comments.last_page || 1,
        });
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [user?.username]);

  // Load tab content when tab changes
  useEffect(() => {
    if (!profile) return;
    
    switch (activeTab) {
      case 'posts':
        if (posts.length === 0 && !postsLoading) fetchPosts();
        break;
      case 'spaces':
        if (spaces.length === 0 && !spacesLoading) fetchSpaces();
        break;
      case 'comments':
        if (comments.length === 0 && !commentsLoading) fetchComments();
        break;
    }
  }, [activeTab, profile, posts.length, spaces.length, comments.length, postsLoading, spacesLoading, commentsLoading, fetchPosts, fetchSpaces, fetchComments]);

  // ---------------------------------------------------------------------------
  // Render States
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <LoadingSpinner message="Loading profile..." />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ErrorMessage
          message={error || 'Profile not found'}
          onRetry={() => fetchProfile(true)}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render Comment Card - Matches native Vue implementation
  // Native uses: .fcom_course_comment.each_comment structure
  // ---------------------------------------------------------------------------

  const renderCommentCard = (comment: ProfileComment) => {
    const hasMedia = comment.meta?.media_preview?.image;
    const commentText = stripHtml(comment.message_rendered);
    const postExcerpt = getPostExcerpt(comment.post);
    const timeAgo = formatTimeAgo(comment.created_at);
    const reactionsCount = parseInt(comment.reactions_count) || 0;
    
    return (
      <View key={comment.id} style={styles.commentCard}>
        {/* Timeline dot indicator - matches native .comment_icon */}
        <View style={styles.commentTimelineIndicator}>
          <View style={styles.commentTimelineDot} />
        </View>
        
        {/* Comment content */}
        <View style={styles.commentContent}>
          {/* Header: time - matches native .comment_text_head_time */}
          <View style={styles.commentHeader}>
            <Text style={styles.commentTime}>
              {timeAgo}
            </Text>
          </View>
          
          {/* Link to parent post - matches native .comment_text_head_post */}
          <TouchableOpacity style={styles.postLink}>
            <Text style={styles.postLinkText} numberOfLines={1}>
              {postExcerpt}
            </Text>
          </TouchableOpacity>
          
          {/* Comment body - matches native .comment_text */}
          <View style={styles.commentBody}>
            {/* Text content - uses message_rendered */}
            {commentText ? (
              <Text style={styles.commentText}>{commentText}</Text>
            ) : null}
            
            {/* Media preview if present - matches native media_only_content */}
            {hasMedia && (
              <View style={styles.mediaPreview}>
                <Image
                  source={{ uri: comment.meta.media_preview!.image }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
              </View>
            )}
            
            {/* Reactions count - matches native reactions display */}
            {reactionsCount > 0 && (
              <View style={styles.reactionsRow}>
                <Text style={styles.reactionsText}>
                  ❤️ {reactionsCount}
                </Text>
              </View>
            )}
          </View>
          
          {/* Space indicator if comment was in a space */}
          {comment.post?.space && (
            <View style={styles.spaceIndicator}>
              <Text style={styles.spaceIndicatorText}>
                in {comment.post.space.title}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render Tab Content
  // ---------------------------------------------------------------------------

  const renderTabContent = () => {
    switch (activeTab) {
      case 'about':
        return <AboutTab profile={profile} />;

      case 'posts':
        if (postsLoading) {
          return (
            <View style={styles.tabLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          );
        }
        if (!posts || posts.length === 0) {
          return (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          );
        }
        return (
          <View style={styles.postsList}>
            {posts.map((post) => (
              <FeedCard
                key={post.id}
                feed={post}
                onPress={() => {}}
                onReact={() => {}}
                variant="compact"
              />
            ))}
          </View>
        );

      case 'spaces':
        if (spacesLoading) {
          return (
            <View style={styles.tabLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          );
        }
        if (!spaces || spaces.length === 0) {
          return (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyIcon}>🏠</Text>
              <Text style={styles.emptyText}>No spaces joined</Text>
            </View>
          );
        }
        return (
          <View style={styles.spacesList}>
            {spaces.map((space) => (
              <View key={space.id} style={styles.spaceItem}>
                <Text style={styles.spaceTitle}>{space.title}</Text>
              </View>
            ))}
          </View>
        );

      case 'comments':
        if (commentsLoading) {
          return (
            <View style={styles.tabLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          );
        }
        
        // Empty state - matches native Vue: "$t('%s did not add any comment...')"
        if (!Array.isArray(comments) || comments.length === 0) {
          return (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>
                {profile.display_name} did not add any comment to any posts yet
              </Text>
            </View>
          );
        }
        
        // Comments list - matches native .course_comments.user_comments
        return (
          <View style={styles.commentsContainer}>
            {comments.map(renderCommentCard)}
            
            {/* Pagination indicator */}
            {commentsPagination.total > 10 && (
              <View style={styles.paginationInfo}>
                <Text style={styles.paginationText}>
                  Showing {comments.length} of {commentsPagination.total} comments
                </Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchProfile(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Profile Header */}
        <ProfileHeader
          profile={profile}
          isOwnProfile={true}
          onSettingsPress={() => setShowSettings(true)}
        />

        {/* Tabs */}
        <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        userName={profile.display_name}
        userEmail={profile.email}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles - Match native Fluent Community CSS from app.js
// Based on: .course_comments.user_comments, .each_comment, etc.
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
  },

  tabContent: {
    minHeight: 300,
  },

  tabLoading: {
    padding: spacing.xxl,
    alignItems: 'center',
  },

  emptyTab: {
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
    textAlign: 'center',
  },

  postsList: {
    padding: spacing.sm,
  },

  spacesList: {
    padding: spacing.lg,
  },

  spaceItem: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },

  spaceTitle: {
    fontSize: typography.size.md,
    color: colors.text,
    fontWeight: '500',
  },

  // Comments container - matches native .course_comments.user_comments
  commentsContainer: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: 8,
    margin: spacing.sm,
  },

  // Comment card - matches native .each_comment in user_comments context
  // Native CSS: display:flex, flex-direction:column, padding:12px 0, margin-left:32px
  commentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    marginLeft: 32,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },

  // Timeline indicator - matches native .comment_icon
  // Native: left:-32px, position:absolute, top:46px, width:18px, height:18px
  commentTimelineIndicator: {
    position: 'absolute',
    left: -32,
    top: 46,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  // Native: width:6px, height:6px, border-radius:50%
  commentTimelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },

  commentContent: {
    flex: 1,
  },

  // Header with time - matches native .comment_text_head
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  // Native: font-size:80%, color:var(--fcom-text-off)
  commentTime: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Post link - matches native .comment_text_head_post a.post_link
  // Native: font-size:15px, font-weight:500
  postLink: {
    marginBottom: 8,
  },

  postLinkText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },

  // Comment body - matches native .comment_text
  // Native: background:var(--fcom-secondary-content-bg), padding:8px 12px, border-radius:10px
  commentBody: {
    backgroundColor: colors.background,
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },

  // Native: font-size:14px, color:var(--fcom-secondary-text)
  commentText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Media preview - matches native .media_only_content
  mediaPreview: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },

  mediaImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },

  // Reactions display
  reactionsRow: {
    marginTop: 8,
    flexDirection: 'row',
  },

  reactionsText: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Space indicator
  spaceIndicator: {
    marginTop: 8,
  },

  spaceIndicatorText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

  // Pagination
  paginationInfo: {
    marginTop: spacing.md,
    alignItems: 'center',
  },

  paginationText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});