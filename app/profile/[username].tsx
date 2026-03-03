// =============================================================================
// USER PROFILE SCREEN - Unified profile view
// =============================================================================
// Route: /profile/[username]
// Works for viewing your OWN profile and OTHER users' profiles
// Shows different actions based on isOwnProfile:
//   - Own: Edit Profile, change avatar
//   - Other: Follow, Message
// =============================================================================

import React, { useState } from 'react';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCachedData } from '@/hooks/useCachedData';
import { profilesApi, patchProfileMedia } from '@/services/api/profiles';
import { updateStoredUser } from '@/services/auth';
import { showAvatarPicker, showCoverPicker } from '@/utils/avatarPicker';
import { Profile } from '@/types/user';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';

import { AboutTab } from '@/components/profile/AboutTab';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { PageHeader } from '@/components/navigation/PageHeader';

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

  // Fetch Profile (refreshOnFocus replaces useFocusEffect)
  const { data: profile, isLoading: loading, isRefreshing: refreshing, error: fetchError, refresh, mutate } = useCachedData<Profile>({
    cacheKey: `tbc_profile_${username}`,
    fetcher: async () => {
      const response = await profilesApi.getProfile(username!);
      if (response.success && response.data.profile) {
        return response.data.profile;
      }
      throw new Error('Failed to load profile');
    },
    enabled: !!username,
  });
  const error = fetchError?.message || null;

  // Derived state from profile data
  const isFollowing = (profile?.follow || 0) > 0;
  const isBlocked = profile?.is_blocked_by_you === true;

  // Avatar/cover upload state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Settings menu state (own profile only)
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Other-user menu state (block etc.)
  const [otherMenuVisible, setOtherMenuVisible] = useState(false);

  // Follow/Block loading (UI-only state)
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    refresh();
  };

  const handleFollowPress = async () => {
    if (!username || followLoading || isOwnProfile) return;

    try {
      setFollowLoading(true);

      if (isFollowing) {
        await profilesApi.unfollowUser(username);
        mutate(prev => prev ? {
          ...prev,
          follow: 0,
          followers_count: Math.max(0, (prev.followers_count || 0) - 1),
        } : prev);
      } else {
        await profilesApi.followUser(username);
        mutate(prev => prev ? {
          ...prev,
          follow: 1,
          followers_count: (prev.followers_count || 0) + 1,
        } : prev);
      }
    } catch (err) {
      if (__DEV__) console.error('Follow action failed:', err);
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
                mutate(prev => prev ? { ...prev, is_blocked_by_you: false } : prev);
              } else {
                Alert.alert('Error', 'Failed to unblock user');
              }
            } else {
              const result = await profilesApi.blockUser(username);
              if (result.success) {
                mutate(prev => prev ? { ...prev, is_blocked_by_you: true, follow: 0 } : prev);
              } else {
                Alert.alert('Error', 'Failed to block user');
              }
            }
          } catch (err) {
            if (__DEV__) console.error('Block action failed:', err);
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
        mutate(prev => prev ? { ...prev, cover_photo: localUri } : prev);
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { cover_photo: remoteUrl });
        } catch (e) {
          // Fall through — cover was uploaded, just assignment failed
        }
        setCoverUploading(false);
        mutate(prev => prev ? { ...prev, cover_photo: remoteUrl } : prev);
      },
      onError: (message) => {
        setCoverUploading(false);
        refresh();
        Alert.alert('Upload Failed', message);
      },
    });
  };

  const handleAvatarPress = () => {
    if (!isOwnProfile || !username) return;

    showAvatarPicker({
      onUploadStart: (localUri) => {
        setAvatarUploading(true);
        mutate(prev => prev ? { ...prev, avatar: localUri } : prev);
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { avatar: remoteUrl });
        } catch (e) {
          // Fall through — avatar was uploaded, just assignment failed
        }
        setAvatarUploading(false);
        mutate(prev => prev ? { ...prev, avatar: remoteUrl } : prev);
        await updateStoredUser({ avatar: remoteUrl });
      },
      onError: (message) => {
        setAvatarUploading(false);
        refresh();
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
        <LoadingSpinner message="Loading profile..." />
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
        <ErrorMessage message={error} onRetry={refresh} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Profile
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
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
          contentContainerStyle={{ paddingBottom: insets.bottom }}
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

          {/* About Content — hidden when profile is restricted (FC 2.2.01+ privacy) */}
          {profile?.is_restricted ? (
            <View style={[styles.restrictedContainer, { backgroundColor: themeColors.surface }]}>
              <Ionicons name="lock-closed-outline" size={32} color={themeColors.textTertiary} />
              <Text style={[styles.restrictedTitle, { color: themeColors.text }]}>Profile is Private</Text>
              <Text style={[styles.restrictedText, { color: themeColors.textSecondary }]}>
                This user's profile details are not visible.
              </Text>
            </View>
          ) : (
            <AboutTab profile={profile!} />
          )}
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

  restrictedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },

  restrictedTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
  },

  restrictedText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },
});
