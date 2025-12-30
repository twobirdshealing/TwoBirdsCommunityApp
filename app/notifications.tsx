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

import { NotificationCard } from '@/components/notification';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { notificationsApi } from '@/services/api';
import { Notification } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
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

  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      console.error('[Notifications] Fetch error:', err);
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
                // Update local state
                setNotifications(prev =>
                  prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
                );
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
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Mark All as Read', 'Delete All'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        async buttonIndex => {
          if (buttonIndex === 1) {
            handleMarkAllAsRead();
          } else if (buttonIndex === 2) {
            handleDeleteAll();
          }
        }
      );
    } else {
      Alert.alert('Options', 'Choose an action', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark All as Read', onPress: handleMarkAllAsRead },
        { text: 'Delete All', style: 'destructive', onPress: handleDeleteAll },
      ]);
    }
  };

  const handleDeleteAll = () => {
    if (notifications.length === 0) {
      Alert.alert('No Notifications', 'Nothing to delete');
      return;
    }

    Alert.alert(
      'Delete All Notifications',
      'This cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await notificationsApi.deleteAllNotifications();
              if (response.success) {
                setNotifications([]);
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to delete notifications');
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      try {
        await notificationsApi.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n =>
            n.id === notification.id
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
      } catch (err) {
        // Silent fail - still navigate
      }
    }

    // Navigate based on action_url
    if (notification.action_url) {
      navigateToAction(notification.action_url, notification);
    }
  };

  const navigateToAction = (actionUrl: string, notification: Notification) => {
    // Parse action_url and navigate to appropriate screen
    // Examples:
    // - /feeds/123#comment-45 -> feed detail
    // - /portal/post/slug -> feed detail
    // - /spaces/slug -> space detail
    // - /profile/username -> profile

    try {
      // Feed/post URLs
      if (actionUrl.includes('/feeds/') || actionUrl.includes('/post/')) {
        const feedMatch = actionUrl.match(/\/feeds\/(\d+)/) || actionUrl.match(/\/post\/([^/#]+)/);
        if (feedMatch) {
          router.push(`/feed/${feedMatch[1]}`);
          return;
        }
      }

      // Space URLs
      if (actionUrl.includes('/spaces/')) {
        const spaceMatch = actionUrl.match(/\/spaces\/([^/#]+)/);
        if (spaceMatch) {
          router.push(`/space/${spaceMatch[1]}`);
          return;
        }
      }

      // Profile URLs
      if (actionUrl.includes('/profile/')) {
        const profileMatch = actionUrl.match(/\/profile\/([^/#]+)/);
        if (profileMatch) {
          router.push(`/profile/${profileMatch[1]}`);
          return;
        }
      }

      // If we can't parse, try navigating to actor's profile
      if (notification.xprofile?.username) {
        router.push(`/profile/${notification.xprofile.username}`);
      }
    } catch (err) {
      console.error('[Notifications] Navigation error:', err);
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    try {
      await notificationsApi.markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to mark as read');
    }
  };

  const handleDelete = async (notification: Notification) => {
    try {
      await notificationsApi.deleteNotification(notification.id);
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    } catch (err) {
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const handleAvatarPress = (notification: Notification) => {
    if (notification.xprofile?.username) {
      router.push(`/profile/${notification.xprofile.username}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationCard
      notification={item}
      onPress={handleNotificationPress}
      onMarkAsRead={handleMarkAsRead}
      onDelete={handleDelete}
      onAvatarPress={handleAvatarPress}
    />
  );

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons
            name={showUnreadOnly ? 'checkmark-circle-outline' : 'notifications-outline'}
            size={64}
            color={colors.textTertiary}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {showUnreadOnly ? 'All Caught Up!' : 'No Notifications'}
        </Text>
        <Text style={styles.emptyText}>
          {showUnreadOnly
            ? "You've read all your notifications."
            : "When you receive notifications, they'll appear here."}
        </Text>
        {showUnreadOnly && (
          <Pressable style={styles.showAllButton} onPress={handleToggleFilter}>
            <Text style={styles.showAllButtonText}>Show All Notifications</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderHeader = () => {
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
      <View style={styles.filterBar}>
        <Pressable
          style={[styles.filterButton, !showUnreadOnly && styles.filterButtonActive]}
          onPress={() => showUnreadOnly && handleToggleFilter()}
        >
          <Text style={[styles.filterButtonText, !showUnreadOnly && styles.filterButtonTextActive]}>
            All
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, showUnreadOnly && styles.filterButtonActive]}
          onPress={() => !showUnreadOnly && handleToggleFilter()}
        >
          <Text style={[styles.filterButtonText, showUnreadOnly && styles.filterButtonTextActive]}>
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
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerShown: true,
          headerBackTitle: 'Back',
          headerRight: () => (
            <Pressable onPress={handleMoreOptions} style={styles.headerButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {loading && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => fetchNotifications(1)}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <FlashList
            data={notifications}
            renderItem={renderNotification}
            estimatedItemSize={80}
            keyExtractor={item => item.id.toString()}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
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
    backgroundColor: colors.background,
  },

  // Header
  headerButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm,
  },

  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },

  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
  },

  filterButtonActive: {
    backgroundColor: colors.primary,
  },

  filterButtonText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  filterButtonTextActive: {
    color: colors.textInverse,
  },

  filterBadge: {
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  errorText: {
    fontSize: typography.size.md,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },

  retryButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textInverse,
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
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  emptyTitle: {
    fontSize: typography.size.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
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
    color: colors.primary,
  },

  // Footer
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});