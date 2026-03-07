// =============================================================================
// BLOG LIST SCREEN - Paginated list of WordPress blog posts
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { spacing } from '@/constants/layout';
import { WPPost } from '@/types/blog';
import { blogApi } from '@/services/api/blog';
import { PageHeader } from '@/components/navigation/PageHeader';
import { BlogCard } from '@/components/blog/BlogCard';

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
      <EmptyState
        icon="newspaper-outline"
        title="No Blog Posts"
        message="Check back soon for new content."
      />
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
          <ErrorMessage message={error} onRetry={() => fetchPosts(1)} />
        ) : loading && posts.length === 0 ? (
          /* Loading State */
          <LoadingSpinner />
        ) : (
          /* Post List */
          <FlashList
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
    paddingBottom: spacing.xxl,
  },

  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
