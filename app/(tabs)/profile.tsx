// =============================================================================
// PROFILE SCREEN - User profile with tabs
// =============================================================================
// Matches native Fluent Community profile layout:
// - Cover photo + avatar (clickable for editing)
// - Display name, username, bio
// - Following/Followers stats
// - Tabs: About, Posts, Spaces, Comments
// - Settings gear (own profile) with logout
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
  SpacesTab,
} from '@/components/profile';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { feedsApi, profilesApi } from '@/services/api';
import { Feed, Profile, ProfileComment, Space } from '@/types';
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
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  
  // Settings modal
  const [showSettings, setShowSettings] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch Profile
  // ---------------------------------------------------------------------------

  const fetchProfile = useCallback(async (isRefresh = false) => {
    if (!user?.username) {
      setError('Not logged in');
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }

      const response = await profilesApi.getProfile(user.username);

      if (response.success) {
        setProfile(response.data.profile);
      } else {
        setError(response.error?.message || 'Failed to load profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.username]);

  // Initial load
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ---------------------------------------------------------------------------
  // Tab Content Fetchers
  // ---------------------------------------------------------------------------

  const fetchPosts = useCallback(async () => {
    if (!profile?.user_id) return;
    
    setPostsLoading(true);
    try {
      const response = await feedsApi.getFeeds({ user_id: profile.user_id });
      if (response.success) {
        setPosts(response.data.feeds.data);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setPostsLoading(false);
    }
  }, [profile?.user_id]);

  const fetchSpaces = useCallback(async () => {
    if (!user?.username) return;
    
    setSpacesLoading(true);
    try {
      const response = await profilesApi.getUserSpaces(user.username);
      if (response.success) {
        setSpaces(response.data.spaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch spaces:', err);
    } finally {
      setSpacesLoading(false);
    }
  }, [user?.username]);

  const fetchComments = useCallback(async () => {
    if (!user?.username) return;
    
    setCommentsLoading(true);
    try {
      const response = await profilesApi.getUserComments(user.username);
      
      // FIXED: Comments are nested in response.data.comments.data
      if (response.success && response.data.comments?.data) {
        setComments(response.data.comments.data);
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [user?.username]);

  // Load tab content when tab changes
  useEffect(() => {
    if (!profile) return;
    
    switch (activeTab) {
      case 'posts':
        if (posts.length === 0) fetchPosts();
        break;
      case 'spaces':
        if (spaces.length === 0) fetchSpaces();
        break;
      case 'comments':
        if (comments.length === 0) fetchComments();
        break;
    }
  }, [activeTab, profile, fetchPosts, fetchSpaces, fetchComments]);

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
          onRetry={() => fetchProfile(true)}
        />
      </View>
    );
  }

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
              <ActivityIndicator color={colors.primary} />
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
                onPress={() => {}}
                onReact={() => {}}                
              />
            ))}
          </View>
        );

      case 'spaces':
        return <SpacesTab spaces={spaces} loading={spacesLoading} />;

      case 'comments':
        return <CommentsTab comments={comments} loading={commentsLoading} />;

      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Main Render
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
