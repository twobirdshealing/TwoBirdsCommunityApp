// =============================================================================
// CONNECTIONS SCREEN - Following & Followers lists with tab switching
// =============================================================================
// Route: /profile/[username]/connections?initialTab=following|followers
// Features:
// - Two tabs: Following / Followers
// - Infinite scroll with pull-to-refresh
// - Follow/unfollow, message, view profile
// - Lazy-loads each tab on first visit
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { MemberCard, type MemberCardData } from '@/components/member/MemberCard';
import { spacing, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { profilesApi } from '@/services/api/profiles';
import { useFollowToggle } from '@/hooks/useFollowToggle';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type TabKey = 'following' | 'followers';

interface TabState {
  data: MemberCardData[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  loaded: boolean;
}

const INITIAL_TAB_STATE: TabState = {
  data: [],
  page: 1,
  hasMore: true,
  loading: false,
  refreshing: false,
  error: null,
  loaded: false,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function xprofileToMemberCard(xp: any): MemberCardData {
  return {
    id: xp.user_id,
    user_id: xp.user_id,
    display_name: xp.display_name,
    username: xp.username,
    avatar: xp.avatar ?? undefined,
    short_description: xp.short_description ?? undefined,
    xprofile: {
      user_id: xp.user_id,
      display_name: xp.display_name,
      username: xp.username,
      avatar: xp.avatar,
      short_description: xp.short_description,
      is_verified: xp.is_verified,
      meta: xp.meta,
    },
  };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ConnectionsScreen() {
  const router = useRouter();
  const { username, initialTab } = useLocalSearchParams<{ username: string; initialTab?: string }>();
  const { user: currentUser } = useAuth();
  const { colors: themeColors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab === 'followers' ? 'followers' : 'following'
  );
  const [followingState, setFollowingState] = useState<TabState>({ ...INITIAL_TAB_STATE });
  const [followersState, setFollowersState] = useState<TabState>({ ...INITIAL_TAB_STATE });

  const { followMap, setFollowMap, handleFollowPress, isFollowing, isFollowLoading } = useFollowToggle();

  // ---------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------

  const getState = (tab: TabKey) => (tab === 'following' ? followingState : followersState);
  const setState = (tab: TabKey) => (tab === 'following' ? setFollowingState : setFollowersState);

  // ---------------------------------------------------------------------------
  // Fetch data for a tab
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async (tab: TabKey, pageNum: number = 1, shouldAppend: boolean = false) => {
    if (!username) return;

    const setTabState = setState(tab);

    setTabState(prev => ({
      ...prev,
      loading: pageNum > 1,
      refreshing: pageNum === 1 && prev.loaded,
      error: null,
    }));

    try {
      const response = tab === 'following'
        ? await profilesApi.getFollowing(username, pageNum)
        : await profilesApi.getFollowers(username, pageNum);

      if (!response.success) {
        setTabState(prev => ({
          ...prev,
          error: response.error?.message || `Failed to load ${tab}`,
          loading: false,
          refreshing: false,
          loaded: true,
        }));
        return;
      }

      // API returns paginated data with nested profile under "follower" or "followed"
      const paginated = tab === 'following'
        ? (response.data as any).followings
        : (response.data as any).followers;

      const rawEntries = paginated?.data || [];
      const nextPageUrl = paginated?.next_page_url;

      // Extract the nested xprofile from each entry
      const profiles = rawEntries.map((entry: any) => {
        const xp = tab === 'following' ? entry.followed : entry.follower;
        return xp;
      }).filter(Boolean);

      const newItems = profiles.map(xprofileToMemberCard);

      // Populate follow state from API response
      const newFollowMap: Record<number, number> = {};
      for (const xp of profiles) {
        if (xp.user_id && xp.follow !== undefined && xp.follow !== null) {
          newFollowMap[xp.user_id] = Number(xp.follow);
        }
      }
      if (Object.keys(newFollowMap).length > 0) {
        setFollowMap(prev => ({ ...prev, ...newFollowMap }));
      }

      setTabState(prev => ({
        ...prev,
        data: shouldAppend ? [...prev.data, ...newItems] : newItems,
        page: pageNum,
        hasMore: nextPageUrl != null,
        loading: false,
        refreshing: false,
        error: null,
        loaded: true,
      }));
    } catch (err) {
      setTabState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Something went wrong',
        loading: false,
        refreshing: false,
        loaded: true,
      }));
    }
  }, [username]);

  // ---------------------------------------------------------------------------
  // Load active tab on mount / tab switch
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const state = getState(activeTab);
    if (!state.loaded) {
      fetchData(activeTab, 1, false);
    }
  }, [activeTab]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    const setTabState = setState(activeTab);
    setTabState(prev => ({ ...prev, page: 1, hasMore: true }));
    fetchData(activeTab, 1, false);
  };

  const handleLoadMore = () => {
    const state = getState(activeTab);
    if (!state.loading && !state.refreshing && state.hasMore) {
      const nextPage = state.page + 1;
      fetchData(activeTab, nextPage, true);
    }
  };

  const handleMemberPress = (member: MemberCardData) => {
    const memberUsername = member.xprofile?.username || member.username;
    if (memberUsername) {
      router.push(`/profile/${memberUsername}`);
    }
  };

  const handleMessagePress = (member: MemberCardData) => {
    const memberId = Number(member.xprofile?.user_id || member.user_id);
    const memberName = member.xprofile?.display_name || member.display_name || '';
    const memberAvatar = member.xprofile?.avatar || member.avatar || '';

    router.push({
      pathname: '/messages/user/[userId]',
      params: {
        userId: String(memberId),
        displayName: memberName,
        avatar: memberAvatar,
      },
    } as any);
  };

  // ---------------------------------------------------------------------------
  // Active tab state
  // ---------------------------------------------------------------------------

  const currentState = getState(activeTab);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ title: 'Connections' }} />

      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          {(['following', 'followers'] as TabKey[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                style={styles.tab}
                onPress={() => setActiveTab(tab)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: isActive ? themeColors.primary : themeColors.textSecondary },
                    isActive && styles.tabTextActive,
                  ]}
                >
                  {tab === 'following' ? 'Following' : 'Followers'}
                </Text>
                {isActive && (
                  <View style={[styles.tabIndicator, { backgroundColor: themeColors.primary }]} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Loading State */}
        {currentState.loading && currentState.data.length === 0 && !currentState.error && (
          <LoadingSpinner message={`Loading ${activeTab}...`} />
        )}

        {/* Initial load (not yet loaded) */}
        {!currentState.loaded && !currentState.loading && (
          <LoadingSpinner message={`Loading ${activeTab}...`} />
        )}

        {/* Error State */}
        {currentState.error && currentState.data.length === 0 && (
          <ErrorMessage message={currentState.error} onRetry={handleRefresh} />
        )}

        {/* List */}
        {(currentState.loaded && (currentState.data.length > 0 || (!currentState.loading && !currentState.error))) && (
          <FlashList
            data={currentState.data}
            renderItem={({ item }) => {
              const memberId = Number(item.xprofile?.user_id || item.user_id);
              const isSelf = memberId === currentUser?.id;
              return (
                <MemberCard
                  member={item}
                  onPress={handleMemberPress}
                  onMessagePress={isSelf ? undefined : handleMessagePress}
                  onFollowPress={isSelf ? undefined : handleFollowPress}
                  isFollowing={isFollowing(memberId)}
                  followLoading={isFollowLoading(memberId)}
                  showRole={false}
                  showBio={true}
                  showLastActive={false}
                  showActions={!isSelf}
                />
              );
            }}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={currentState.refreshing}
                onRefresh={handleRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            ListEmptyComponent={
              !currentState.loading && !currentState.error ? (
                <EmptyState
                  icon="people-outline"
                  message={activeTab === 'following' ? 'Not following anyone yet' : 'No followers yet'}
                />
              ) : null
            }
            ListFooterComponent={
              currentState.loading && currentState.data.length > 0 ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={themeColors.primary} />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    position: 'relative',
  },

  tabText: {
    fontSize: typography.size.md,
  },

  tabTextActive: {
    fontWeight: typography.weight.semibold,
  },

  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 2,
    borderRadius: sizing.borderRadius.full,
  },

  // Footer
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
