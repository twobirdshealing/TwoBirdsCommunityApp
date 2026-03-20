// =============================================================================
// USER PROFILE SCREEN - Unified profile view with tabs
// =============================================================================
// Route: /profile/[username]
// Works for viewing your OWN profile and OTHER users' profiles
// Tabs: About (always), Posts, Spaces, Comments (configurable via server features)
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createLogger } from '@/utils/logger';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/AppConfigContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppQuery } from '@/hooks/useAppQuery';
import { CACHE_EVENTS } from '@/utils/cacheEvents';
import { useFeedActions } from '@/hooks/useFeedActions';
import { useFeedReactions } from '@/hooks/useFeedReactions';
import { profilesApi, patchProfileMedia } from '@/services/api/profiles';
import { commentsApi } from '@/services/api/comments';
import { showAvatarPicker, showCoverPicker } from '@/utils/avatarPicker';
import { hapticLight } from '@/utils/haptics';
import { Profile, ProfileComment } from '@/types/user';
import { Feed } from '@/types/feed';
import { Space } from '@/types/space';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';

import { FeedList } from '@/components/feed/FeedList';
import { SpaceCard } from '@/components/space/SpaceCard';
import { AboutTab } from '@/components/profile/AboutTab';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { TabBar } from '@/components/common/TabBar';
import { CommentCard } from '@/components/profile/CommentCard';
import { PageHeader } from '@/components/navigation/PageHeader';

const log = createLogger('Profile');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ProfileTabKey = 'about' | 'posts' | 'spaces' | 'comments';

interface TabState<T> {
  data: T[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  loaded: boolean;
}

const INITIAL_TAB_STATE = <T,>(): TabState<T> => ({
  data: [],
  page: 1,
  hasMore: true,
  loading: false,
  refreshing: false,
  error: null,
  loaded: false,
});

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: currentUser, updateUser } = useAuth();
  const { colors: themeColors } = useTheme();
  const features = useFeatures();

  // Check if viewing own profile
  const isOwnProfile = currentUser?.username === username;

  // Active tab
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('about');

  // Fetch Profile (refreshOnFocus replaces useFocusEffect)
  const { data: profile, isLoading: loading, isRefreshing: refreshing, error: fetchError, refresh, mutate } = useAppQuery<Profile>({
    cacheKey: `tbc_profile_${username}`,
    invalidateOn: CACHE_EVENTS.PROFILE,
    fetcher: async () => {
      const response = await profilesApi.getProfile(username!);
      if (response.success && response.data.profile) {
        return response.data.profile;
      }
      throw new Error('Failed to load profile');
    },
    enabled: !!username,
  });
  const error = fetchError?.message || null;

  // Derived state from profile data
  const isFollowing = (profile?.follow || 0) > 0;
  const isEmailNotifyOn = profile?.follow === 2;
  const isBlocked = profile?.is_blocked_by_you === true;

  // ---------------------------------------------------------------------------
  // Tab visibility — intersection of server features + server profile_navs
  // ---------------------------------------------------------------------------

  const visibleTabs = useMemo(() => {
    const tabs: { key: ProfileTabKey; title: string }[] = [
      { key: 'about', title: 'About' },
    ];

    // If profile is restricted, only show About
    if (profile?.is_restricted) return tabs;

    const serverSlugs = profile?.profile_navs?.map(n => n.slug) || [];
    const hasServerNavs = serverSlugs.length > 0;

    if (features.profile_tabs.posts && (!hasServerNavs || serverSlugs.includes('user_profile_feeds'))) {
      tabs.push({ key: 'posts', title: 'Posts' });
    }
    if (features.profile_tabs.spaces && (!hasServerNavs || serverSlugs.includes('user_spaces'))) {
      tabs.push({ key: 'spaces', title: 'Spaces' });
    }
    if (features.profile_tabs.comments && (!hasServerNavs || serverSlugs.includes('user_comments'))) {
      tabs.push({ key: 'comments', title: 'Comments' });
    }

    return tabs;
  }, [profile?.profile_navs, profile?.is_restricted, features.profile_tabs]);

  // ---------------------------------------------------------------------------
  // Per-tab state (Posts, Spaces, Comments)
  // ---------------------------------------------------------------------------

  const [postsState, setPostsState] = useState<TabState<Feed>>(INITIAL_TAB_STATE<Feed>);
  const [spacesState, setSpacesState] = useState<TabState<Space>>(INITIAL_TAB_STATE<Space>);
  const [commentsState, setCommentsState] = useState<TabState<ProfileComment>>(INITIAL_TAB_STATE<ProfileComment>);

  // Reset tab data when viewing a different profile
  useEffect(() => {
    setPostsState(INITIAL_TAB_STATE<Feed>);
    setSpacesState(INITIAL_TAB_STATE<Space>);
    setCommentsState(INITIAL_TAB_STATE<ProfileComment>);
    setActiveTab('about');
  }, [username]);

  // ---------------------------------------------------------------------------
  // Tab data fetching
  // ---------------------------------------------------------------------------

  const fetchPosts = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!profile?.user_id) return;
    setPostsState(prev => ({ ...prev, loading: true, error: null, ...(page === 1 && !append && prev.loaded ? { refreshing: true } : {}) }));
    try {
      const response = await profilesApi.getUserFeeds(profile.user_id, page, 20);
      if (!response.success) throw new Error('Failed to load posts');
      const feeds = response.data.feeds?.data || [];
      const hasMore = response.data.feeds?.has_more ?? false;
      setPostsState(prev => ({
        ...prev,
        data: append ? [...prev.data, ...feeds] : feeds,
        page,
        hasMore,
        loading: false,
        refreshing: false,
        loaded: true,
        error: null,
      }));
    } catch (err) {
      setPostsState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'Failed to load posts',
      }));
    }
  }, [profile?.user_id]);

  const fetchSpaces = useCallback(async () => {
    if (!username) return;
    setSpacesState(prev => ({ ...prev, loading: true, error: null, ...(prev.loaded ? { refreshing: true } : {}) }));
    try {
      const response = await profilesApi.getUserSpaces(username);
      if (!response.success) throw new Error('Failed to load spaces');
      const spaces = response.data.spaces || [];
      setSpacesState({
        data: spaces,
        page: 1,
        hasMore: false,
        loading: false,
        refreshing: false,
        loaded: true,
        error: null,
      });
    } catch (err) {
      setSpacesState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'Failed to load spaces',
      }));
    }
  }, [username]);

  const fetchComments = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!username) return;
    setCommentsState(prev => ({ ...prev, loading: true, error: null, ...(page === 1 && !append && prev.loaded ? { refreshing: true } : {}) }));
    try {
      const response = await profilesApi.getUserComments(username, page, 10);
      if (!response.success) throw new Error('Failed to load comments');
      const comments = response.data.comments?.data || [];
      const currentPage = response.data.comments?.current_page ?? 1;
      const lastPage = response.data.comments?.last_page ?? 1;
      setCommentsState(prev => ({
        ...prev,
        data: append ? [...prev.data, ...comments] : comments,
        page: currentPage,
        hasMore: currentPage < lastPage,
        loading: false,
        refreshing: false,
        loaded: true,
        error: null,
      }));
    } catch (err) {
      setCommentsState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'Failed to load comments',
      }));
    }
  }, [username]);

  // Lazy-load tab data on first visit
  useEffect(() => {
    if (!profile || !username) return;
    if (activeTab === 'posts' && !postsState.loaded && !postsState.loading) {
      fetchPosts(1);
    } else if (activeTab === 'spaces' && !spacesState.loaded && !spacesState.loading) {
      fetchSpaces();
    } else if (activeTab === 'comments' && !commentsState.loaded && !commentsState.loading) {
      fetchComments(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps — fetch functions are stable (useCallback), omitted to prevent re-runs on state changes
  }, [activeTab, profile, username, postsState.loaded, postsState.loading, spacesState.loaded, spacesState.loading, commentsState.loaded, commentsState.loading]);

  // ---------------------------------------------------------------------------
  // Posts tab: feed actions + reactions (same pattern as activity.tsx)
  // ---------------------------------------------------------------------------

  const setPostsData: React.Dispatch<React.SetStateAction<Feed[]>> = useCallback(
    (action) => {
      setPostsState(prev => ({
        ...prev,
        data: typeof action === 'function' ? action(prev.data) : action,
      }));
    },
    [],
  );

  const {
    handleCommentPress,
    handleEdit,
    handleBookmarkToggle,
    handleDelete,
    handleAuthorPress,
    handleSpacePress,
  } = useFeedActions({ setFeeds: setPostsData, refresh: () => fetchPosts(1) });

  const handleReact = useFeedReactions(postsState.data, setPostsData);

  // ---------------------------------------------------------------------------
  // Avatar/cover upload state
  // ---------------------------------------------------------------------------

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Settings menu state (own profile only)
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Other-user menu state (block etc.)
  const [otherMenuVisible, setOtherMenuVisible] = useState(false);

  // Follow/Block loading (UI-only state)
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    refresh();
    // Also refresh current tab data
    if (activeTab === 'posts' && postsState.loaded) fetchPosts(1);
    else if (activeTab === 'spaces' && spacesState.loaded) fetchSpaces();
    else if (activeTab === 'comments' && commentsState.loaded) fetchComments(1);
  };

  const handleFollowPress = async () => {
    if (!username || followLoading || isOwnProfile) return;

    try {
      setFollowLoading(true);

      if (isFollowing) {
        await profilesApi.unfollowUser(username);
        mutate(prev => prev ? {
          ...prev,
          follow: 0,
          followers_count: Math.max(0, (prev.followers_count || 0) - 1),
        } : prev);
      } else {
        await profilesApi.followUser(username);
        mutate(prev => prev ? {
          ...prev,
          follow: 1,
          followers_count: (prev.followers_count || 0) + 1,
        } : prev);
      }
    } catch (err) {
      log.error('Follow action failed:', err);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleEmailNotifyToggle = async () => {
    if (!username || !isFollowing) return;
    hapticLight();
    const newLevel = isEmailNotifyOn ? 1 : 2;
    mutate(prev => prev ? { ...prev, follow: newLevel } : prev);
    try {
      await profilesApi.toggleFollowNotification(username);
    } catch (err) {
      log.error('Toggle email notification failed:', err);
      mutate(prev => prev ? { ...prev, follow: isEmailNotifyOn ? 2 : 1 } : prev);
    }
  };

  const handleBlockPress = () => {
    if (!username || blockLoading) return;

    const action = isBlocked ? 'Unblock' : 'Block';
    const message = isBlocked
      ? `Are you sure you want to unblock ${profile?.display_name || 'this user'}?`
      : `Blocking this user will hide their posts from your feed and prevent them from interacting with you.`;

    Alert.alert(`${action} User`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: isBlocked ? 'default' : 'destructive',
        onPress: async () => {
          try {
            setBlockLoading(true);

            if (isBlocked) {
              const result = await profilesApi.unblockUser(username);
              if (result.success) {
                mutate(prev => prev ? { ...prev, is_blocked_by_you: false } : prev);
              } else {
                Alert.alert('Error', 'Failed to unblock user');
              }
            } else {
              const result = await profilesApi.blockUser(username);
              if (result.success) {
                mutate(prev => prev ? { ...prev, is_blocked_by_you: true, follow: 0 } : prev);
              } else {
                Alert.alert('Error', 'Failed to block user');
              }
            }
          } catch (err) {
            log.error('Block action failed:', err);
            Alert.alert('Error', `Failed to ${action.toLowerCase()} user`);
          } finally {
            setBlockLoading(false);
          }
        },
      },
    ]);
  };

  const handleMessagePress = () => {
    if (!profile) return;
    router.push({
      pathname: '/messages/user/[userId]',
      params: {
        userId: String(profile.user_id),
        displayName: profile.display_name,
        avatar: profile.avatar || '',
      },
    } as any);
  };

  const handleEditProfilePress = () => {
    router.push('/profile/edit');
  };

  const handleCoverPhotoPress = () => {
    if (!isOwnProfile || !username) return;

    showCoverPicker({
      onUploadStart: (localUri) => {
        setCoverUploading(true);
        mutate(prev => prev ? { ...prev, cover_photo: localUri } : prev);
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { cover_photo: remoteUrl });
        } catch (e) {
          // Fall through — cover was uploaded, just assignment failed
        }
        setCoverUploading(false);
        mutate(prev => prev ? { ...prev, cover_photo: remoteUrl } : prev);
      },
      onError: (message) => {
        setCoverUploading(false);
        refresh();
        Alert.alert('Upload Failed', message);
      },
    });
  };

  const handleAvatarPress = () => {
    if (!isOwnProfile || !username) return;

    showAvatarPicker({
      onUploadStart: (localUri) => {
        setAvatarUploading(true);
        mutate(prev => prev ? { ...prev, avatar: localUri } : prev);
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { avatar: remoteUrl });
        } catch (e) {
          // Fall through — avatar was uploaded, just assignment failed
        }
        setAvatarUploading(false);
        mutate(prev => prev ? { ...prev, avatar: remoteUrl } : prev);
        await updateUser({ avatar: remoteUrl });
      },
      onError: (message) => {
        setAvatarUploading(false);
        refresh();
        Alert.alert('Upload Failed', message);
      },
    });
  };

  const handleFollowersPress = () => {
    router.push({
      pathname: '/profile/[username]/connections',
      params: { username, initialTab: 'followers' },
    });
  };

  const handleFollowingPress = () => {
    router.push({
      pathname: '/profile/[username]/connections',
      params: { username, initialTab: 'following' },
    });
  };

  const handleCommentPostPress = (postId: number, postSlug: string) => {
    router.push({
      pathname: '/comments/[postId]',
      params: { postId: String(postId), feedSlug: postSlug },
    });
  };

  const handleDeleteComment = (comment: ProfileComment) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const postId = typeof comment.post_id === 'string' ? parseInt(comment.post_id, 10) : comment.post_id;
            const response = await commentsApi.deleteComment(postId, comment.id);
            if (response.success) {
              setCommentsState(prev => ({
                ...prev,
                data: prev.data.filter(c => c.id !== comment.id),
              }));
            } else {
              Alert.alert('Error', 'Failed to delete comment');
            }
          } catch (err) {
            log.error('Delete comment failed:', err);
            Alert.alert('Error', 'Failed to delete comment');
          }
        },
      },
    ]);
  };

  const handleSpaceCardPress = (slug: string) => {
    router.push({
      pathname: '/space/[slug]',
      params: { slug },
    });
  };

  // ---------------------------------------------------------------------------
  // Header block (shared across all tabs as ListHeaderComponent)
  // ---------------------------------------------------------------------------

  const headerBlock = useMemo(() => (
    <>
      <ProfileHeader
        profile={profile!}
        isOwnProfile={isOwnProfile}
        isUploading={avatarUploading}
        onCoverPhotoPress={handleCoverPhotoPress}
        onAvatarPress={handleAvatarPress}
        onFollowersPress={handleFollowersPress}
        onFollowingPress={handleFollowingPress}
      />

      {/* Action Buttons (other profiles only) */}
      {!isOwnProfile && (
        <View style={[styles.actionButtons, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          {isBlocked ? (
            <Pressable
              style={[styles.followButton, { backgroundColor: themeColors.error }]}
              onPress={handleBlockPress}
              disabled={blockLoading}
            >
              {blockLoading ? (
                <ActivityIndicator size="small" color={themeColors.textInverse} />
              ) : (
                <Text style={[styles.followButtonText, { color: themeColors.textInverse }]}>
                  Blocked
                </Text>
              )}
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[
                  styles.followButton,
                  { backgroundColor: themeColors.primary },
                  isFollowing && [styles.followingButton, { borderColor: themeColors.primary }],
                ]}
                onPress={handleFollowPress}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={isFollowing ? themeColors.primary : themeColors.textInverse}
                  />
                ) : (
                  <Text
                    style={[
                      styles.followButtonText,
                      { color: themeColors.textInverse },
                      isFollowing && [styles.followingButtonText, { color: themeColors.primary }],
                    ]}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </Pressable>

              {isFollowing && (
                <Pressable
                  style={[
                    styles.notifyButton,
                    { backgroundColor: isEmailNotifyOn ? withOpacity(themeColors.primary, 0.12) : themeColors.backgroundSecondary },
                  ]}
                  onPress={handleEmailNotifyToggle}
                >
                  <Ionicons
                    name={isEmailNotifyOn ? 'notifications' : 'notifications-outline'}
                    size={18}
                    color={isEmailNotifyOn ? themeColors.primary : themeColors.text}
                  />
                  <Text style={[styles.notifyButtonText, { color: isEmailNotifyOn ? themeColors.primary : themeColors.text }]}>
                    Notify
                  </Text>
                </Pressable>
              )}

              <Pressable style={[styles.messageButton, { backgroundColor: themeColors.backgroundSecondary }]} onPress={handleMessagePress}>
                <Ionicons name="chatbubble-outline" size={18} color={themeColors.text} />
                <Text style={[styles.notifyButtonText, { color: themeColors.text }]}>Chat</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* Tab Bar */}
      <TabBar
        tabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </>
  ), [profile, isOwnProfile, avatarUploading, isBlocked, isFollowing, isEmailNotifyOn, followLoading, blockLoading, visibleTabs, activeTab, themeColors]);

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading && !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title={username ? `@${username}` : 'Profile'}
        />
        <LoadingSpinner message="Loading profile..." />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error
  // ---------------------------------------------------------------------------

  if (error && !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Profile"
        />
        <ErrorMessage message={error} onRetry={refresh} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Tab Content
  // ---------------------------------------------------------------------------

  const renderTabContent = () => {
    // About tab — ScrollView (static content)
    if (activeTab === 'about') {
      return (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          }
        >
          {headerBlock}
          {profile?.is_restricted ? (
            <View style={[styles.restrictedContainer, { backgroundColor: themeColors.surface }]}>
              <Ionicons name="lock-closed-outline" size={32} color={themeColors.textTertiary} />
              <Text style={[styles.restrictedTitle, { color: themeColors.text }]}>Profile is Private</Text>
              <Text style={[styles.restrictedText, { color: themeColors.textSecondary }]}>
                This user's profile details are not visible.
              </Text>
            </View>
          ) : (
            <AboutTab profile={profile!} />
          )}
        </ScrollView>
      );
    }

    // Posts tab — reuse FeedList (never pass loading=true to avoid full-screen
    // spinner that hides the header; handle initial load inline instead)
    if (activeTab === 'posts') {
      if (postsState.loading && !postsState.loaded) {
        return (
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={themeColors.primary} colors={[themeColors.primary]} />
            }
          >
            {headerBlock}
            <LoadingSpinner fullScreen={false} message="Loading posts..." />
          </ScrollView>
        );
      }
      return (
        <FeedList
          feeds={postsState.data}
          loading={false}
          refreshing={postsState.refreshing}
          error={postsState.loaded ? null : postsState.error}
          onRefresh={handleRefresh}
          onLoadMore={postsState.hasMore && !postsState.loading ? () => fetchPosts(postsState.page + 1, true) : undefined}
          onReact={handleReact}
          onAuthorPress={handleAuthorPress}
          onSpacePress={handleSpacePress}
          onCommentPress={handleCommentPress}
          onBookmarkToggle={handleBookmarkToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          emptyMessage="No posts yet"
          emptyIcon="document-text-outline"
          ListHeaderComponent={headerBlock}
        />
      );
    }

    // Spaces tab — FlashList with SpaceCard
    if (activeTab === 'spaces') {
      if (spacesState.loading && !spacesState.loaded) {
        return (
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={themeColors.primary} colors={[themeColors.primary]} />
            }
          >
            {headerBlock}
            <LoadingSpinner fullScreen={false} message="Loading spaces..." />
          </ScrollView>
        );
      }
      return (
        <FlashList
          data={spacesState.data}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <SpaceCard
              space={item}
              onPress={() => handleSpaceCardPress(item.slug)}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
          ListHeaderComponent={headerBlock}
          ListEmptyComponent={
            spacesState.error ? (
              <ErrorMessage message={spacesState.error} onRetry={fetchSpaces} />
            ) : spacesState.loaded ? (
              <EmptyState icon="planet-outline" message="No spaces joined" />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={spacesState.refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          }
        />
      );
    }

    // Comments tab — FlashList with CommentCard
    if (activeTab === 'comments') {
      if (commentsState.loading && !commentsState.loaded) {
        return (
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={themeColors.primary} colors={[themeColors.primary]} />
            }
          >
            {headerBlock}
            <LoadingSpinner fullScreen={false} message="Loading comments..." />
          </ScrollView>
        );
      }
      return (
        <FlashList
          data={commentsState.data}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => (
            <CommentCard
              comment={item}
              onPostPress={handleCommentPostPress}
              onDelete={handleDeleteComment}
              isOwnComment={isOwnProfile}
              isFirst={index === 0}
              isLast={index === commentsState.data.length - 1}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
          ListHeaderComponent={headerBlock}
          ListEmptyComponent={
            commentsState.error ? (
              <ErrorMessage message={commentsState.error} onRetry={() => fetchComments(1)} />
            ) : commentsState.loaded ? (
              <EmptyState icon="chatbubbles-outline" message="No comments yet" />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={commentsState.refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          }
          onEndReached={commentsState.hasMore && !commentsState.loading ? () => fetchComments(commentsState.page + 1, true) : undefined}
          onEndReachedThreshold={0.5}
        />
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Render: Profile
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <PageHeader
        leftAction="back"
        onLeftPress={() => router.back()}
        title={profile?.display_name || `@${username}`}
        rightElement={
          <Pressable
            onPress={() => isOwnProfile ? setSettingsVisible(true) : setOtherMenuVisible(true)}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="settings-outline" size={22} color={themeColors.text} />
          </Pressable>
        }
      />

      {renderTabContent()}

      {/* Profile Settings Dropdown (own profile) */}
      {isOwnProfile && (
        <ProfileMenu
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onEditProfile={handleEditProfilePress}
        />
      )}

      {/* Other User Menu Dropdown (block) */}
      {!isOwnProfile && (
        <DropdownMenu
          visible={otherMenuVisible}
          onClose={() => setOtherMenuVisible(false)}
          items={[
            {
              key: 'block',
              label: isBlocked ? 'Unblock User' : 'Block User',
              icon: isBlocked ? 'person-add-outline' : 'ban-outline',
              onPress: () => { setOtherMenuVisible(false); handleBlockPress(); },
              destructive: !isBlocked,
            },
          ] as DropdownMenuItem[]}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },

  settingsButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.iconButton / 2,
  },

  followButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: sizing.borderRadius.lg,
    minWidth: 120,
    alignItems: 'center',
  },

  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },

  followButtonText: {
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.md,
  },

  followingButtonText: {},

  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: sizing.touchTarget / 2,
    gap: 4,
  },

  notifyButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: sizing.touchTarget / 2,
    gap: 4,
  },

  restrictedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },

  restrictedTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },

  restrictedText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },
});
