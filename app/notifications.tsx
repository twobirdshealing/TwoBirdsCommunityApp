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

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { createLogger } from '@/utils/logger';
import { NotificationCard } from '@/components/notification/NotificationCard';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { notificationsApi } from '@/services/api/notifications';
import { useUnreadCounts } from '@/contexts/UnreadCountsContext';
import { AppNotification } from '@/types/notification';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useAppQuery } from '@/hooks/useAppQuery';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const log = createLogger('Notifications');

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { setUnreadNotifications } = useUnreadCounts();

  // State
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [extraNotifications, setExtraNotifications] = useState<AppNotification[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch Page 1 (cached + focus refresh, dynamic key per filter)
  // ---------------------------------------------------------------------------

  interface NotificationsPage1 {
    notifications: AppNotification[];
    hasMore: boolean;
  }

  const {
    data: page1Data,
    isLoading: loading,
    isRefreshing: refreshing,
    error: fetchError,
    refresh,
    mutate,
  } = useAppQuery<NotificationsPage1>({
    cacheKey: `tbc_notifications_${showUnreadOnly ? 'unread' : 'all'}`,
    fetcher: async () => {
      const response = await notificationsApi.getNotifications({
        page: 1,
        per_page: 20,
        is_read: showUnreadOnly ? false : undefined,
      });

      if (!response.success) {
        throw new Error('Failed to load notifications');
      }

      const pagination = response.data.notifications;
      return {
        notifications: pagination.data,
        hasMore: pagination.current_page < pagination.last_page,
      };
    },
  });

  // Combined list: page 1 (cached) + pages 2+ (manual)
  const notifications = useMemo(
    () => [...(page1Data?.notifications || []), ...extraNotifications],
    [page1Data, extraNotifications],
  );
  const error = fetchError?.message || null;

  // Update hasMore from page 1 data when it loads
  // (subsequent pages update hasMore via loadMore)

  // Helper: update notifications across both page 1 cache and extra pages
  const updateNotifications = useCallback(
    (updater: (items: AppNotification[]) => AppNotification[]) => {
      mutate(prev => prev ? { ...prev, notifications: updater(prev.notifications) } : prev);
      setExtraNotifications(prev => updater(prev));
    },
    [mutate],
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    setExtraNotifications([]);
    setPage(1);
    setHasMore(true);
    refresh();
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    const effectiveHasMore = page === 1 ? (page1Data?.hasMore ?? true) : hasMore;
    if (!effectiveHasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await notificationsApi.getNotifications({
        page: nextPage,
        per_page: 20,
        is_read: showUnreadOnly ? false : undefined,
      });

      if (response.success) {
        const pagination = response.data.notifications;
        setExtraNotifications(prev => [...prev, ...pagination.data]);
        setHasMore(pagination.current_page < pagination.last_page);
        setPage(nextPage);
      }
    } catch (err) {
      log.error(err, 'Load more error');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleFilter = () => {
    setShowUnreadOnly(prev => !prev);
    setExtraNotifications([]);
    setPage(1);
    setHasMore(true);
    // Cache key changes → useAppQuery auto-loads the correct cache
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
                updateNotifications(items =>
                  items.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
                );
                setUnreadNotifications(0);
              }
            } catch {
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
        updateNotifications(items =>
          items.map(n =>
            n.id === notification.id
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        if (response.success) {
          setUnreadNotifications(response.data.unread_count);
        }
      } catch {
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

          case 'course':
          case 'course_detail':
            const courseSlug = params.slug || params.course;
            if (courseSlug) {
              router.push(`/courses/${courseSlug}`);
              return;
            }
            break;
        }
      }

      // Fallback: Navigate to actor's profile if available
      if (notification.xprofile?.username) {
        router.push(`/profile/${notification.xprofile.username}`);
        return;
      }

      log.debug('Could not determine navigation for:', { route: notification.route });
    } catch (err) {
      log.error(err, 'Navigation error');
    }
  };

  const handleMarkAsRead = async (notification: AppNotification) => {
    try {
      const response = await notificationsApi.markAsRead(notification.id);
      updateNotifications(items =>
        items.map(n =>
          n.id === notification.id
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      if (response.success) {
        setUnreadNotifications(response.data.unread_count);
      }
    } catch {
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
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        {/* Header - Using PageHeader for consistency */}
        <PageHeader
          left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />}
          center={<HeaderTitle>Notifications</HeaderTitle>}
          right={<HeaderIconButton icon="settings-outline" onPress={handleMoreOptions} />}
        />
        {loading && notifications.length === 0 ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => refresh()} />
        ) : (
          <FlashList
            data={notifications}
            contentContainerStyle={{ paddingBottom: insets.bottom }}
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
    borderRadius: sizing.borderRadius.lg,
  },

  filterButtonActive: {},

  filterButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  filterButtonTextActive: {},

  filterBadge: {
    fontWeight: typography.weight.semibold,
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
    borderRadius: sizing.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  emptyTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
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
    fontWeight: typography.weight.semibold,
  },

  // Footer
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});