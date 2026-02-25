// =============================================================================
// NOTIFICATIONS SCREEN - User notifications with swipe actions
// =============================================================================
// Route: /notifications (ROOT LEVEL - accessed from header bell icon)
// Features:
// - Paginated list with pull-to-refresh
// - Unread/All filter toggle
// - Mark all as read
// - Swipe to delete or mark as read
// - Navigate to related content on tap
// =============================================================================

import { LoadingSpinner, ErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/navigation';
import { NotificationCard } from '@/components/notification';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { notificationsApi } from '@/services/api';
import { syncBadgeCount } from '@/services/push';
import { AppNotification } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  // State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Notifications
  // ---------------------------------------------------------------------------

  const fetchNotifications = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const response = await notificationsApi.getNotifications({
        page: pageNum,
        per_page: 20,
        is_read: showUnreadOnly ? false : undefined,
      });

      if (response.success) {
        const newNotifications = response.data.notifications.data;
        const pagination = response.data.notifications;

        if (pageNum === 1) {
          setNotifications(newNotifications);
        } else {
          setNotifications(prev => [...prev, ...newNotifications]);
        }

        setHasMore(pagination.current_page < pagination.last_page);
        setPage(pageNum);
      } else {
        setError('Failed to load notifications');
      }
    } catch (err) {
      setError('Failed to load notifications');
      if (__DEV__) console.error('[Notifications] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [showUnreadOnly]);

  // Initial load
  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchNotifications(1, true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      fetchNotifications(page + 1);
    }
  };

  const handleToggleFilter = () => {
    setShowUnreadOnly(prev => !prev);
    setPage(1);
    setNotifications([]);
    // Will refetch via useEffect when showUnreadOnly changes
  };

  const handleMarkAllAsRead = async () => {
    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (unreadCount === 0) {
      Alert.alert('All Caught Up', 'No unread notifications');
      return;
    }

    Alert.alert(
      'Mark All as Read',
      `Mark ${unreadCount} notification${unreadCount > 1 ? 's' : ''} as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: async () => {
            try {
              const response = await notificationsApi.markAllAsRead();
              if (response.success) {
                setNotifications(prev =>
                  prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
                );
                syncBadgeCount(0);
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to mark notifications as read');
            }
          },
        },
      ]
    );
  };

  const handleMoreOptions = () => {
    handleMarkAllAsRead();
  };

  const handleNotificationPress = async (notification: AppNotification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      try {
        const response = await notificationsApi.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        if (response.success) {
          syncBadgeCount(response.data.unread_count);
        }
      } catch (err) {
        // Silent fail - still navigate
      }
    }

    // Navigate using route object (new API) or fallback to legacy action_url
    navigateToRoute(notification);
  };

  const navigateToRoute = (notification: AppNotification) => {
    try {
      const route = notification.route;

      // Handle route object from API
      if (route && route.name && route.params) {
        const { name, params } = route;

        // Map API route names to app routes
        switch (name) {
          case 'space_feed':
            // Route to feed by slug: { space: "slug", feed_slug: "slug" }
            if (params.feed_slug) {
              router.push(`/feed/${params.feed_slug}`);
              return;
            }
            break;

          case 'feed':
          case 'feed_detail':
            // Route to feed: { id, slug, or feed_slug }
            const feedId = params.id || params.slug || params.feed_slug;
            if (feedId) {
              router.push(`/feed/${feedId}`);
              return;
            }
            break;

          case 'space':
          case 'space_detail':
            // Route to space: { slug or space }
            const spaceSlug = params.slug || params.space;
            if (spaceSlug) {
              router.push(`/space/${spaceSlug}`);
              return;
            }
            break;

          case 'profile':
          case 'user_profile':
            // Route to profile: { username or user }
            const username = params.username || params.user;
            if (username) {
              router.push(`/profile/${username}`);
              return;
            }
            break;

          // Course routes - not yet implemented in app
          // case 'course':
          // case 'course_detail':
          //   break;
        }
      }

      // Fallback: Navigate to actor's profile if available
      if (notification.xprofile?.username) {
        router.push(`/profile/${notification.xprofile.username}`);
        return;
      }

      if (__DEV__) console.log('[Notifications] Could not determine navigation for:', notification.route);
    } catch (err) {
      if (__DEV__) console.error('[Notifications] Navigation error:', err);
    }
  };

  const handleMarkAsRead = async (notification: AppNotification) => {
    try {
      const response = await notificationsApi.markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      if (response.success) {
        syncBadgeCount(response.data.unread_count);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to mark as read');
    }
  };


  const handleAvatarPress = (notification: AppNotification) => {
    if (notification.xprofile?.username) {
      router.push(`/profile/${notification.xprofile.username}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIconContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
          <Ionicons
            name={showUnreadOnly ? 'checkmark-circle-outline' : 'notifications-outline'}
            size={64}
            color={themeColors.textTertiary}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
          {showUnreadOnly ? 'All Caught Up!' : 'No Notifications'}
        </Text>
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          {showUnreadOnly
            ? "You've read all your notifications."
            : "When you receive notifications, they'll appear here."}
        </Text>
        {showUnreadOnly && (
          <Pressable style={styles.showAllButton} onPress={handleToggleFilter}>
            <Text style={[styles.showAllButtonText, { color: themeColors.primary }]}>Show All Notifications</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  };

  const renderHeader = () => {
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
      <View style={[styles.filterBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <Pressable
          style={[styles.filterButton, { backgroundColor: themeColors.backgroundSecondary }, !showUnreadOnly && [styles.filterButtonActive, { backgroundColor: themeColors.primary }]]}
          onPress={() => showUnreadOnly && handleToggleFilter()}
        >
          <Text style={[styles.filterButtonText, { color: themeColors.textSecondary }, !showUnreadOnly && [styles.filterButtonTextActive, { color: themeColors.textInverse }]]}>
            All
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, { backgroundColor: themeColors.backgroundSecondary }, showUnreadOnly && [styles.filterButtonActive, { backgroundColor: themeColors.primary }]]}
          onPress={() => !showUnreadOnly && handleToggleFilter()}
        >
          <Text style={[styles.filterButtonText, { color: themeColors.textSecondary }, showUnreadOnly && [styles.filterButtonTextActive, { color: themeColors.textInverse }]]}>
            Unread
            {unreadCount > 0 && !showUnreadOnly && (
              <Text style={styles.filterBadge}> ({unreadCount})</Text>
            )}
          </Text>
        </Pressable>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <GestureHandlerRootView style={[styles.gestureRoot, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: themeColors.background }]}>
        {/* Header - Using PageHeader for consistency */}
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Notifications"
          rightIcon="settings-outline"
          onRightPress={handleMoreOptions}
        />
        {loading && notifications.length === 0 ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => fetchNotifications(1)} />
        ) : (
          <FlashList
            data={notifications}
            renderItem={({ item }) => (
              <NotificationCard
                notification={item}
                onPress={handleNotificationPress}
                onMarkAsRead={handleMarkAsRead}
                onAvatarPress={handleAvatarPress}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[themeColors.primary]}
                tintColor={themeColors.primary}
              />
            }
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },

  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },

  filterButtonActive: {},

  filterButtonText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },

  filterButtonTextActive: {},

  filterBadge: {
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: 100,
  },

  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  emptyTitle: {
    fontSize: typography.size.xl,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  emptyText: {
    fontSize: typography.size.md,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.lg,
  },

  showAllButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },

  showAllButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});