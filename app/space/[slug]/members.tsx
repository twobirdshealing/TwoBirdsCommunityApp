// =============================================================================
// SPACE MEMBERS SCREEN - Shows list of space members
// =============================================================================
// Route: /space/[slug]/members
// Accessible from space menu "Members" option
// Shows member avatars, names, and roles
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { spacesApi } from '@/services/api/spaces';
import { SpaceMember } from '@/types';

export default function SpaceMembersScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchMembers = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    if (loading && pageNum !== 1) return;

    try {
      setLoading(true);

      const response = await spacesApi.getSpaceMembers(slug, {
        page: pageNum,
        per_page: 20,
        status: 'active',
      });

      const newMembers = response.data.data;

      if (shouldAppend) {
        setMembers((prev) => [...prev, ...newMembers]);
      } else {
        setMembers(newMembers);
      }

      setHasMore(newMembers.length === 20);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers(1, false);
  }, [slug]);

  const handleRefresh = () => {
    setPage(1);
    fetchMembers(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMembers(nextPage, true);
    }
  };

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case 'admin':
        return '#d32f2f';
      case 'moderator':
        return '#1976d2';
      default:
        return '#757575';
    }
  };

  const renderMember = ({ item }: { item: SpaceMember }) => (
    <View style={styles.memberCard}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {item.xprofile?.avatar ? (
          <Image source={{ uri: item.xprofile.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {(item.xprofile?.display_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{item.xprofile?.display_name || 'Unknown'}</Text>
        <Text style={styles.memberUsername}>@{item.xprofile?.username || 'unknown'}</Text>
      </View>

      {/* Role Badge */}
      {item.role !== 'member' && (
        <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) }]}>
          <Text style={styles.roleBadgeText}>
            {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
          </Text>
        </View>
      )}
    </View>
  );

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
        {loading && members.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Loading members...</Text>
          </View>
        ) : (
          <FlashList
            data={members}
            renderItem={renderMember}
            estimatedItemSize={72}
            keyExtractor={(item) => item.id.toString()}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl refreshing={loading && page === 1} onRefresh={handleRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>No members found</Text>
              </View>
            }
            ListFooterComponent={
              loading && page > 1 ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color="#1976d2" />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },

  avatarContainer: {
    marginRight: 12,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  avatarPlaceholder: {
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },

  memberInfo: {
    flex: 1,
  },

  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },

  memberUsername: {
    fontSize: 14,
    color: '#666',
  },

  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  emptyText: {
    fontSize: 16,
    color: '#666',
  },

  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
