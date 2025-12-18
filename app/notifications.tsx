// =============================================================================
// NOTIFICATIONS SCREEN - User notifications
// =============================================================================
// Route: /notifications
// Navigated from header bell icon
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Types (Placeholder - update when API is connected)
// -----------------------------------------------------------------------------

interface Notification {
  id: number;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch Notifications (Placeholder)
  // ---------------------------------------------------------------------------

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // TODO: Connect to notifications API
      // const response = await notificationsApi.getNotifications();
      // setNotifications(response.data.notifications);
      
      // Placeholder: Empty for now
      await new Promise(resolve => setTimeout(resolve, 500));
      setNotifications([]);
      
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Loading State */}
        {loading && notifications.length === 0 && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {/* Empty State */}
        {!loading && notifications.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.iconContainer}>
              <Ionicons name="notifications-outline" size={64} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>
              When you receive notifications, they'll appear here.
            </Text>
          </View>
        )}

        {/* Notifications List */}
        {notifications.length > 0 && (
          <FlashList
            data={notifications}
            renderItem={({ item }) => (
              <View style={styles.notificationItem}>
                <Text style={styles.notificationText}>{item.message}</Text>
              </View>
            )}
            estimatedItemSize={80}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchNotifications(true)}
                tintColor={colors.primary}
                colors={[colors.primary]}
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
    backgroundColor: colors.background,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  iconContainer: {
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
    textAlign: 'center',
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  notificationItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  notificationText: {
    fontSize: typography.size.md,
    color: colors.text,
  },
});
