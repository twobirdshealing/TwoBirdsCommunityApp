// =============================================================================
// ABOUT TAB - Clean profile info section (matches web portal style)
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { Profile, NativeCustomField } from '@/types/user';
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

  // FC native custom fields from custom_field_groups
  const allFields = useMemo(() => {
    const fields: NativeCustomField[] = [];
    if (profile.custom_field_groups) {
      for (const group of profile.custom_field_groups) {
        for (const field of group.fields) {
          if (!field.is_enabled || !field.value) continue;
          if (field.type === 'multiselect' && Array.isArray(field.value) && field.value.length === 0) continue;
          fields.push(field);
        }
      }
    }
    return fields;
  }, [profile.custom_field_groups]);

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
  const renderFieldValue = (field: NativeCustomField) => {
    const { value, type } = field;
    const displayValue = Array.isArray(value) ? value.join(', ') : (value || '');

    if (type === 'url') {
      return (
        <Pressable onPress={() => handleOpenLink(displayValue)}>
          <Text style={[styles.infoText, { color: themeColors.primary }]} numberOfLines={1}>
            {displayValue.replace(/^https?:\/\//, '')}
          </Text>
        </Pressable>
      );
    }

    if (type === 'date') {
      const date = new Date(displayValue);
      const formatted = isNaN(date.getTime())
        ? displayValue
        : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{formatted}</Text>;
    }

    if (type === 'multiselect' && Array.isArray(value)) {
      return (
        <View style={styles.tagRow}>
          {value.map((item: string, i: number) => (
            <View key={i} style={[styles.tag, { backgroundColor: themeColors.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: themeColors.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    }

    // Phone-like field (slug contains "phone") — make tappable
    if (field.slug.includes('phone') && displayValue) {
      return (
        <Pressable onPress={() => handlePhonePress(displayValue)}>
          <Text style={[styles.infoText, { color: themeColors.primary }]}>{displayValue}</Text>
        </Pressable>
      );
    }

    return <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>{displayValue}</Text>;
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
      {allFields.map((field) => {
        const iconName = fieldTypeIcons[field.type] || (field.slug.includes('phone') ? 'call-outline' : 'information-circle-outline');

        // Multiselect gets its own block layout
        if (field.type === 'multiselect') {
          return (
            <View key={field.slug} style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: themeColors.textTertiary }]}>{field.label}</Text>
              {renderFieldValue(field)}
            </View>
          );
        }

        return (
          <View key={field.slug} style={styles.infoRow}>
            <Ionicons name={iconName} size={16} color={themeColors.textTertiary} style={styles.infoIcon} />
            <Text style={[styles.fieldPrefix, { color: themeColors.textTertiary }]}>{field.label}: </Text>
            {renderFieldValue(field)}
          </View>
        );
      })}

      {/* Website */}
      {website && (
        <Pressable style={styles.infoRow} onPress={() => handleOpenLink(website)}>
          <Ionicons name="globe-outline" size={16} color={themeColors.textTertiary} style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: themeColors.primary }]} numberOfLines={1}>
            {website.replace(/^https?:\/\//, '')}
          </Text>
        </Pressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    margin: spacing.md,
    marginTop: spacing.sm,
    borderRadius: sizing.borderRadius.md,
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
    borderRadius: sizing.borderRadius.md,
  },

  tagText: {
    fontSize: typography.size.sm,
  },

});

export default AboutTab;
