// =============================================================================
// NEW MESSAGE MODAL - User search to start new conversations
// =============================================================================
// Opens as a modal with:
// - Search input for finding users
// - List of matching users (MemberCard)
// - Tap user to start conversation
// =============================================================================

import { MemberCard, MemberCardData } from '@/components/member/MemberCard';
import { ENDPOINTS } from '@/constants/config';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { get } from '@/services/api/client';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createLogger } from '@/utils/logger';

const log = createLogger('NewMessage');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NewMessageModalProps {
  visible: boolean;
  onClose: () => void;
}

interface MemberSearchResult {
  user_id: number;
  display_name: string;
  username: string;
  avatar?: string;
  short_description?: string;
  is_verified?: number | boolean;
  last_activity?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NewMessageModal({ visible, onClose }: NewMessageModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<MemberSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Search Members
  // ---------------------------------------------------------------------------

  const searchMembers = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setMembers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use plugin's /chat/users endpoint — respects chat permissions, shows recently active
      const response = await get<{ users: MemberSearchResult[] }>(
        ENDPOINTS.CHAT_USERS,
        { search: query.trim() }
      );

      if (response.success && response.data?.users) {
        const usersList = Array.isArray(response.data.users) ? response.data.users : [];
        setMembers(usersList);
      } else {
        setMembers([]);
      }
    } catch (err) {
      log.error('Search error:', err);
      setError('Failed to search members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Handle Search Input
  // ---------------------------------------------------------------------------

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new debounced search
    const timer = setTimeout(() => {
      searchMembers(text);
    }, 300);

    setDebounceTimer(timer);
  };

  // ---------------------------------------------------------------------------
  // Handle User Selection
  // ---------------------------------------------------------------------------

  const handleSelectUser = (member: MemberSearchResult) => {
    // Close modal and navigate to user chat route
    onClose();
    setSearchQuery('');
    setMembers([]);

    router.push({
      pathname: '/messages/user/[userId]',
      params: {
        userId: String(member.user_id),
        displayName: member.display_name,
        avatar: member.avatar || '',
      },
    } as any);
  };

  // ---------------------------------------------------------------------------
  // Handle Close
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    setSearchQuery('');
    setMembers([]);
    setError(null);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    onClose();
  };

  // ---------------------------------------------------------------------------
  // Render Member Item
  // ---------------------------------------------------------------------------

  const renderMemberItem = ({ item }: { item: MemberSearchResult }) => {
    // Convert to MemberCardData format
    const memberData: MemberCardData = {
      id: item.user_id,
      user_id: item.user_id,
      display_name: item.display_name,
      username: item.username,
      avatar: item.avatar,
      short_description: item.short_description,
      xprofile: {
        user_id: item.user_id,
        display_name: item.display_name,
        username: item.username,
        avatar: item.avatar,
        short_description: item.short_description,
        is_verified: item.is_verified,
        last_activity: item.last_activity,
      },
    };

    return (
      <MemberCard
        member={memberData}
        onPress={() => handleSelectUser(item)}
        showRole={false}
        showBio={false}
        showLastActive={false}
        compact
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.surface }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>New Message</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Search Input */}
        <View style={[styles.searchContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
          <Ionicons name="search" size={20} color={themeColors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }]}
            placeholder="Search for a person..."
            placeholderTextColor={themeColors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery('');
              setMembers([]);
            }}>
              <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        ) : searchQuery.length < 2 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={themeColors.textTertiary} />
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              Type at least 2 characters to search
            </Text>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={themeColors.textTertiary} />
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No members found for "{searchQuery}"
            </Text>
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => String(item.user_id)}
            renderItem={renderMemberItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },

  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
  },

  headerRight: {
    width: 40,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    paddingVertical: spacing.sm,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },

  listContent: {
    paddingBottom: spacing.xl,
  },

  errorContainer: {
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    borderRadius: 8,
  },

  errorText: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
});

export default NewMessageModal;
