// =============================================================================
// SPACE MEMBERS SCREEN - Shows list of space members
// =============================================================================
// Route: /space/[slug]/members
// Features:
// - Admins and Facilitators sorted to top
// - Tap member to view profile
// - Message and Follow buttons (placeholders)
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { MemberCard, MemberCardData } from '@/components/member';
import { spacesApi } from '@/services/api/spaces';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';

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
  const [members, setMembers] = useState<MemberCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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

      const hasMorePages = apiData?.members?.next_page_url !== null || newMembers.length === 20;
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
    // TODO: Phase 2 - Implement messaging when Fluent Messaging is enabled
    Alert.alert(
      'Coming Soon',
      'Direct messaging will be available in a future update.',
      [{ text: 'OK' }]
    );
  };

  const handleFollowPress = (member: MemberCardData) => {
    // TODO: Phase 2 - Implement follow functionality
    const username = member.xprofile?.username || member.username;
    Alert.alert(
      'Coming Soon',
      `Follow functionality for @${username} will be available soon.`,
      [{ text: 'OK' }]
    );
  };

  // ---------------------------------------------------------------------------
  // Section Header (for Admins/Facilitators vs Members)
  // ---------------------------------------------------------------------------

  const renderSectionLabel = (role: string | undefined, index: number) => {
    // Show section label only at transitions
    if (index === 0) {
      if (role === 'admin' || role === 'moderator') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>Leadership</Text>
          </View>
        );
      }
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Members</Text>
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Members</Text>
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
        }}
      />

      <View style={styles.container}>
        {/* Error State */}
        {error && !loading && members.length === 0 && (
          <View style={styles.centerContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryButton} onPress={handleRefresh}>
              Tap to retry
            </Text>
          </View>
        )}

        {/* Loading State */}
        {loading && members.length === 0 && !error && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading members...</Text>
          </View>
        )}

        {/* Members List */}
        {(sortedMembers.length > 0 || (!loading && !error)) && (
          <FlashList
            data={sortedMembers}
            renderItem={({ item, index }) => (
              <>
                {renderSectionLabel(item.role, index)}
                <MemberCard
                  member={item}
                  onPress={handleMemberPress}
                  onMessagePress={handleMessagePress}
                  onFollowPress={handleFollowPress}
                  showRole={true}
                  showBio={true}
                  showLastActive={true}
                  showActions={true}
                />
              </>
            )}
            keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              !loading && !error ? (
                <View style={styles.centerContainer}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={styles.emptyText}>No members found</Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              loading && page > 1 ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
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
    backgroundColor: colors.background,
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
    color: colors.textSecondary,
  },

  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },

  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  // Section Headers
  sectionHeader: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  sectionHeaderText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
