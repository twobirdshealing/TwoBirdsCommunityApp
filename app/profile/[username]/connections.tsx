// =============================================================================
// CONNECTIONS SCREEN - Following & Followers lists with tab switching
// =============================================================================
// Route: /profile/[username]/connections?initialTab=following|followers
// Features:
// - Two tabs: Following / Followers
// - Search bar (debounced 400ms, server-side filtering by name/username)
// - Sort toggle (Recent / A-Z)
// - "Follows you" mutual follow badge on member cards
// - Infinite scroll with pull-to-refresh
// - Follow/unfollow, message, view profile
// - Lazy-loads each tab on first visit
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { TabBar } from '@/components/common/TabBar';
import { MemberCard, type MemberCardData } from '@/components/member/MemberCard';
import { spacing, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { profilesApi } from '@/services/api/profiles';
import { useFeatures } from '@/contexts/AppConfigContext';
import { useFollowToggle } from '@/hooks/useFollowToggle';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type TabKey = 'following' | 'followers';

type SortOption = 'id' | 'alphabetical';

interface TabState {
  data: MemberCardData[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  loaded: boolean;
}

const TABS: { key: TabKey; title: string }[] = [
  { key: 'following', title: 'Following' },
  { key: 'followers', title: 'Followers' },
];

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
    is_follower: xp.is_follower ?? false,
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
  const insets = useSafeAreaInsets();
  const { username, initialTab } = useLocalSearchParams<{ username: string; initialTab?: string }>();
  const { user: currentUser } = useAuth();
  const { colors: themeColors } = useTheme();

  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab === 'followers' ? 'followers' : 'following'
  );
  const [followingState, setFollowingState] = useState<TabState>({ ...INITIAL_TAB_STATE });
  const [followersState, setFollowersState] = useState<TabState>({ ...INITIAL_TAB_STATE });

  // Search & Sort
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('id');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs for latest values so fetchData avoids stale closures
  const searchRef = useRef(search);
  const sortByRef = useRef(sortBy);

  const features = useFeatures();
  const { followMap, setFollowMap, handleFollowPress, handleNotifyPress, isFollowing, isNotifyOn, isFollowLoading } = useFollowToggle();

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
      // Read from refs to avoid stale closures in debounced callbacks
      const searchTrimmed = searchRef.current.trim() || undefined;
      const sortParam = sortByRef.current !== 'id' ? sortByRef.current : undefined;

      const response = tab === 'following'
        ? await profilesApi.getFollowing(username, pageNum, 20, searchTrimmed, sortParam)
        : await profilesApi.getFollowers(username, pageNum, 20, searchTrimmed, sortParam);

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

  // Refetch when sort changes (skip initial mount — activeTab effect handles that)
  const sortMounted = useRef(false);
  useEffect(() => {
    if (!sortMounted.current) {
      sortMounted.current = true;
      return;
    }
    sortByRef.current = sortBy;
    // Reset both tabs and refetch active tab
    setFollowingState({ ...INITIAL_TAB_STATE });
    setFollowersState({ ...INITIAL_TAB_STATE });
    fetchData(activeTab, 1, false);
  }, [sortBy]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Search handler (debounced)
  // ---------------------------------------------------------------------------

  const handleSearchChange = (text: string) => {
    setSearch(text);
    searchRef.current = text;
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      // Reset both tabs so they reload with new search
      setFollowingState({ ...INITIAL_TAB_STATE });
      setFollowersState({ ...INITIAL_TAB_STATE });
      fetchData(activeTab, 1, false);
    }, 400);
  };

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
    });
  };

  // ---------------------------------------------------------------------------
  // Active tab state
  // ---------------------------------------------------------------------------

  const currentState = getState(activeTab);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <PageHeader
          left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />}
          center={<HeaderTitle>Connections</HeaderTitle>}
        />
        {/* Tab Bar */}
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Search Bar + Sort Toggle */}
        <View style={[styles.searchContainer, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <View style={[styles.searchInputWrapper, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="search-outline" size={18} color={themeColors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search..."
              placeholderTextColor={themeColors.textTertiary}
              value={search}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => { setSearch(''); handleSearchChange(''); }}>
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => setSortBy(prev => prev === 'id' ? 'alphabetical' : 'id')}
            style={[styles.sortButton, { backgroundColor: themeColors.backgroundSecondary }]}
          >
            <Ionicons
              name={sortBy === 'alphabetical' ? 'text-outline' : 'time-outline'}
              size={18}
              color={themeColors.textSecondary}
            />
            <Text style={[styles.sortLabel, { color: themeColors.textSecondary }]}>
              {sortBy === 'alphabetical' ? 'A-Z' : 'Recent'}
            </Text>
          </Pressable>
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
                  onFollowPress={isSelf || !features.followers ? undefined : handleFollowPress}
                  onNotifyPress={isSelf || !features.followers ? undefined : handleNotifyPress}
                  isFollowing={isFollowing(memberId)}
                  isNotifyOn={isNotifyOn(memberId)}
                  followLoading={isFollowLoading(memberId)}
                  isFollower={item.is_follower ?? false}
                  showRole={false}
                  showBio={true}
                  showLastActive={false}
                  showActions={!isSelf}
                />
              );
            }}
            keyExtractor={(item, index) => item.id?.toString() || `item-${index}`}
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
                  message={search ? 'No results found' : activeTab === 'following' ? 'Not following anyone yet' : 'No followers yet'}
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
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Search & Sort
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },

  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    paddingVertical: 0,
  },

  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    gap: 4,
  },

  sortLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Footer
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
