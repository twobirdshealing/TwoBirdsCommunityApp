// =============================================================================
// SPACE SELECTOR - Dropdown to select a space for posting
// =============================================================================
// FIXED: Pass space SLUG instead of ID
// API /spaces endpoint returns user's spaces - no client-side filtering needed
// =============================================================================

import React, { useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { spacesApi } from '@/services/api/spaces';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface Space {
  id: number;
  title: string;
  slug: string;
  logo?: string;
  privacy?: string;
}

interface SpaceSelectorProps {
  selectedSpaceSlug: string | null;
  selectedSpaceName: string | null;
  onSelect: (spaceSlug: string, spaceName: string) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SpaceSelector({
  selectedSpaceSlug,
  selectedSpaceName,
  onSelect,
}: SpaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch Spaces
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen && spaces.length === 0) {
      fetchSpaces();
    }
  }, [isOpen]);

  const fetchSpaces = async () => {
    setLoading(true);
    try {
      // API returns only spaces the user is a member of
      const response = await spacesApi.getSpaces({ per_page: 100 });
      
      if (response.success && response.data?.spaces) {
        const spacesList = response.data.spaces.data || response.data.spaces;
        console.log('[SpaceSelector] Spaces count:', spacesList.length);
        setSpaces(spacesList);
      }
    } catch (error) {
      console.error('[SpaceSelector] Error fetching spaces:', error);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Filter Spaces by Search
  // ---------------------------------------------------------------------------

  const filteredSpaces = searchQuery.trim()
    ? spaces.filter(space => 
        space.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        space.slug.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : spaces;

  // ---------------------------------------------------------------------------
  // Handle Selection - pass SLUG not ID
  // ---------------------------------------------------------------------------

  const handleSelect = (space: Space) => {
    console.log('[SpaceSelector] Selected:', space.slug, space.title);
    onSelect(space.slug, space.title);
    setIsOpen(false);
    setSearchQuery('');
  };

  // ---------------------------------------------------------------------------
  // Render Space Item
  // ---------------------------------------------------------------------------

  const renderSpaceItem = ({ item }: { item: Space }) => (
    <TouchableOpacity
      style={[
        styles.spaceItem,
        item.slug === selectedSpaceSlug && styles.spaceItemSelected,
      ]}
      onPress={() => handleSelect(item)}
    >
      <View style={styles.spaceIcon}>
        <Ionicons 
          name={item.privacy === 'secret' ? 'lock-closed' : item.privacy === 'private' ? 'people' : 'globe-outline'} 
          size={20} 
          color={colors.primary} 
        />
      </View>
      <Text style={styles.spaceTitle} numberOfLines={1}>
        {item.title}
      </Text>
      {item.slug === selectedSpaceSlug && (
        <Ionicons name="checkmark" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setIsOpen(true)}
      >
        <Ionicons name="people-outline" size={20} color={colors.primary} />
        <Text style={styles.triggerText}>
          {selectedSpaceName || 'Select a space...'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Space</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search spaces..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading spaces...</Text>
            </View>
          ) : filteredSpaces.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No spaces match your search' : 'No spaces available'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredSpaces}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderSpaceItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },

  triggerText: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.text,
  },

  modalContainer: {
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

  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.text,
  },

  closeButton: {
    padding: spacing.xs,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },

  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },

  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },

  spaceItemSelected: {
    backgroundColor: colors.primaryLight + '20',
  },

  spaceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  spaceTitle: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.text,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  loadingText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default SpaceSelector;
