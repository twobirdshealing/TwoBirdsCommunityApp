// =============================================================================
// SPACE MEMBERS SCREEN - Shows list of space members
// =============================================================================
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
      <Image source={{ uri: item.xprofile.avatar }} style={styles.avatar} />

      {/* Member Info */}
      <View style={styles.memberInfo}>
        <Text style={styles.displayName}>{item.xprofile.display_name}</Text>
        <Text style={styles.username}>@{item.xprofile.username}</Text>
      </View>

      {/* Role Badge */}
      {item.role !== 'member' && (
        <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) }]}>
          <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Members',
          headerBackTitle: 'Back',
        }}
      />

      <View style={styles.container}>
        {loading && page === 1 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976d2" />
          </View>
        ) : (
          <FlashList
            data={members}
            renderItem={renderMember}
            estimatedItemSize={70}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={handleRefresh} />}
            contentContainerStyle={styles.listContent}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e0e0',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#666',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
