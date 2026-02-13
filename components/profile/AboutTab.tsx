// =============================================================================
// ABOUT TAB - Profile about section with custom fields
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';
import { Profile, CustomFieldValue } from '@/types';

interface AboutTabProps {
  profile: Profile;
}

export function AboutTab({ profile }: AboutTabProps) {
  const { colors: themeColors } = useTheme();
  const description = profile.short_description || profile.meta?.bio;
  const website = profile.meta?.website;
  const socialLinks = profile.meta?.social_links || {};
  const hasSocial = Object.values(socialLinks).some(link => link);

  // Custom fields from tbc-fluent-profiles
  const customFields = profile.custom_fields || {};
  const visibleFields = Object.entries(customFields).filter(([, field]) => {
    if (!field.value) return false;
    if (field.type === 'checkbox' || field.type === 'multiselect') {
      try {
        const arr = JSON.parse(field.value);
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return false;
      }
    }
    return true;
  });

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

  const renderFieldValue = (field: CustomFieldValue) => {
    const { value, type } = field;

    switch (type) {
      case 'url':
        return (
          <TouchableOpacity onPress={() => handleOpenLink(value)} activeOpacity={0.7}>
            <Text style={[styles.fieldValueText, { color: themeColors.primary }]} numberOfLines={1}>
              {value.replace(/^https?:\/\//, '')}
            </Text>
          </TouchableOpacity>
        );

      case 'date': {
        const date = new Date(value);
        const formatted = isNaN(date.getTime())
          ? value
          : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        return <Text style={[styles.fieldValueText, { color: themeColors.textSecondary }]}>{formatted}</Text>;
      }

      case 'checkbox':
      case 'multiselect': {
        try {
          const items = JSON.parse(value);
          if (!Array.isArray(items) || items.length === 0) return null;
          return (
            <View style={styles.tagRow}>
              {items.map((item: string, i: number) => (
                <View key={i} style={[styles.tag, { backgroundColor: themeColors.backgroundSecondary }]}>
                  <Text style={[styles.tagText, { color: themeColors.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          );
        } catch {
          return <Text style={[styles.fieldValueText, { color: themeColors.textSecondary }]}>{value}</Text>;
        }
      }

      case 'textarea':
        return (
          <Text style={[styles.fieldValueText, { color: themeColors.textSecondary, lineHeight: typography.size.md * 1.5 }]}>
            {value}
          </Text>
        );

      default:
        return <Text style={[styles.fieldValueText, { color: themeColors.textSecondary }]}>{value}</Text>;
    }
  };

  return (
    <View style={styles.container}>
      {/* Description */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>About</Text>
        {description ? (
          <Text style={[styles.description, { color: themeColors.text }]}>{description}</Text>
        ) : (
          <Text style={[styles.placeholder, { color: themeColors.textTertiary }]}>No description added yet</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Info</Text>

        {/* Joined Date */}
        {joinedDate && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>Joined {joinedDate}</Text>
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
            <Text style={[styles.infoText, styles.link, { color: themeColors.primary }]} numberOfLines={1}>
              {website.replace(/^https?:\/\//, '')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Location */}
        {profile.meta?.location && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{profile.meta.location}</Text>
          </View>
        )}
      </View>

      {/* Custom Profile Fields */}
      {visibleFields.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Details</Text>
          {visibleFields.map(([key, field]) => (
            <View key={key} style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: themeColors.textTertiary }]}>{field.label}</Text>
              {renderFieldValue(field)}
            </View>
          ))}
        </View>
      )}

      {/* Social Links */}
      {hasSocial && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Social</Text>
          <View style={styles.socialRow}>
            {socialLinks.twitter && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: themeColors.backgroundSecondary }]}
                onPress={() => handleOpenLink(socialLinks.twitter!)}
              >
                <Text style={styles.socialIcon}>🐦</Text>
              </TouchableOpacity>
            )}
            {socialLinks.fb && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: themeColors.backgroundSecondary }]}
                onPress={() => handleOpenLink(socialLinks.fb!)}
              >
                <Text style={styles.socialIcon}>📘</Text>
              </TouchableOpacity>
            )}
            {socialLinks.instagram && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: themeColors.backgroundSecondary }]}
                onPress={() => handleOpenLink(socialLinks.instagram!)}
              >
                <Text style={styles.socialIcon}>📷</Text>
              </TouchableOpacity>
            )}
            {socialLinks.linkedin && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: themeColors.backgroundSecondary }]}
                onPress={() => handleOpenLink(socialLinks.linkedin!)}
              >
                <Text style={styles.socialIcon}>💼</Text>
              </TouchableOpacity>
            )}
            {socialLinks.youtube && (
              <TouchableOpacity
                style={[styles.socialButton, { backgroundColor: themeColors.backgroundSecondary }]}
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
    marginBottom: spacing.md,
  },

  description: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.6,
  },

  placeholder: {
    fontSize: typography.size.md,
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
    flex: 1,
  },

  link: {
  },

  // Custom fields
  fieldRow: {
    marginBottom: spacing.md,
  },

  fieldLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  fieldValueText: {
    fontSize: typography.size.md,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },

  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },

  tagText: {
    fontSize: typography.size.sm,
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  socialIcon: {
    fontSize: 18,
  },
});

export default AboutTab;
