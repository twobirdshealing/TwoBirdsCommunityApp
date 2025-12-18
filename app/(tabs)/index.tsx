// =============================================================================
// HOME SCREEN - Welcome page with user greeting
// =============================================================================
// Simple welcome placeholder with avatar and greeting
// Future: Quick stats, highlights, action buttons
// =============================================================================

import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { profilesApi } from '@/services/api';
import { Profile } from '@/types';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Profile
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.username) return;

      try {
        const response = await profilesApi.getProfile(user.username);
        if (response.success && response.data.profile) {
          setProfile(response.data.profile);
        }
      } catch (err) {
        // Silent fail
      }
    };

    fetchProfile();
  }, [user?.username]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const displayName = profile?.display_name || user?.username || 'there';
  const firstName = displayName.split(' ')[0]; // Get first name
  const avatar = profile?.avatar;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{firstName}! 👋</Text>

        {/* Placeholder for future content */}
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Your personalized dashboard is coming soon
          </Text>
        </View>
      </View>
    </View>
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

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
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
    backgroundColor: colors.skeleton,
  },

  avatarPlaceholder: {
    backgroundColor: colors.primary,
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
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },

  name: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xl,
  },

  // Placeholder
  placeholder: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    marginTop: spacing.lg,
  },

  placeholderText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
