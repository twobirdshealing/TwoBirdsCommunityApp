// =============================================================================
// SOCIAL LINKS FORM - Shared social link inputs for registration & edit profile
// =============================================================================

import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { getProviderIcon, type SocialProvider } from '@/services/api/socialProviders';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface SocialLinksFormProps {
  providers: SocialProvider[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function SocialLinksForm({ providers, values, onChange }: SocialLinksFormProps) {
  const { colors } = useTheme();

  return (
    <>
      {providers.map(({ key, title, placeholder, domain }) => (
        <View key={key} style={styles.container}>
          <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
          <View style={[styles.inputRow, {
            backgroundColor: colors.background,
            borderColor: colors.border,
          }]}>
            <View style={[styles.iconChip, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name={getProviderIcon(key) as any} size={16} color={colors.textSecondary} />
            </View>
            <Text
              style={[styles.prefix, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              {domain}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={values[key] || ''}
              onChangeText={(text) => onChange(key, text)}
              placeholder={placeholder}
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

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: sizing.borderRadius.sm,
    overflow: 'hidden',
  },

  iconChip: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  prefix: {
    fontSize: typography.size.xs,
    paddingHorizontal: spacing.xs,
    flexShrink: 0,
  },

  input: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.size.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm + 2,
  },
});
