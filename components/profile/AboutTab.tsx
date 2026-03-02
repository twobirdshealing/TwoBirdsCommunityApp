// =============================================================================
// ABOUT TAB - Clean profile info section (matches web portal style)
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';
import { Profile, CustomFieldValue } from '@/types/user';
import { formatRelativeTime } from '@/utils/formatDate';

interface AboutTabProps {
  profile: Profile;
}

// Map custom field types to Ionicons
const fieldTypeIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  phone: 'call-outline',
  url: 'link-outline',
  date: 'calendar-outline',
  email: 'mail-outline',
};

export function AboutTab({ profile }: AboutTabProps) {
  const { colors: themeColors } = useTheme();
  const description = profile.short_description || profile.meta?.bio;
  const website = profile.meta?.website;

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

  // Relative joined date
  const joinedText = profile.created_at
    ? `Joined ${formatRelativeTime(profile.created_at)}`
    : null;

  // Last seen
  const lastSeenText = profile.last_activity
    ? `Last seen: ${formatRelativeTime(profile.last_activity)}`
    : null;

  const handleOpenLink = async (url: string) => {
    if (!url) return;
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const supported = await Linking.canOpenURL(fullUrl);
    if (supported) {
      await Linking.openURL(fullUrl);
    }
  };

  const handlePhonePress = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
  };

  // Render a single custom field value inline
  const renderFieldValue = (field: CustomFieldValue) => {
    const { value, type } = field;

    if (type === 'phone') {
      return (
        <TouchableOpacity onPress={() => handlePhonePress(value)} activeOpacity={0.7}>
          <Text style={[styles.infoText, { color: themeColors.primary }]}>{value}</Text>
        </TouchableOpacity>
      );
    }

    if (type === 'url') {
      return (
        <TouchableOpacity onPress={() => handleOpenLink(value)} activeOpacity={0.7}>
          <Text style={[styles.infoText, { color: themeColors.primary }]} numberOfLines={1}>
            {value.replace(/^https?:\/\//, '')}
          </Text>
        </TouchableOpacity>
      );
    }

    if (type === 'date') {
      const date = new Date(value);
      const formatted = isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{formatted}</Text>;
    }

    if (type === 'checkbox' || type === 'multiselect') {
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
        return <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{value}</Text>;
      }
    }

    return <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{value}</Text>;
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
      {/* Section Title */}
      <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>About</Text>

      {/* Bio */}
      {description ? (
        <Text style={[styles.description, { color: themeColors.text }]}>{description}</Text>
      ) : (
        <Text style={[styles.placeholder, { color: themeColors.textTertiary }]}>No description added yet</Text>
      )}

      {/* Joined */}
      {joinedText && (
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={themeColors.textTertiary} style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{joinedText}</Text>
        </View>
      )}

      {/* Last Seen */}
      {lastSeenText && (
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={themeColors.textTertiary} style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{lastSeenText}</Text>
        </View>
      )}

      {/* Custom Fields (phone, etc.) */}
      {visibleFields.map(([key, field]) => {
        const iconName = fieldTypeIcons[field.type] || 'information-circle-outline';

        // Checkbox/multiselect get their own block layout
        if (field.type === 'checkbox' || field.type === 'multiselect') {
          return (
            <View key={key} style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: themeColors.textTertiary }]}>{field.label}</Text>
              {renderFieldValue(field)}
            </View>
          );
        }

        return (
          <View key={key} style={styles.infoRow}>
            <Ionicons name={iconName} size={16} color={themeColors.textTertiary} style={styles.infoIcon} />
            <Text style={[styles.fieldPrefix, { color: themeColors.textTertiary }]}>{field.label}: </Text>
            {renderFieldValue(field)}
          </View>
        );
      })}

      {/* Website */}
      {website && (
        <TouchableOpacity style={styles.infoRow} onPress={() => handleOpenLink(website)} activeOpacity={0.7}>
          <Ionicons name="globe-outline" size={16} color={themeColors.textTertiary} style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: themeColors.primary }]} numberOfLines={1}>
            {website.replace(/^https?:\/\//, '')}
          </Text>
        </TouchableOpacity>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    margin: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 12,
  },

  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },

  description: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.6,
    marginBottom: spacing.md,
  },

  placeholder: {
    fontSize: typography.size.md,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },

  // Info rows (icon + text, single line)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },

  infoIcon: {
    width: 22,
    marginRight: spacing.sm,
  },

  infoText: {
    fontSize: typography.size.sm,
    flex: 1,
  },

  fieldPrefix: {
    fontSize: typography.size.sm,
  },

  // Block layout for multi-value fields (checkbox/multiselect)
  fieldBlock: {
    paddingVertical: spacing.xs + 2,
  },

  fieldLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.xs,
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

});

export default AboutTab;
