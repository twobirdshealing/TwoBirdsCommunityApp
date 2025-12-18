// =============================================================================
// USER PROFILE SCREEN - Unified profile view
// =============================================================================
// Route: /profile/[username]
// Works for viewing your OWN profile and OTHER users' profiles
// Shows different actions based on isOwnProfile:
//   - Own: Edit Profile
//   - Other: Follow, Message
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { profilesApi } from '@/services/api';
import { Profile, Feed, ProfileComment } from '@/types';

// Import existing profile components
import {
  AboutTab,
  CommentsTab,
  ProfileHeader,
  ProfileTab,
  ProfileTabs,
} from '@/components/profile';
import { FeedCard } from '@/components/feed';

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

  // Check if viewing own profile
  const isOwnProfile = currentUser?.username === username;

  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<ProfileTab>('about');

  // Tab content
  const [posts, setPosts] = useState<Feed[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // Follow state (for other users only)
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

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
    fetchProfile();
  }, [fetchProfile]);

  // ---------------------------------------------------------------------------
  // Fetch Tab Content
  // ---------------------------------------------------------------------------

  const fetchPosts = useCallback(async () => {
    if (!username || postsLoading) return;

    try {
      setPostsLoading(true);
      const response = await profilesApi.getUserPosts(username, {
        page: 1,
        per_page: 20,
      });

      if (response.success && response.data.feeds) {
        setPosts(response.data.feeds);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [username, postsLoading]);

  const fetchComments = useCallback(async () => {
    if (!username || commentsLoading) return;

    try {
      setCommentsLoading(true);
      const response = await profilesApi.getUserComments(username, {
        page: 1,
        per_page: 20,
      });

      if (response.success && response.data.comments) {
        setComments(response.data.comments);
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [username, commentsLoading]);

  // Load tab content when tab changes
  useEffect(() => {
    if (!profile) return;

    switch (activeTab) {
      case 'posts':
        if (posts.length === 0) fetchPosts();
        break;
      case 'comments':
        if (comments.length === 0) fetchComments();
        break;
    }
  }, [activeTab, profile, fetchPosts, fetchComments]);

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

  const handleMessagePress = () => {
    Alert.alert(
      'Coming Soon',
      'Direct messaging will be available in a future update.',
      [{ text: 'OK' }]
    );
  };

  const handleEditProfilePress = () => {
    // TODO: Navigate to edit profile screen
    Alert.alert('Coming Soon', 'Edit profile will be available soon.');
  };

  const handleCoverPhotoPress = () => {
    if (isOwnProfile) {
      Alert.alert('Coming Soon', 'Cover photo editing will be available soon.');
    }
  };

  const handleAvatarPress = () => {
    if (isOwnProfile) {
      Alert.alert('Coming Soon', 'Avatar editing will be available soon.');
    }
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
  // Render Tab Content
  // ---------------------------------------------------------------------------

  const renderTabContent = () => {
    switch (activeTab) {
      case 'about':
        return <AboutTab profile={profile!} />;

      case 'posts':
        if (postsLoading) {
          return (
            <View style={styles.tabLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          );
        }
        if (posts.length === 0) {
          return (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          );
        }
        return (
          <View style={styles.postsList}>
            {posts.map((post) => (
              <FeedCard
                key={post.id}
                feed={post}
                onPress={() => router.push(`/feed/${post.id}`)}
              />
            ))}
          </View>
        );

      case 'comments':
        if (commentsLoading) {
          return (
            <View style={styles.tabLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          );
        }
        if (comments.length === 0) {
          return (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>No comments yet</Text>
            </View>
          );
        }
        return <CommentsTab comments={comments} />;

      default:
        return null;
    }
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

  return (
    <>
      <Stack.Screen
        options={{
          title: profile?.display_name || `@${username}`,
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Profile Header */}
          <ProfileHeader
            profile={profile!}
            isOwnProfile={isOwnProfile}
            onCoverPhotoPress={handleCoverPhotoPress}
            onAvatarPress={handleAvatarPress}
            onFollowersPress={handleFollowersPress}
            onFollowingPress={handleFollowingPress}
          />

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {isOwnProfile ? (
              // Own Profile: Edit button
              <Pressable style={styles.editButton} onPress={handleEditProfilePress}>
                <Ionicons name="create-outline" size={18} color={colors.text} />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </Pressable>
            ) : (
              // Other's Profile: Follow + Message
              <>
                <Pressable
                  style={[
                    styles.followButton,
                    isFollowing && styles.followingButton,
                  ]}
                  onPress={handleFollowPress}
                  disabled={followLoading}
                >
                  {followLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={isFollowing ? colors.primary : '#fff'}
                    />
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

                <Pressable style={styles.messageButton} onPress={handleMessagePress}>
                  <Ionicons name="mail-outline" size={20} color={colors.text} />
                </Pressable>
              </>
            )}
          </View>

          {/* Tabs */}
          <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content */}
          <View style={styles.tabContent}>{renderTabContent()}</View>
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
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
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

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: 20,
    gap: spacing.xs,
  },

  editButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
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

  // Tab Content
  tabContent: {
    minHeight: 300,
  },

  tabLoading: {
    padding: spacing.xxl,
    alignItems: 'center',
  },

  emptyTab: {
    padding: spacing.xxl,
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  postsList: {
    padding: spacing.sm,
  },
});
