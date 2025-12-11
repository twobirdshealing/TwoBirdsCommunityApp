// =============================================================================
// ABOUT TAB - Profile about section content
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Profile } from '@/types';
import { formatSmartDate } from '@/utils/formatDate';

interface AboutTabProps {
  profile: Profile;
}

export function AboutTab({ profile }: AboutTabProps) {
  const joinedDate = formatSmartDate(profile.created_at);
  const lastSeen = profile.last_activity ? formatSmartDate(profile.last_activity) : null;
  const socialLinks = profile.meta?.social_links;

  const openLink = (url: string) => {
    if (url) {
      Linking.openURL(url.startsWith('http') ? url : `https://${url}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        {profile.short_description ? (
          <Text style={styles.description}>{profile.short_description}</Text>
        ) : (
          <Text style={styles.placeholder}>No description added yet</Text>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.section}>
        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>📅</Text>
          <Text style={styles.infoText}>Joined {joinedDate}</Text>
        </View>
        
        {lastSeen && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🕐</Text>
            <Text style={styles.infoText}>Last seen {lastSeen}</Text>
          </View>
        )}
        
        {profile.meta?.website && (
          <TouchableOpacity 
            style={styles.infoRow} 
            onPress={() => openLink(profile.meta!.website!)}
          >
            <Text style={styles.infoIcon}>🔗</Text>
            <Text style={[styles.infoText, styles.link]} numberOfLines={1}>
              {profile.meta.website}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Social Links */}
      {socialLinks && Object.keys(socialLinks).some(k => socialLinks[k as keyof typeof socialLinks]) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Links</Text>
          <View style={styles.socialRow}>
            {socialLinks.twitter && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => openLink(`https://twitter.com/${socialLinks.twitter}`)}
              >
                <Text style={styles.socialIcon}>𝕏</Text>
              </TouchableOpacity>
            )}
            {socialLinks.instagram && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => openLink(`https://instagram.com/${socialLinks.instagram}`)}
              >
                <Text style={styles.socialIcon}>📷</Text>
              </TouchableOpacity>
            )}
            {socialLinks.youtube && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => openLink(`https://youtube.com/${socialLinks.youtube}`)}
              >
                <Text style={styles.socialIcon}>▶️</Text>
              </TouchableOpacity>
            )}
            {socialLinks.linkedin && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => openLink(`https://linkedin.com/in/${socialLinks.linkedin}`)}
              >
                <Text style={styles.socialIcon}>💼</Text>
              </TouchableOpacity>
            )}
            {socialLinks.fb && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => openLink(`https://facebook.com/${socialLinks.fb}`)}
              >
                <Text style={styles.socialIcon}>📘</Text>
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
