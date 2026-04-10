// =============================================================================
// SPACE MENU COMPONENT - Context menu for space actions
// =============================================================================
// Shows role-appropriate options:
// - All members: Members list, Leave Space
// - Moderators: Same as members (manage members in future)
// - Admins: Same + Space Settings (in future)
// =============================================================================

import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { sizing } from '@/constants/layout';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { spacesApi } from '@/services/api/spaces';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { createLogger } from '@/utils/logger';

const log = createLogger('SpaceMenu');

interface SpaceMenuProps {
  slug: string;
  role?: 'member' | 'moderator' | 'admin';
  onLeaveSuccess?: () => void;
}

export function SpaceMenu({ slug, role, onLeaveSuccess }: SpaceMenuProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const { colors: themeColors } = useTheme();

  const handleLeaveSpace = () => {
    setMenuVisible(false);

    Alert.alert('Leave Space', 'Are you sure you want to leave this space?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsLeaving(true);
            await spacesApi.leaveSpace(slug);
            cacheEvents.emit(CACHE_EVENTS.SPACES);
            router.back();
            onLeaveSuccess?.();
          } catch (error) {
            log.error(error, 'Error leaving space');
            Alert.alert('Error', 'Failed to leave space. Please try again.');
          } finally {
            setIsLeaving(false);
          }
        },
      },
    ]);
  };

  const handleMembersPress = () => {
    setMenuVisible(false);
    router.push(`/space/${slug}/members`);
  };

  const handleSettingsPress = () => {
    setMenuVisible(false);
    Alert.alert('Coming Soon', 'Space settings will be available soon.');
  };

  const items: DropdownMenuItem[] = [
    {
      key: 'members',
      label: 'Members',
      icon: 'people-outline',
      onPress: handleMembersPress,
      disabled: isLeaving,
    },
    {
      key: 'leave',
      label: isLeaving ? 'Leaving...' : 'Leave Space',
      icon: 'exit-outline',
      onPress: handleLeaveSpace,
      destructive: true,
      disabled: isLeaving,
    },
  ];

  if (role === 'admin') {
    items.push({
      key: 'settings',
      label: 'Space Settings',
      icon: 'settings-outline',
      onPress: handleSettingsPress,
      disabled: isLeaving,
    });
  }

  return (
    <>
      <Pressable onPress={() => setMenuVisible(true)} style={styles.menuButton}>
        <Ionicons name="settings-outline" size={22} color={themeColors.text} />
      </Pressable>

      <DropdownMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={items}
        topOffset={60}
      />
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
