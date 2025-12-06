// =============================================================================
// PROFILE SCREEN - Current user's profile
// =============================================================================
// Shows the logged-in user's profile info.
// For now, shows the admin user's profile.
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { Profile } from '@/types';
import { profilesApi } from '@/services/api';
import { Avatar, LoadingSpinner, ErrorMessage } from '@/components/common';
import { formatCompactNumber } from '@/utils/formatNumber';
import { formatSmartDate } from '@/utils/formatDate';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ProfileScreen() {
  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // -----------------------------------------------------------------------------
  // Fetch Profile
  // -----------------------------------------------------------------------------
  
  const fetchProfile = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
      const response = await profilesApi.getMyProfile();
      
      if (response.success) {
        setProfile(response.data.profile);
      } else {
        setError(response.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
  
  // -----------------------------------------------------------------------------
  // Render States
  // -----------------------------------------------------------------------------
  
  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingSpinner message="Loading profile..." />
      </View>
    );
  }
  
  if (error || !profile) {
    return (
      <View style={styles.container}>
        <ErrorMessage 
          message={error || 'Profile not found'} 
          onRetry={() => fetchProfile(true)} 
        />
      </View>
    );
  }
  
  // -----------------------------------------------------------------------------
  // Render Profile
  // -----------------------------------------------------------------------------
  
  const isVerified = profile.is_verified === 1;
  const memberSince = formatSmartDate(profile.created_at);
  
  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchProfile(true)}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Cover Photo */}
      <View style={styles.coverContainer}>
        {profile.cover_photo || profile.meta?.cover_photo ? (
          <Image 
            source={{ uri: profile.cover_photo || profile.meta?.cover_photo }} 
            style={styles.coverPhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.coverPhoto, styles.coverPlaceholder]} />
        )}
      </View>
      
      {/* Profile Info */}
      <View style={styles.profileInfo}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <Avatar 
            source={profile.avatar} 
            size="xxl" 
            verified={isVerified}
            fallback={profile.display_name}
          />
        </View>
        
        {/* Name */}
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        
        {/* Bio */}
        {profile.short_description && (
          <Text style={styles.bio}>{profile.short_description}</Text>
        )}
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatCompactNumber(profile.total_points || 0)}
            </Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatCompactNumber(profile.followers_count || 0)}
            </Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {formatCompactNumber(profile.followings_count || 0)}
            </Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
        
        {/* Meta Info */}
        <View style={styles.metaSection}>
          {profile.meta?.website && (
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>🔗</Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {profile.meta.website}
              </Text>
            </View>
          )}
          
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>📅</Text>
            <Text style={styles.metaText}>
              Member since {memberSince}
            </Text>
          </View>
        </View>
        
        {/* Social Links */}
        {profile.meta?.social_links && (
          <View style={styles.socialLinks}>
            {profile.meta.social_links.twitter && (
              <View style={styles.socialBadge}>
                <Text style={styles.socialIcon}>𝕏</Text>
              </View>
            )}
            {profile.meta.social_links.linkedin && (
              <View style={styles.socialBadge}>
                <Text style={styles.socialIcon}>in</Text>
              </View>
            )}
            {profile.meta.social_links.youtube && (
              <View style={styles.socialBadge}>
                <Text style={styles.socialIcon}>▶</Text>
              </View>
            )}
            {profile.meta.social_links.instagram && (
              <View style={styles.socialBadge}>
                <Text style={styles.socialIcon}>📷</Text>
              </View>
            )}
          </View>
        )}
      </View>
      
      {/* Placeholder for user's posts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            User's posts will appear here
          </Text>
        </View>
      </View>
    </ScrollView>
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
  
  // Cover Photo
  coverContainer: {
    width: '100%',
    height: 150,
  },
  
  coverPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.skeleton,
  },
  
  coverPlaceholder: {
    backgroundColor: colors.primary,
  },
  
  // Profile Info
  profileInfo: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: sizing.borderRadius.xl,
    borderBottomRightRadius: sizing.borderRadius.xl,
    marginTop: -20,
  },
  
  avatarContainer: {
    marginTop: -50,
    marginBottom: spacing.md,
    alignSelf: 'center',
    padding: 4,
    backgroundColor: colors.surface,
    borderRadius: 70,
  },
  
  displayName: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  
  username: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  
  bio: {
    fontSize: typography.size.md,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  
  stat: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  
  statValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
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
    backgroundColor: colors.borderLight,
  },
  
  // Meta
  metaSection: {
    marginTop: spacing.lg,
  },
  
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  
  metaIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  
  metaText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
  
  // Social Links
  socialLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  
  socialBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  
  socialIcon: {
    fontSize: 14,
    fontWeight: typography.weight.bold,
    color: colors.textSecondary,
  },
  
  // Sections
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  
  placeholder: {
    backgroundColor: colors.surface,
    padding: spacing.xxl,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
  },
  
  placeholderText: {
    color: colors.textTertiary,
    fontSize: typography.size.md,
  },
});
