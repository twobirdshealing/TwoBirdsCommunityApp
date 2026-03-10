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
          <View style={styles.labelRow}>
            <Ionicons name={getProviderIcon(key) as any} size={18} color={colors.textSecondary} />
            <Text style={[styles.label, { color: colors.text }]}>{title}</Text>
          </View>
          <View style={[styles.inputRow, {
            backgroundColor: colors.background,
            borderColor: colors.border,
          }]}>
            <Text style={[styles.prefix, { color: colors.textTertiary }]}>{domain}</Text>
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
    borderRadius: sizing.borderRadius.sm,
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
