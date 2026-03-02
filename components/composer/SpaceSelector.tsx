// =============================================================================
// SPACE SELECTOR - Dropdown to select a space for posting
// =============================================================================
// FIXED: Pass space SLUG instead of ID
// API /spaces endpoint returns user's spaces - no client-side filtering needed
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
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
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { spacesApi } from '@/services/api/spaces';
import { SpaceGroupOption } from '@/types/space';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface Space {
  id: number;
  title: string;
  slug: string;
  logo?: string | null;
  privacy?: string;
  parent_id?: number | string | null;
  serial?: string | number;
}

interface SpaceSelectorProps {
  selectedSpaceSlug: string | null;
  selectedSpaceName: string | null;
  onSelect: (spaceSlug: string, spaceName: string) => void;
}

type GroupHeaderItem = { _type: 'group_header'; id: number; title: string };
type SpaceItem = { _type: 'space'; space: Space };
type ListItem = GroupHeaderItem | SpaceItem;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SpaceSelector({
  selectedSpaceSlug,
  selectedSpaceName,
  onSelect,
}: SpaceSelectorProps) {
  const { colors: themeColors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [groups, setGroups] = useState<SpaceGroupOption[]>([]);
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
      // Fetch groups and spaces in parallel
      const [groupsRes, spacesRes] = await Promise.all([
        spacesApi.getSpaceGroups({ options_only: true }),
        spacesApi.getSpaces({ per_page: 100 }),
      ]);

      // Process groups
      if (groupsRes.success) {
        setGroups(groupsRes.data.groups || []);
      }

      // Process spaces
      if (spacesRes.success) {
        const spacesList = spacesRes.data.spaces || [];
        if (__DEV__) console.log('[SpaceSelector] Spaces count:', spacesList.length);
        setSpaces(spacesList);
      }
    } catch (error) {
      if (__DEV__) console.error('[SpaceSelector] Error fetching spaces:', error);
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
  // Build grouped list data
  // ---------------------------------------------------------------------------

  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];

    // Build a map of parent_id → spaces
    const groupedSpaces = new Map<string, Space[]>();
    const ungroupedSpaces: Space[] = [];

    for (const space of filteredSpaces) {
      const parentId = space.parent_id?.toString();
      if (parentId) {
        const existing = groupedSpaces.get(parentId) || [];
        existing.push(space);
        groupedSpaces.set(parentId, existing);
      } else {
        ungroupedSpaces.push(space);
      }
    }

    // Add groups in API order (preserves admin-configured ordering)
    for (const group of groups) {
      const groupSpaces = groupedSpaces.get(group.id.toString()) || [];
      if (groupSpaces.length === 0 && searchQuery.trim()) continue;
      if (groupSpaces.length === 0) continue;

      // Sort spaces within group by serial
      groupSpaces.sort((a, b) => {
        const aSerial = Number(a.serial) || 0;
        const bSerial = Number(b.serial) || 0;
        return aSerial - bSerial;
      });

      items.push({ _type: 'group_header', id: group.id, title: group.title });
      for (const space of groupSpaces) {
        items.push({ _type: 'space', space });
      }
    }

    // Add ungrouped spaces at the end
    if (ungroupedSpaces.length > 0) {
      if (groups.length > 0) {
        items.push({ _type: 'group_header', id: 0, title: 'Other Spaces' });
      }
      for (const space of ungroupedSpaces) {
        items.push({ _type: 'space', space });
      }
    }

    return items;
  }, [filteredSpaces, groups, searchQuery]);

  // ---------------------------------------------------------------------------
  // Handle Selection - pass SLUG not ID
  // ---------------------------------------------------------------------------

  const handleSelect = (space: Space) => {
    if (__DEV__) console.log('[SpaceSelector] Selected:', space.slug, space.title);
    onSelect(space.slug, space.title);
    setIsOpen(false);
    setSearchQuery('');
  };

  // ---------------------------------------------------------------------------
  // Render Space Item
  // ---------------------------------------------------------------------------

  const renderListItem = ({ item }: { item: ListItem }) => {
    if (item._type === 'group_header') {
      return (
        <View style={[styles.groupHeader, { borderBottomColor: themeColors.border }]}>
          <Text style={[styles.groupHeaderText, { color: themeColors.textSecondary }]}>
            {item.title}
          </Text>
        </View>
      );
    }

    const space = item.space;
    return (
      <TouchableOpacity
        style={[
          styles.spaceItem,
          { borderBottomColor: themeColors.border },
          space.slug === selectedSpaceSlug && styles.spaceItemSelected,
        ]}
        onPress={() => handleSelect(space)}
      >
        <View style={styles.spaceIcon}>
          <Ionicons
            name={space.privacy === 'secret' ? 'lock-closed' : space.privacy === 'private' ? 'people' : 'globe-outline'}
            size={20}
            color={themeColors.primary}
          />
        </View>
        <Text style={[styles.spaceTitle, { color: themeColors.text }]} numberOfLines={1}>
          {space.title}
        </Text>
        {space.slug === selectedSpaceSlug && (
          <Ionicons name="checkmark" size={20} color={themeColors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: themeColors.background }]}
        onPress={() => setIsOpen(true)}
      >
        <Ionicons name="people-outline" size={20} color={themeColors.primary} />
        <Text style={[styles.triggerText, { color: themeColors.text }]}>
          {selectedSpaceName || 'Select a space...'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={themeColors.textSecondary} />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>Select Space</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setIsOpen(false);
                setSearchQuery('');
              }}
            >
              <Ionicons name="close" size={24} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[styles.searchContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="search" size={20} color={themeColors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search spaces..."
              placeholderTextColor={themeColors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={themeColors.primary} />
              <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading spaces...</Text>
            </View>
          ) : listData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {searchQuery ? 'No spaces match your search' : 'No spaces available'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item._type === 'group_header' ? `group-${item.id}` : `space-${item.space.id}`}
              renderItem={renderListItem}
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
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },

  triggerText: {
    flex: 1,
    fontSize: typography.size.md,
  },

  modalContainer: {
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

  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
  },

  closeButton: {
    padding: spacing.xs,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    paddingVertical: spacing.sm,
  },

  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },

  groupHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
  },

  groupHeaderText: {
    fontSize: typography.size.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },

  spaceItemSelected: {
  },

  spaceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  spaceTitle: {
    flex: 1,
    fontSize: typography.size.md,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  loadingText: {
    fontSize: typography.size.md,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  emptyText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },
});

export default SpaceSelector;
