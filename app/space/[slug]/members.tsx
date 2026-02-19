// =============================================================================
// SPACE MEMBERS SCREEN - Shows list of space members
// =============================================================================
// Route: /space/[slug]/members
// Features:
// - Admins and Facilitators sorted to top
// - Tap member to view profile
// - Message and Follow buttons (placeholders)
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { MemberCard, MemberCardData } from '@/components/member';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { profilesApi } from '@/services/api/profiles';
import { spacesApi } from '@/services/api/spaces';

// -----------------------------------------------------------------------------
// Helper: Sort members with leaders at top
// -----------------------------------------------------------------------------

function sortMembersWithLeadersFirst(members: MemberCardData[]): MemberCardData[] {
  const roleOrder: Record<string, number> = {
    admin: 0,
    moderator: 1,
    member: 2,
  };
  
  return [...members].sort((a, b) => {
    const aOrder = roleOrder[a.role || 'member'] ?? 2;
    const bOrder = roleOrder[b.role || 'member'] ?? 2;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // Same role - sort alphabetically by name
    const aName = a.xprofile?.display_name || a.display_name || '';
    const bName = b.xprofile?.display_name || b.display_name || '';
    return aName.localeCompare(bName);
  });
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SpaceMembersScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user: currentUser } = useAuth();
  const { colors: themeColors } = useTheme();
  const [members, setMembers] = useState<MemberCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Follow state: maps userId → follow level (> 0 = following)
  const [followMap, setFollowMap] = useState<Record<number, number>>({});
  const [followLoadingMap, setFollowLoadingMap] = useState<Record<number, boolean>>({});

  // ---------------------------------------------------------------------------
  // Sorted members (admins/facilitators first)
  // ---------------------------------------------------------------------------
  
  const sortedMembers = useMemo(() => {
    return sortMembersWithLeadersFirst(members);
  }, [members]);

  // ---------------------------------------------------------------------------
  // Fetch Members
  // ---------------------------------------------------------------------------

  const fetchMembers = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    if ((loading || refreshing) && pageNum !== 1) return;
    
    if (!slug) {
      setError('Space not found');
      setLoading(false);
      return;
    }

    try {
      if (pageNum === 1) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await spacesApi.getSpaceMembers(slug, {
        page: pageNum,
        per_page: 20,
        status: 'active',
      });

      if (!response.success) {
        setError(response.error?.message || 'Failed to load members');
        return;
      }

      const apiData = response.data as any;
      
      // Extract members from nested structure: { members: { data: [...] } }
      let newMembers: MemberCardData[] = [];
      
      if (apiData?.members?.data && Array.isArray(apiData.members.data)) {
        newMembers = apiData.members.data;
      } else if (apiData?.data && Array.isArray(apiData.data)) {
        newMembers = apiData.data;
      } else if (Array.isArray(apiData)) {
        newMembers = apiData;
      }

      if (shouldAppend) {
        setMembers((prev) => [...prev, ...newMembers]);
      } else {
        setMembers(newMembers);
      }

      // Extract follow state from API response (injected by FollowHandler)
      if (apiData?.current_user_follows) {
        setFollowMap(prev => ({ ...prev, ...apiData.current_user_follows }));
      }

      const hasMorePages = apiData?.members?.next_page_url != null || newMembers.length === 20;
      setHasMore(hasMorePages);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMembers(1, false);
  }, [slug]);

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

  const handleFollowPress = useCallback(async (member: MemberCardData) => {
    const memberId = Number(member.xprofile?.user_id || member.user_id);
    const username = member.xprofile?.username || member.username;
    if (!username || !memberId) return;

    const isCurrentlyFollowing = (followMap[memberId] || 0) > 0;

    // Optimistic update
    setFollowMap(prev => ({
      ...prev,
      [memberId]: isCurrentlyFollowing ? 0 : 1,
    }));
    setFollowLoadingMap(prev => ({ ...prev, [memberId]: true }));

    try {
      if (isCurrentlyFollowing) {
        await profilesApi.unfollowUser(username);
      } else {
        await profilesApi.followUser(username);
      }
    } catch (err) {
      console.error('[SpaceMembers] Follow error:', err);
      // Revert on failure
      setFollowMap(prev => ({
        ...prev,
        [memberId]: isCurrentlyFollowing ? 1 : 0,
      }));
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoadingMap(prev => ({ ...prev, [memberId]: false }));
    }
  }, [followMap]);

  // ---------------------------------------------------------------------------
  // Section Header (for Admins/Facilitators vs Members)
  // ---------------------------------------------------------------------------

  const renderSectionLabel = (role: string | undefined, index: number) => {
    // Show section label only at transitions
    if (index === 0) {
      if (role === 'admin' || role === 'moderator') {
        return (
          <View style={[styles.sectionHeader, { backgroundColor: themeColors.backgroundSecondary, borderBottomColor: themeColors.border }]}>
            <Text style={[styles.sectionHeaderText, { color: themeColors.textSecondary }]}>Leadership</Text>
          </View>
        );
      }
      return (
        <View style={[styles.sectionHeader, { backgroundColor: themeColors.backgroundSecondary, borderBottomColor: themeColors.border }]}>
          <Text style={[styles.sectionHeaderText, { color: themeColors.textSecondary }]}>Members</Text>
        </View>
      );
    }

    const prevMember = sortedMembers[index - 1];
    const prevRole = prevMember?.role;
    const prevIsLeader = prevRole === 'admin' || prevRole === 'moderator';
    const currentIsLeader = role === 'admin' || role === 'moderator';

    // Show "Members" label when transitioning from leaders to regular members
    if (prevIsLeader && !currentIsLeader) {
      return (
        <View style={[styles.sectionHeader, { backgroundColor: themeColors.backgroundSecondary, borderBottomColor: themeColors.border }]}>
          <Text style={[styles.sectionHeaderText, { color: themeColors.textSecondary }]}>Members</Text>
        </View>
      );
    }

    return null;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Members',
          headerShown: true,
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: themeColors.surface },
          headerTintColor: themeColors.text,
          headerShadowVisible: false,
        }}
      />

      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Error State */}
        {error && !loading && members.length === 0 && (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={themeColors.error} style={styles.errorIcon} />
            <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
            <Text style={[styles.retryButton, { color: themeColors.primary }]} onPress={handleRefresh}>
              Tap to retry
            </Text>
          </View>
        )}

        {/* Loading State */}
        {loading && members.length === 0 && !error && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading members...</Text>
          </View>
        )}

        {/* Members List */}
        {(sortedMembers.length > 0 || (!loading && !error)) && (
          <FlashList
            data={sortedMembers}
            renderItem={({ item, index }) => {
              const memberId = Number(item.xprofile?.user_id || item.user_id);
              const isSelf = memberId === currentUser?.id;
              return (
                <>
                  {renderSectionLabel(item.role, index)}
                  <MemberCard
                    member={item}
                    onPress={handleMemberPress}
                    onMessagePress={isSelf ? undefined : handleMessagePress}
                    onFollowPress={isSelf ? undefined : handleFollowPress}
                    isFollowing={(followMap[memberId] || 0) > 0}
                    followLoading={followLoadingMap[memberId] || false}
                    showRole={true}
                    showBio={true}
                    showLastActive={true}
                    showActions={!isSelf}
                  />
                </>
              );
            }}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
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
                <View style={styles.centerContainer}>
                  <Ionicons name="people-outline" size={48} color={themeColors.textTertiary} style={styles.emptyIcon} />
                  <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No members found</Text>
                </View>
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

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
  },

  errorIcon: {
    marginBottom: spacing.md,
  },

  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    fontSize: 14,
    fontWeight: '600',
  },

  emptyIcon: {
    marginBottom: spacing.md,
  },

  emptyText: {
    fontSize: 16,
  },

  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  // Section Headers
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  sectionHeaderText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});