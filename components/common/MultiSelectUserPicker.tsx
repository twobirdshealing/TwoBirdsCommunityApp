// =============================================================================
// MULTI SELECT USER PICKER - Reusable user search with chip list
// =============================================================================
// Shared between New Group and Add Members flows. Same /chat/users debounced
// search as NewMessageModal, but with:
//   - chip-list of selected users at the top (tap chip to remove)
//   - checkbox state on each search result
//   - optional `excludeUserIds` to filter out users already in a group
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { ENDPOINTS } from '@/constants/config';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import useDebounce from '@/hooks/useDebounce';
import { get } from '@/services/api/client';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { createLogger } from '@/utils/logger';

const log = createLogger('MultiSelectUserPicker');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PickerUser {
  user_id: number;
  display_name: string;
  username: string;
  avatar?: string;
}

interface MultiSelectUserPickerProps {
  selected: PickerUser[];
  onChange: (users: PickerUser[]) => void;
  /** User IDs to filter out (e.g. existing group members). */
  excludeUserIds?: number[];
  placeholder?: string;
  autoFocus?: boolean;
}

interface SearchResult extends PickerUser {
  short_description?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MultiSelectUserPicker({
  selected,
  onChange,
  excludeUserIds = [],
  placeholder = 'Search for people...',
  autoFocus = false,
}: MultiSelectUserPickerProps) {
  const { colors } = useTheme();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await get<{ users: SearchResult[] }>(ENDPOINTS.CHAT_USERS, {
          search: trimmed,
        });
        if (cancelled) return;

        if (response.success && Array.isArray(response.data?.users)) {
          setResults(response.data.users);
        } else {
          setResults([]);
        }
      } catch (err) {
        if (cancelled) return;
        log.error(err, 'Search error');
        setError('Failed to search members');
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const selectedIds = new Set(selected.map(u => u.user_id));
  const excludedIds = new Set(excludeUserIds);
  const visibleResults = results.filter(r => !excludedIds.has(r.user_id));

  const toggleUser = (user: SearchResult) => {
    if (selectedIds.has(user.user_id)) {
      onChange(selected.filter(s => s.user_id !== user.user_id));
    } else {
      onChange([
        ...selected,
        {
          user_id: user.user_id,
          display_name: user.display_name,
          username: user.username,
          avatar: user.avatar,
        },
      ]);
    }
  };

  const removeChip = (userId: number) => {
    onChange(selected.filter(s => s.user_id !== userId));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Selected chips */}
      {selected.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          {selected.map(user => (
            <Pressable
              key={user.user_id}
              onPress={() => removeChip(user.user_id)}
              style={[styles.chip, { backgroundColor: colors.backgroundSecondary }]}
            >
              <Avatar source={user.avatar} size="xs" fallback={user.display_name} />
              <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                {user.display_name}
              </Text>
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Search input */}
      <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Error */}
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.statusBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : query.trim().length < 2 ? (
        <View style={styles.statusBox}>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Type at least 2 characters to search
          </Text>
        </View>
      ) : visibleResults.length === 0 ? (
        <View style={styles.statusBox}>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            No members found for &quot;{query.trim()}&quot;
          </Text>
        </View>
      ) : (
        <FlashList
          data={visibleResults}
          keyExtractor={item => String(item.user_id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.user_id);
            return (
              <Pressable
                onPress={() => toggleUser(item)}
                style={[
                  styles.resultRow,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Avatar source={item.avatar} size="md" fallback={item.display_name} />
                <View style={styles.resultText}>
                  <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                  <Text style={[styles.resultUsername, { color: colors.textSecondary }]} numberOfLines={1}>
                    @{item.username}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color={colors.textInverse} />
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  chipRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.full,
    maxWidth: 200,
  },

  chipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    paddingVertical: spacing.sm,
  },

  statusBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  statusText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },

  errorText: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  resultText: {
    flex: 1,
  },

  resultName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  resultUsername: {
    fontSize: typography.size.sm,
    marginTop: 2,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MultiSelectUserPicker;
