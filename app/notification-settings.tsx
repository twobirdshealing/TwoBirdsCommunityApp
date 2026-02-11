// =============================================================================
// NOTIFICATION SETTINGS SCREEN - User push notification preferences
// =============================================================================
// Fetches notification types from TBC-CA plugin API and allows user to toggle
// each notification type on/off.
// =============================================================================

import { PageHeader } from '@/components/navigation';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { FEATURES } from '@/constants/config';
import { getPushSettings, updatePushSettings, PushPreference } from '@/services/api/push';
import { isPushAvailable } from '@/services/push';
import { getAuthToken } from '@/services/auth';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CategoryPreferences {
  [category: string]: PushPreference[];
}

// -----------------------------------------------------------------------------
// Toggle Component
// -----------------------------------------------------------------------------

interface ToggleRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, enabled, onToggle, disabled = false }: ToggleRowProps) {
  const { colors: themeColors } = useTheme();
  return (
    <Pressable
      style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}
      onPress={disabled ? undefined : onToggle}
      disabled={disabled}
    >
      <View style={styles.toggleContent}>
        <Text style={[styles.toggleLabel, { color: themeColors.text }, disabled && styles.toggleLabelDisabled, disabled && { color: themeColors.textTertiary }]}>
          {label}
        </Text>
        <Text style={[styles.toggleDescription, { color: themeColors.textSecondary }, disabled && styles.toggleDescriptionDisabled, disabled && { color: themeColors.textTertiary }]}>
          {description}
        </Text>
      </View>
      <View
        style={[
          styles.toggle,
          { backgroundColor: themeColors.border },
          enabled && styles.toggleEnabled,
          enabled && { backgroundColor: themeColors.primary },
          disabled && styles.toggleDisabled,
          disabled && { backgroundColor: themeColors.skeleton },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            { backgroundColor: themeColors.surface },
            enabled && styles.toggleThumbEnabled,
          ]}
        />
      </View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  // State
  const [preferences, setPreferences] = useState<CategoryPreferences>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Check Push Available
  // ---------------------------------------------------------------------------

  const pushAvailable = isPushAvailable();
  const pushEnabled = FEATURES.PUSH_NOTIFICATIONS;

  // ---------------------------------------------------------------------------
  // Fetch Settings
  // ---------------------------------------------------------------------------

  const fetchSettings = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      setError(null);

      // Get auth token
      const authToken = await getAuthToken();
      if (!authToken) {
        setError('Not authenticated');
        return;
      }

      const response = await getPushSettings(authToken);

      if (!response.success) {
        setError(response.error || 'Failed to load notification settings');
        return;
      }

      // API returns { success, preferences: { category: [...prefs] }, device_count }
      if (response.data?.preferences) {
        setPreferences(response.data.preferences);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (pushEnabled) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [fetchSettings, pushEnabled]);

  // ---------------------------------------------------------------------------
  // Toggle Handler
  // ---------------------------------------------------------------------------

  const handleToggle = async (prefId: string, currentEnabled: boolean) => {
    // Add to saving state
    setSavingIds(prev => new Set(prev).add(prefId));

    // Optimistic update
    setPreferences(prev => {
      const updated = { ...prev };
      for (const category of Object.keys(updated)) {
        updated[category] = updated[category].map(pref => {
          if (pref.id === prefId) {
            return { ...pref, enabled: !currentEnabled };
          }
          return pref;
        });
      }
      return updated;
    });

    try {
      // Get auth token
      const authToken = await getAuthToken();
      if (!authToken) {
        throw new Error('Not authenticated');
      }

      const response = await updatePushSettings(authToken, { [prefId]: !currentEnabled });

      if (!response.success) {
        // Revert on failure
        setPreferences(prev => {
          const updated = { ...prev };
          for (const category of Object.keys(updated)) {
            updated[category] = updated[category].map(pref => {
              if (pref.id === prefId) {
                return { ...pref, enabled: currentEnabled };
              }
              return pref;
            });
          }
          return updated;
        });
      }
    } catch (err) {
      // Revert on error
      setPreferences(prev => {
        const updated = { ...prev };
        for (const category of Object.keys(updated)) {
          updated[category] = updated[category].map(pref => {
            if (pref.id === prefId) {
              return { ...pref, enabled: currentEnabled };
            }
            return pref;
          });
        }
        return updated;
      });
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(prefId);
        return next;
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const formatCategoryTitle = (category: string): string => {
    // Convert snake_case to Title Case
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Push not available on this device
  if (!pushAvailable) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
          <PageHeader
            leftAction="back"
            onLeftPress={() => router.back()}
            title="Notifications"
          />
          <View style={styles.centerContent}>
            <Ionicons name="phone-portrait-outline" size={48} color={themeColors.textTertiary} />
            <Text style={[styles.unavailableTitle, { color: themeColors.text }]}>Push Notifications Unavailable</Text>
            <Text style={[styles.unavailableText, { color: themeColors.textSecondary }]}>
              Push notifications require a physical device. They are not available in simulators or emulators.
            </Text>
          </View>
        </View>
      </>
    );
  }

  // Push disabled in config
  if (!pushEnabled) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
          <PageHeader
            leftAction="back"
            onLeftPress={() => router.back()}
            title="Notifications"
          />
          <View style={styles.centerContent}>
            <Ionicons name="notifications-off-outline" size={48} color={themeColors.textTertiary} />
            <Text style={[styles.unavailableTitle, { color: themeColors.text }]}>Push Notifications Disabled</Text>
            <Text style={[styles.unavailableText, { color: themeColors.textSecondary }]}>
              Push notifications are currently disabled. Contact support if you believe this is an error.
            </Text>
          </View>
        </View>
      </>
    );
  }

  // Loading state
  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
          <PageHeader
            leftAction="back"
            onLeftPress={() => router.back()}
            title="Notifications"
          />
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        </View>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
          <PageHeader
            leftAction="back"
            onLeftPress={() => router.back()}
            title="Notifications"
          />
          <View style={styles.centerContent}>
            <Ionicons name="alert-circle-outline" size={48} color={themeColors.error} />
            <Text style={[styles.errorTitle, { color: themeColors.text }]}>Failed to Load</Text>
            <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
              {error}
            </Text>
            <Pressable style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={() => fetchSettings()}>
              <Text style={[styles.retryButtonText, { color: themeColors.surface }]}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  const categories = Object.keys(preferences);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Notifications"
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchSettings(true)}
              colors={[themeColors.primary]}
              tintColor={themeColors.primary}
            />
          }
        >
          {/* Header Info */}
          <View style={[styles.headerInfo, { backgroundColor: themeColors.surface }]}>
            <Ionicons name="notifications" size={40} color={themeColors.primary} />
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Push Notifications</Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              Choose which notifications you want to receive on your device
            </Text>
          </View>

          {/* No preferences available */}
          {categories.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                No notification settings available at this time.
              </Text>
            </View>
          )}

          {/* Categories */}
          {categories.map(category => (
            <View key={category} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: themeColors.textSecondary }]}>
                {formatCategoryTitle(category)}
              </Text>
              <View style={[styles.categoryCard, { backgroundColor: themeColors.surface }]}>
                {preferences[category].map((pref, index) => (
                  <React.Fragment key={pref.id}>
                    {index > 0 && <View style={[styles.divider, { backgroundColor: themeColors.border }]} />}
                    <ToggleRow
                      label={pref.label}
                      description={pref.description}
                      enabled={pref.enabled}
                      onToggle={() => handleToggle(pref.id, pref.enabled)}
                      disabled={savingIds.has(pref.id)}
                    />
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}

          {/* Bottom padding */}
          <View style={{ height: insets.bottom + spacing.xl }} />
        </ScrollView>
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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: spacing.xl,
  },

  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Header Info
  headerInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    marginTop: spacing.md,
  },

  headerSubtitle: {
    fontSize: typography.size.md,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Unavailable states
  unavailableTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    marginTop: spacing.md,
    textAlign: 'center',
  },

  unavailableText: {
    fontSize: typography.size.md,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Error state
  errorTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    marginTop: spacing.md,
  },

  errorText: {
    fontSize: typography.size.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },

  retryButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: '#fff',
  },

  // Empty state
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },

  // Category
  categorySection: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },

  categoryTitle: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  categoryCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  divider: {
    height: 1,
    marginLeft: spacing.md,
  },

  // Toggle Row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },

  toggleRowDisabled: {
    opacity: 0.6,
  },

  toggleContent: {
    flex: 1,
    marginRight: spacing.md,
  },

  toggleLabel: {
    fontSize: typography.size.md,
    fontWeight: '500',
  },

  toggleLabelDisabled: {
  },

  toggleDescription: {
    fontSize: typography.size.sm,
    marginTop: 2,
  },

  toggleDescriptionDisabled: {
  },

  // Custom Toggle (not using Switch for consistency)
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },

  toggleEnabled: {
  },

  toggleDisabled: {
  },

  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  toggleThumbEnabled: {
    alignSelf: 'flex-end',
  },
});
