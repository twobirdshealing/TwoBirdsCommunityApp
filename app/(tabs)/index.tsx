// =============================================================================
// HOME SCREEN - Welcome page with user greeting and admin banner
// =============================================================================
// Greeting with avatar + admin-set Welcome Banner
// Future: Quick stats, highlights, action buttons
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { feedsApi, profilesApi } from '@/services/api';
import { Profile, WelcomeBanner as WelcomeBannerType } from '@/types';
import { WelcomeBanner } from '@/components/feed/WelcomeBanner';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [welcomeBanner, setWelcomeBanner] = useState<WelcomeBannerType | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch Welcome Banner
  // ---------------------------------------------------------------------------

  const fetchWelcomeBanner = useCallback(async () => {
    try {
      const response = await feedsApi.getWelcomeBanner();
      if (response.success && response.data?.welcome_banner) {
        setWelcomeBanner(response.data.welcome_banner);
      }
    } catch (err) {
      // Silent fail - banner is optional
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch Profile
  // ---------------------------------------------------------------------------

  const fetchProfile = useCallback(async () => {
    if (!user?.username) return;
    try {
      const response = await profilesApi.getProfile(user.username);
      if (response.success && response.data.profile) {
        setProfile(response.data.profile);
      }
    } catch (err) {
      // Silent fail
    }
  }, [user?.username]);

  // ---------------------------------------------------------------------------
  // Initial Load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchProfile();
    fetchWelcomeBanner();
  }, [fetchProfile, fetchWelcomeBanner]);

  // ---------------------------------------------------------------------------
  // Pull-to-Refresh
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchWelcomeBanner()]);
    setRefreshing(false);
  }, [fetchProfile, fetchWelcomeBanner]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const displayName = profile?.display_name || user?.username || 'there';
  const firstName = displayName.split(' ')[0]; // Get first name
  const avatar = profile?.avatar;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={[styles.avatar, { backgroundColor: themeColors.skeleton }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: themeColors.primary }]}>
                <Text style={styles.avatarText}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Greeting */}
          <Text style={[styles.greeting, { color: themeColors.textSecondary }]}>Welcome back,</Text>
          <Text style={[styles.name, { color: themeColors.text }]}>{firstName}! 👋</Text>
        </View>

        {/* Welcome Banner */}
        {welcomeBanner && welcomeBanner.enabled === 'yes' && (
          <WelcomeBanner banner={welcomeBanner} />
        )}
      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.xl,
  },

  greetingSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },

  // Avatar
  avatarContainer: {
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#fff',
  },

  // Greeting
  greeting: {
    fontSize: typography.size.xl,
    marginBottom: spacing.xs,
  },

  name: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.xl,
  },

});
