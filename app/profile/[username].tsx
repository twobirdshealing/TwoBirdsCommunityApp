// =============================================================================
// USER PROFILE SCREEN - Unified profile view
// =============================================================================
// Route: /profile/[username]
// Works for viewing your OWN profile and OTHER users' profiles
// Shows different actions based on isOwnProfile:
//   - Own: Edit Profile, change avatar
//   - Other: Follow, Message
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { profilesApi, patchProfileMedia } from '@/services/api';
import { updateStoredUser } from '@/services/auth';
import { showAvatarPicker, showCoverPicker } from '@/utils/avatarPicker';
import { Profile } from '@/types';
import { DropdownMenu } from '@/components/common';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';

import { AboutTab, ProfileHeader, ProfileMenu } from '@/components/profile';
import { PageHeader } from '@/components/navigation';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const { colors: themeColors } = useTheme();

  // Check if viewing own profile
  const isOwnProfile = currentUser?.username === username;

  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatar/cover upload state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Settings menu state (own profile only)
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Other-user menu state (block etc.)
  const [otherMenuVisible, setOtherMenuVisible] = useState(false);

  // Follow state (for other users only)
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Block state (for other users only)
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

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
        // Init follow state from API (FollowHandler injects follow level)
        setIsFollowing((response.data.profile.follow || 0) > 0);
        // Init block state from API (BlockHandler injects is_blocked_by_you)
        setIsBlocked(response.data.profile.is_blocked_by_you === true);
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

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchProfile(true);
  };

  const handleFollowPress = async () => {
    if (!username || followLoading || isOwnProfile) return;

    try {
      setFollowLoading(true);

      if (isFollowing) {
        await profilesApi.unfollowUser(username);
        setIsFollowing(false);
        if (profile) {
          setProfile({
            ...profile,
            followers_count: Math.max(0, (profile.followers_count || 0) - 1),
          });
        }
      } else {
        await profilesApi.followUser(username);
        setIsFollowing(true);
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

  const handleBlockPress = () => {
    if (!username || blockLoading) return;

    const action = isBlocked ? 'Unblock' : 'Block';
    const message = isBlocked
      ? `Are you sure you want to unblock ${profile?.display_name || 'this user'}?`
      : `Blocking this user will hide their posts from your feed and prevent them from interacting with you.`;

    Alert.alert(`${action} User`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: isBlocked ? 'default' : 'destructive',
        onPress: async () => {
          try {
            setBlockLoading(true);

            if (isBlocked) {
              const result = await profilesApi.unblockUser(username);
              if (result.success) {
                setIsBlocked(false);
              } else {
                Alert.alert('Error', 'Failed to unblock user');
              }
            } else {
              const result = await profilesApi.blockUser(username);
              if (result.success) {
                setIsBlocked(true);
                setIsFollowing(false);
              } else {
                Alert.alert('Error', 'Failed to block user');
              }
            }
          } catch (err) {
            console.error('Block action failed:', err);
            Alert.alert('Error', `Failed to ${action.toLowerCase()} user`);
          } finally {
            setBlockLoading(false);
          }
        },
      },
    ]);
  };

  const handleMessagePress = () => {
    if (!profile) return;
    router.push({
      pathname: '/messages/user/[userId]',
      params: {
        userId: String(profile.user_id),
        displayName: profile.display_name,
        avatar: profile.avatar || '',
      },
    } as any);
  };

  const handleEditProfilePress = () => {
    router.push('/profile/edit');
  };

  const handleCoverPhotoPress = () => {
    if (!isOwnProfile || !username) return;

    showCoverPicker({
      onUploadStart: (localUri) => {
        setCoverUploading(true);
        if (profile) {
          setProfile({ ...profile, cover_photo: localUri });
        }
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { cover_photo: remoteUrl });
        } catch (e) {
          // Fall through — cover was uploaded, just assignment failed
        }
        setCoverUploading(false);
        if (profile) {
          setProfile({ ...profile, cover_photo: remoteUrl });
        }
      },
      onError: (message) => {
        setCoverUploading(false);
        fetchProfile();
        Alert.alert('Upload Failed', message);
      },
    });
  };

  const handleAvatarPress = () => {
    if (!isOwnProfile || !username) return;

    showAvatarPicker({
      onUploadStart: (localUri) => {
        setAvatarUploading(true);
        if (profile) {
          setProfile({ ...profile, avatar: localUri });
        }
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { avatar: remoteUrl });
        } catch (e) {
          // Fall through — avatar was uploaded, just assignment failed
        }
        setAvatarUploading(false);
        if (profile) {
          setProfile({ ...profile, avatar: remoteUrl });
        }
        await updateStoredUser({ avatar: remoteUrl });
      },
      onError: (message) => {
        setAvatarUploading(false);
        fetchProfile();
        Alert.alert('Upload Failed', message);
      },
    });
  };

  const handleFollowersPress = () => {
    Alert.alert('Coming Soon', 'Followers list will be available soon.');
  };

  const handleFollowingPress = () => {
    Alert.alert('Coming Soon', 'Following list will be available soon.');
  };

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading && !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title={username ? `@${username}` : 'Profile'}
        />
        <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error
  // ---------------------------------------------------------------------------

  if (error && !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Profile"
        />
        <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
          <Text style={styles.errorIcon}>😔</Text>
          <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: themeColors.primary }]} onPress={() => fetchProfile()}>
            <Text style={[styles.retryButtonText, { color: themeColors.textInverse }]}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Profile
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <PageHeader
        leftAction="back"
        onLeftPress={() => router.back()}
        title={profile?.display_name || `@${username}`}
        rightElement={
          <Pressable
            onPress={() => isOwnProfile ? setSettingsVisible(true) : setOtherMenuVisible(true)}
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="settings-outline" size={22} color={themeColors.text} />
          </Pressable>
        }
      />
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          }
        >
          {/* Profile Header */}
          <ProfileHeader
            profile={profile!}
            isOwnProfile={isOwnProfile}
            isUploading={avatarUploading}
            onCoverPhotoPress={handleCoverPhotoPress}
            onAvatarPress={handleAvatarPress}
            onFollowersPress={handleFollowersPress}
            onFollowingPress={handleFollowingPress}
          />

          {/* Action Buttons (other profiles only) */}
          {!isOwnProfile && (
            <View style={[styles.actionButtons, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
              {isBlocked ? (
                <Pressable
                  style={[styles.followButton, { backgroundColor: themeColors.error }]}
                  onPress={handleBlockPress}
                  disabled={blockLoading}
                >
                  {blockLoading ? (
                    <ActivityIndicator size="small" color={themeColors.textInverse} />
                  ) : (
                    <Text style={[styles.followButtonText, { color: themeColors.textInverse }]}>
                      Blocked
                    </Text>
                  )}
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={[
                      styles.followButton,
                      { backgroundColor: themeColors.primary },
                      isFollowing && [styles.followingButton, { borderColor: themeColors.primary }],
                    ]}
                    onPress={handleFollowPress}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={isFollowing ? themeColors.primary : themeColors.textInverse}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.followButtonText,
                          { color: themeColors.textInverse },
                          isFollowing && [styles.followingButtonText, { color: themeColors.primary }],
                        ]}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable style={[styles.messageButton, { backgroundColor: themeColors.backgroundSecondary }]} onPress={handleMessagePress}>
                    <Ionicons name="chatbubble-outline" size={20} color={themeColors.text} />
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* About Content */}
          <AboutTab profile={profile!} />
        </ScrollView>

      {/* Profile Settings Dropdown (own profile) */}
      {isOwnProfile && (
        <ProfileMenu
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
          onEditProfile={handleEditProfilePress}
        />
      )}

      {/* Other User Menu Dropdown (block) */}
      {!isOwnProfile && (
        <DropdownMenu
          visible={otherMenuVisible}
          onClose={() => setOtherMenuVisible(false)}
          items={[
            {
              key: 'block',
              label: isBlocked ? 'Unblock User' : 'Block User',
              icon: isBlocked ? 'person-add-outline' : 'ban-outline',
              onPress: () => { setOtherMenuVisible(false); handleBlockPress(); },
              destructive: !isBlocked,
            },
          ] as DropdownMenuItem[]}
        />
      )}
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

  scrollView: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.md,
  },

  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  errorText: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },

  retryButtonText: {
    fontWeight: '600',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
  },

  settingsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },

  followButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
  },

  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },

  followButtonText: {
    fontWeight: '600',
    fontSize: typography.size.md,
  },

  followingButtonText: {},

  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
