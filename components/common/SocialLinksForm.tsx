// =============================================================================
// SOCIAL LINKS FORM - Shared social link inputs for registration & edit profile
// =============================================================================

import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Social provider config — single source of truth
// -----------------------------------------------------------------------------

export const SOCIAL_PROVIDERS = [
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram' as const, prefix: 'https://instagram.com/' },
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube' as const, prefix: 'https://youtube.com/' },
  { key: 'fb', label: 'Facebook', icon: 'logo-facebook' as const, prefix: 'https://facebook.com/' },
  { key: 'blue_sky', label: 'Bluesky', icon: 'cloud-outline' as const, prefix: 'https://bsky.app/profile/' },
  { key: 'reddit', label: 'Reddit', icon: 'logo-reddit' as const, prefix: 'https://www.reddit.com/user/' },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface SocialLinksFormProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function SocialLinksForm({ values, onChange }: SocialLinksFormProps) {
  const { colors } = useTheme();

  return (
    <>
      {SOCIAL_PROVIDERS.map(({ key, label, icon, prefix }) => (
        <View key={key} style={styles.container}>
          <View style={styles.labelRow}>
            <Ionicons name={icon} size={18} color={colors.textSecondary} />
            <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          </View>
          <View style={[styles.inputRow, {
            backgroundColor: colors.background,
            borderColor: colors.border,
          }]}>
            <Text style={[styles.prefix, { color: colors.textTertiary }]}>{prefix}</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={values[key] || ''}
              onChangeText={(text) => onChange(key, text)}
              placeholder="username"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      ))}
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },

  prefix: {
    fontSize: typography.size.xs,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm + 2,
  },

  input: {
    flex: 1,
    fontSize: typography.size.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm + 2,
  },
});
