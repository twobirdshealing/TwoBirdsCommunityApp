// =============================================================================
// BLOG LIST SCREEN - Paginated list of WordPress blog posts
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { WPPost } from '@/types/blog';
import { blogApi } from '@/services/api';
import { PageHeader } from '@/components/navigation';
import { BlogCard } from '@/components/blog';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function BlogListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  // State
  const [posts, setPosts] = useState<WPPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch Posts
  // ---------------------------------------------------------------------------

  const fetchPosts = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else if (pageNum === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const response = await blogApi.getBlogPosts({
        page: pageNum,
        per_page: 20,
      });

      if (!response.success) {
        setError(response.error?.message || 'Failed to load posts');
        return;
      }

      const { posts: newPosts, meta } = response.data;

      if (pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
      }

      setPage(pageNum);
      setHasMore(pageNum < meta.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchPosts(1, true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      fetchPosts(page + 1);
    }
  };

  const handlePostPress = (post: WPPost) => {
    router.push({
      pathname: '/blog/[id]',
      params: { id: String(post.id) },
    });
  };

  const handleAuthorPress = (authorSlug: string) => {
    router.push(`/profile/${authorSlug}`);
  };

  // ---------------------------------------------------------------------------
  // List Footer (loading more indicator)
  // ---------------------------------------------------------------------------

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Empty State
  // ---------------------------------------------------------------------------

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="newspaper-outline" size={48} color={themeColors.textTertiary} />
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Blog Posts</Text>
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          Check back soon for new content.
        </Text>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Blog"
        />

        {/* Error State */}
        {error && !loading ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
            <TouchableOpacity
              onPress={() => fetchPosts(1)}
              style={[styles.retryButton, { backgroundColor: themeColors.primary }]}
            >
              <Text style={[styles.retryText, { color: themeColors.textInverse }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : loading && posts.length === 0 ? (
          /* Loading State */
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        ) : (
          /* Post List */
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <BlogCard
                post={item}
                onPress={() => handlePostPress(item)}
                onAuthorPress={handleAuthorPress}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={5}
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

  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
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

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl * 2,
    paddingHorizontal: spacing.xl,
  },

  emptyTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    marginTop: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
