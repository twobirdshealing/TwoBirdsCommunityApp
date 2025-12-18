// =============================================================================
// USER PROFILE SCREEN - View other users' profiles
// =============================================================================
// Route: /profile/[username]
// This is for viewing OTHER users - not the logged-in user's own profile
// (The user's own profile is at app/(tabs)/profile.tsx)
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { profilesApi } from '@/services/api';
import { Profile, Feed } from '@/types';

// -----------------------------------------------------------------------------
// Helper: Format numbers
// -----------------------------------------------------------------------------

function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  
  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  
  // Check if viewing own profile (redirect to tabs profile)
  const isOwnProfile = currentUser?.username === username;

  // ---------------------------------------------------------------------------
  // Fetch Profile
  // ---------------------------------------------------------------------------

  const fetchProfile = useCallback(async (isRefresh = false) => {
    if (!username) {
      setError('User not found');
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await profilesApi.getProfile(username);

      if (response.success && response.data.profile) {
        setProfile(response.data.profile);
        // TODO: Check if current user is following this user
        // API doesn't seem to return this directly, may need separate call
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  useEffect(() => {
    // If viewing own profile, could redirect to tabs profile
    // But for now, just show it here too
    fetchProfile();
  }, [fetchProfile]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchProfile(true);
  };

  const handleFollowPress = async () => {
    if (!username || followLoading) return;
    
    try {
      setFollowLoading(true);
      
      if (isFollowing) {
        await profilesApi.unfollowUser(username);
        setIsFollowing(false);
        // Update follower count optimistically
        if (profile) {
          setProfile({
            ...profile,
            followers_count: Math.max(0, (profile.followers_count || 0) - 1),
          });
        }
      } else {
        await profilesApi.followUser(username);
        setIsFollowing(true);
        // Update follower count optimistically
        if (profile) {
          setProfile({
            ...profile,
            followers_count: (profile.followers_count || 0) + 1,
          });
        }
      }
    } catch (err) {
      console.error('Follow action failed:', err);
      Alert.alert('Error', 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessagePress = () => {
    Alert.alert(
      'Coming Soon',
      'Direct messaging will be available in a future update.',
      [{ text: 'OK' }]
    );
  };

  const handleFollowersPress = () => {
    // TODO: Navigate to followers list
    Alert.alert('Coming Soon', 'Followers list will be available soon.');
  };

  const handleFollowingPress = () => {
    // TODO: Navigate to following list
    Alert.alert('Coming Soon', 'Following list will be available soon.');
  };

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading && !profile) {
    return (
      <>
        <Stack.Screen
          options={{
            title: username ? `@${username}` : 'Profile',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error
  // ---------------------------------------------------------------------------

  if (error && !profile) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Profile',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>😔</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => fetchProfile()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Profile
  // ---------------------------------------------------------------------------

  const isVerified = profile?.is_verified === 1;
  const coverPhoto = profile?.cover_photo || profile?.meta?.cover_photo;

  return (
    <>
      <Stack.Screen
        options={{
          title: profile?.display_name || `@${username}`,
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          {coverPhoto ? (
            <Image source={{ uri: coverPhoto }} style={styles.coverPhoto} />
          ) : (
            <View style={[styles.coverPhoto, styles.coverPlaceholder]} />
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                  {(profile?.display_name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIcon}>✓</Text>
              </View>
            )}
          </View>

          {/* Name & Username */}
          <Text style={styles.displayName}>{profile?.display_name}</Text>
          <Text style={styles.username}>@{profile?.username}</Text>

          {/* Bio */}
          {profile?.short_description && (
            <Text style={styles.bio}>{profile.short_description}</Text>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <Pressable style={styles.stat} onPress={handleFollowingPress}>
              <Text style={styles.statValue}>
                {formatCompactNumber(profile?.followings_count || 0)}
              </Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>

            <View style={styles.statDivider} />

            <Pressable style={styles.stat} onPress={handleFollowersPress}>
              <Text style={styles.statValue}>
                {formatCompactNumber(profile?.followers_count || 0)}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </Pressable>

            {(profile?.total_points || 0) > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {formatCompactNumber(profile?.total_points || 0)}
                  </Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
              </>
            )}
          </View>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <View style={styles.actionButtons}>
              {/* Follow Button */}
              <Pressable
                style={[
                  styles.followButton,
                  isFollowing && styles.followingButton,
                ]}
                onPress={handleFollowPress}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={isFollowing ? colors.primary : '#fff'} />
                ) : (
                  <Text
                    style={[
                      styles.followButtonText,
                      isFollowing && styles.followingButtonText,
                    ]}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </Pressable>

              {/* Message Button */}
              <Pressable style={styles.messageButton} onPress={handleMessagePress}>
                <Text style={styles.messageButtonIcon}>💬</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Member Since */}
        {profile?.created_at && (
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>
              Member since {new Date(profile.created_at).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </View>
        )}

        {/* TODO: Add tabs for Posts, Comments, etc. */}
        {/* For now, just show basic profile info */}
        
      </ScrollView>
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

  contentContainer: {
    flexGrow: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  errorText: {
    fontSize: typography.size.md,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },

  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Cover Photo
  coverContainer: {
    height: 150,
    backgroundColor: colors.backgroundSecondary,
  },

  coverPhoto: {
    width: '100%',
    height: '100%',
  },

  coverPlaceholder: {
    backgroundColor: colors.primary + '30',
  },

  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  avatarContainer: {
    marginTop: -50,
    position: 'relative',
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.surface,
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

  verifiedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },

  verifiedIcon: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },

  displayName: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },

  username: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    marginTop: 2,
  },

  bio: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },

  stat: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },

  statValue: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    color: colors.text,
  },

  statLabel: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },

  followButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
  },

  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },

  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: typography.size.md,
  },

  followingButtonText: {
    color: colors.primary,
  },

  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messageButtonIcon: {
    fontSize: 20,
  },

  // Info Section
  infoSection: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },

  infoLabel: {
    fontSize: typography.size.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
