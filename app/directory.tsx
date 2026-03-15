// =============================================================================
// CHURCH DIRECTORY - Global member directory
// =============================================================================
// Route: /directory
// Features:
// - Search members by name/username
// - Sort via gear menu: Joining Date (default), Last Activity, Display Name
// - Infinite scroll with pull-to-refresh
// - Follow/unfollow, message, view profile
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MemberCard, type MemberCardData } from '@/components/member/MemberCard';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { PageHeader } from '@/components/navigation/PageHeader';
import { spacing, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { membersApi } from '@/services/api/members';
import { useFollowToggle } from '@/hooks/useFollowToggle';

// -----------------------------------------------------------------------------
// Sort Options
// -----------------------------------------------------------------------------

type SortOption = 'created_at' | 'last_activity' | 'display_name';

const SORT_CONFIG: { key: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'created_at', label: 'Joining Date', icon: 'calendar-outline' },
  { key: 'last_activity', label: 'Last Activity', icon: 'time-outline' },
  { key: 'display_name', label: 'Display Name', icon: 'text-outline' },
];

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ChurchDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { colors: themeColors } = useTheme();

  // Data state
  const [members, setMembers] = useState<MemberCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Search & Sort
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow state
  const { followMap, setFollowMap, followLoadingMap, handleFollowPress, handleNotifyPress, isFollowing, isNotifyOn, isFollowLoading } = useFollowToggle();

  // ---------------------------------------------------------------------------
  // Fetch Members
  // ---------------------------------------------------------------------------

  const fetchMembers = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    if ((loading || refreshing) && pageNum !== 1) return;

    try {
      if (pageNum === 1) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await membersApi.getMembers({
        page: pageNum,
        per_page: 20,
        sort_by: sortBy,
        ...(search.trim() && { search: search.trim() }),
      });

      if (!response.success) {
        setError(response.error?.message || 'Failed to load members');
        return;
      }

      const apiData = response.data;

      // Extract members from nested structure: { members: { data: [...] } }
      const newMembers: MemberCardData[] = apiData.members?.data || [];

      if (shouldAppend) {
        setMembers((prev) => [...prev, ...newMembers]);
      } else {
        setMembers(newMembers);
      }

      // Extract follow state if present
      if (apiData.current_user_follows) {
        setFollowMap(prev => ({ ...prev, ...apiData.current_user_follows }));
      }

      // Check if more pages exist
      const hasMorePages = apiData.members?.next_page_url != null || newMembers.length === 20;
      setHasMore(hasMorePages);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch & refetch on sort change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchMembers(1, false);
  }, [sortBy]);

  // Debounced search
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchMembers(1, false);
    }, 400);
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    setPage(1);
    setHasMore(true);
    fetchMembers(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && !refreshing && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMembers(nextPage, true);
    }
  };

  const handleMemberPress = (member: MemberCardData) => {
    const username = member.xprofile?.username || member.username;
    if (username) {
      router.push(`/profile/${username}`);
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
  // Sort Menu Items (for DropdownMenu)
  // ---------------------------------------------------------------------------

  const sortMenuItems: DropdownMenuItem[] = SORT_CONFIG.map((option) => ({
    key: option.key,
    label: sortBy === option.key ? `${option.label}  \u2713` : option.label,
    icon: option.icon,
    onPress: () => {
      setSortBy(option.key);
      setShowSortMenu(false);
    },
  }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Church Directory"
          rightElement={
            <>
              <Pressable onPress={() => setShowSortMenu(true)} style={styles.menuButton}>
                <Ionicons name="options-outline" size={22} color={themeColors.text} />
              </Pressable>
              <DropdownMenu
                visible={showSortMenu}
                onClose={() => setShowSortMenu(false)}
                items={sortMenuItems}
                topOffset={60}
              />
            </>
          }
        />

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <View style={[styles.searchInputWrapper, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="search-outline" size={18} color={themeColors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search Members..."
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
        </View>

        {/* Error State */}
        {error && !loading && members.length === 0 && (
          <ErrorMessage message={error} onRetry={handleRefresh} />
        )}

        {/* Loading State */}
        {loading && members.length === 0 && !error && (
          <LoadingSpinner message="Loading members..." />
        )}

        {/* Members List */}
        {(members.length > 0 || (!loading && !error)) && (
          <FlashList
            data={members}
            contentContainerStyle={{ paddingBottom: insets.bottom }}
            renderItem={({ item }) => {
              const memberId = Number(item.xprofile?.user_id || item.user_id || item.id);
              const isSelf = memberId === currentUser?.id;
              return (
                <MemberCard
                  member={item}
                  onPress={handleMemberPress}
                  onMessagePress={isSelf ? undefined : handleMessagePress}
                  onFollowPress={isSelf ? undefined : handleFollowPress}
                  onNotifyPress={isSelf ? undefined : handleNotifyPress}
                  isFollowing={isFollowing(memberId)}
                  isNotifyOn={isNotifyOn(memberId)}
                  followLoading={isFollowLoading(memberId)}
                  showRole={false}
                  showBio={true}
                  showLastActive={true}
                  showActions={!isSelf}
                />
              );
            }}
            keyExtractor={(item) => (item.user_id || item.id)?.toString() || Math.random().toString()}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            ListEmptyComponent={
              !loading && !error ? (
                <EmptyState
                  icon="people-outline"
                  message={search ? 'No members found' : 'No members yet'}
                />
              ) : null
            }
            ListFooterComponent={
              loading && page > 1 ? (
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

  // Gear menu button (in PageHeader rightElement)
  menuButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  searchInputWrapper: {
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

  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
