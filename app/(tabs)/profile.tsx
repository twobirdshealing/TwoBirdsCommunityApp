// =============================================================================
// PROFILE SCREEN - User profile with tabs
// =============================================================================
// UPDATED: Removed Spaces tab (redundant with main Spaces screen)
// Now shows: About, Posts, Comments
// =============================================================================

import { ErrorMessage, LoadingSpinner } from '@/components/common';
import { FeedCard } from '@/components/feed';
import {
  AboutTab,
  CommentsTab,
  ProfileHeader,
  ProfileTab,
  ProfileTabs,
  SettingsModal,
} from '@/components/profile';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { profilesApi } from '@/services/api';
import { Feed, Profile, ProfileComment } from '@/types';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
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
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch Profile
  // ---------------------------------------------------------------------------

  const fetchProfile = useCallback(async (isRefresh: boolean = false) => {
    if (!user?.username) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await profilesApi.getProfile(user.username);

      if (response.success && response.data.profile) {
        setProfile(response.data.profile);
      } else {
        throw new Error('Failed to load profile');
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ---------------------------------------------------------------------------
  // Fetch Tab Content
  // ---------------------------------------------------------------------------

  const fetchPosts = useCallback(async () => {
    if (!user?.username || postsLoading) return;

    try {
      setPostsLoading(true);
      const response = await profilesApi.getUserPosts(user.username, {
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
  }, [user?.username, postsLoading]);

  const fetchComments = useCallback(async () => {
    if (!user?.username || commentsLoading) return;

    try {
      setCommentsLoading(true);
      const response = await profilesApi.getUserComments(user.username, {
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
  }, [user?.username, commentsLoading]);

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
  // Handlers (Phase 2 placeholders)
  // ---------------------------------------------------------------------------

  const handleCoverPhotoPress = () => {
    // TODO Phase 2: Open image picker for cover photo
    console.log('Edit cover photo - Phase 2');
  };

  const handleAvatarPress = () => {
    // TODO Phase 2: Open image picker for avatar
    console.log('Edit avatar - Phase 2');
  };

  // ---------------------------------------------------------------------------
  // Render Tab Content
  // ---------------------------------------------------------------------------

  const renderTabContent = () => {
    switch (activeTab) {
      case 'about':
        return <AboutTab profile={profile} />;

      case 'posts':
        if (postsLoading) {
          return (
            <View style={styles.tabLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
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
              <FeedCard key={post.id} feed={post} />
            ))}
          </View>
        );

      case 'comments':
        if (commentsLoading) {
          return (
            <View style={styles.tabLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          );
        }

        return <CommentsTab comments={comments} loading={commentsLoading} />;

      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Render States
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <LoadingSpinner message="Loading profile..." />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ErrorMessage
          message={error || 'Profile not found'}
          onRetry={() => fetchProfile(false)}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchProfile(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Profile Header */}
        <ProfileHeader
          profile={profile}
          isOwnProfile={true}
          onSettingsPress={() => setShowSettings(true)}
          onCoverPhotoPress={handleCoverPhotoPress}
          onAvatarPress={handleAvatarPress}
        />

        {/* Tabs */}
        <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        userName={profile.display_name}
        userEmail={profile.email}
      />
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

  scrollView: {
    flex: 1,
  },

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