// =============================================================================
// NEW MESSAGE MODAL - User search to start new conversations
// =============================================================================
// Opens as a modal with:
// - Search input for finding users
// - List of matching users (MemberCard)
// - Tap user to start conversation
// =============================================================================

import { MemberCard, MemberCardData } from '@/components/member/MemberCard';
import { colors } from '@/constants/colors';
import { ENDPOINTS } from '@/constants/config';
import { spacing, typography } from '@/constants/layout';
import { get } from '@/services/api/client';
import { messagesApi } from '@/services/api/messages';
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

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<MemberSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

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
      const response = await get<{ members: { data: MemberSearchResult[] } }>(
        ENDPOINTS.MEMBERS,
        { search: query.trim(), per_page: 20 }
      );

      if (response.success && response.data?.members) {
        // Handle both array and paginated response
        const membersList = response.data.members.data || response.data.members;
        setMembers(Array.isArray(membersList) ? membersList : []);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error('[NewMessageModal] Search error:', err);
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

  const handleSelectUser = async (member: MemberSearchResult) => {
    if (creating) return;

    setCreating(true);
    setError(null);

    try {
      // Create thread with selected user (API requires non-empty message)
      const response = await messagesApi.startChatWithUser(
        member.user_id,
        '👋' // Wave emoji as initial greeting
      );

      if (response.success && response.data?.thread) {
        const threadId = response.data.thread.id;

        // Close modal and navigate to chat
        onClose();
        setSearchQuery('');
        setMembers([]);

        router.push(`/messages/${threadId}` as any);
      } else {
        setError('Failed to start conversation');
      }
    } catch (err) {
      console.error('[NewMessageModal] Create thread error:', err);
      setError('Failed to start conversation');
    } finally {
      setCreating(false);
    }
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Message</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a person..."
            placeholderTextColor={colors.textTertiary}
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
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Loading Overlay for Creating */}
        {creating && (
          <View style={styles.creatingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.creatingText}>Starting conversation...</Text>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : searchQuery.length < 2 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              Type at least 2 characters to search
            </Text>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
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
    backgroundColor: colors.surface,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
  },

  headerRight: {
    width: 40,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.text,
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
    color: colors.textSecondary,
    textAlign: 'center',
  },

  listContent: {
    paddingBottom: spacing.xl,
  },

  creatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    gap: spacing.md,
  },

  creatingText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  errorContainer: {
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.error + '20',
    borderRadius: 8,
  },

  errorText: {
    fontSize: typography.size.sm,
    color: colors.error,
    textAlign: 'center',
  },
});

export default NewMessageModal;
