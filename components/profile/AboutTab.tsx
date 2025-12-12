// =============================================================================
// ABOUT TAB - Profile about section
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Profile } from '@/types';

interface AboutTabProps {
  profile: Profile;
}

export function AboutTab({ profile }: AboutTabProps) {
  const description = profile.short_description || profile.meta?.bio;
  const website = profile.meta?.website;
  const socialLinks = profile.meta?.social_links || {};
  const hasSocial = Object.values(socialLinks).some(link => link);
  
  // Format joined date
  const joinedDate = profile.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null;

  const handleOpenLink = async (url: string) => {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const supported = await Linking.canOpenURL(fullUrl);
    if (supported) {
      await Linking.openURL(fullUrl);
    }
  };

  return (
    <View style={styles.container}>
      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : (
          <Text style={styles.placeholder}>No description added yet</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Info</Text>
        
        {/* Joined Date */}
        {joinedDate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoText}>Joined {joinedDate}</Text>
          </View>
        )}

        {/* Website */}
        {website && (
          <TouchableOpacity 
            style={styles.infoRow}
            onPress={() => handleOpenLink(website)}
            activeOpacity={0.7}
          >
            <Text style={styles.infoIcon}>🌐</Text>
            <Text style={[styles.infoText, styles.link]} numberOfLines={1}>
              {website.replace(/^https?:\/\//, '')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Location */}
        {profile.meta?.location && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{profile.meta.location}</Text>
          </View>
        )}
      </View>

      {/* Social Links */}
      {hasSocial && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>
          <View style={styles.socialRow}>
            {socialLinks.twitter && (
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleOpenLink(socialLinks.twitter!)}
              >
                <Text style={styles.socialIcon}>🐦</Text>
              </TouchableOpacity>
            )}
            {socialLinks.fb && (
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleOpenLink(socialLinks.fb!)}
              >
                <Text style={styles.socialIcon}>📘</Text>
              </TouchableOpacity>
            )}
            {socialLinks.instagram && (
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleOpenLink(socialLinks.instagram!)}
              >
                <Text style={styles.socialIcon}>📷</Text>
              </TouchableOpacity>
            )}
            {socialLinks.linkedin && (
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleOpenLink(socialLinks.linkedin!)}
              >
                <Text style={styles.socialIcon}>💼</Text>
              </TouchableOpacity>
            )}
            {socialLinks.youtube && (
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={() => handleOpenLink(socialLinks.youtube!)}
              >
                <Text style={styles.socialIcon}>▶️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },

  section: {
    marginBottom: spacing.xl,
  },

  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  description: {
    fontSize: typography.size.md,
    color: colors.text,
    lineHeight: typography.size.md * 1.6,
  },

  placeholder: {
    fontSize: typography.size.md,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  infoIcon: {
    fontSize: 16,
    marginRight: spacing.md,
    width: 24,
    textAlign: 'center',
  },

  infoText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    flex: 1,
  },

  link: {
    color: colors.primary,
  },

  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  socialIcon: {
    fontSize: 18,
  },
});

export default AboutTab;
