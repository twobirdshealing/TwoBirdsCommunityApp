// =============================================================================
// SPACE MENU COMPONENT - Context menu for space actions
// =============================================================================
// Mirrors the web's kebab menu on a space:
//   - Members           (always)
//   - Documents         (when settings.document_library === 'yes' AND user can view)
//   - Chat              (when chat_thread_id exists AND group_chat_support === 'yes')
//   - Featured Posts    (always — empty state if 0 pinned)
//   - Recent Activity   (always — empty state if 0 events)
//   - Space Settings    (admins only — placeholder for now)
//   - Leave Space       (always)
//
// Each new item opens a bottom sheet (or routes to the existing space-chat
// screen, in Chat's case). About is intentionally omitted — `SpaceInfoHeader`
// already shows cover/title/privacy/description inline below the page header.
// =============================================================================

import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import { SpaceFeaturedSheet } from '@/components/space/SpaceFeaturedSheet';
import { SpaceActivitySheet } from '@/components/space/SpaceActivitySheet';
import { SpaceDocumentsSheet } from '@/components/space/SpaceDocumentsSheet';
import { sizing } from '@/constants/layout';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import type { Space } from '@/types/space';
import { spacesApi } from '@/services/api/spaces';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { createLogger } from '@/utils/logger';

const log = createLogger('SpaceMenu');

interface SpaceMenuProps {
  /** Full space object — needed to gate Chat/Documents and feed sheets the space id. */
  space: Space;
  role?: 'member' | 'moderator' | 'admin';
  onLeaveSuccess?: () => void;
}

type ActiveSheet = null | 'featured' | 'activity' | 'documents';

export function SpaceMenu({ space, role, onLeaveSuccess }: SpaceMenuProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const { colors: themeColors } = useTheme();

  const slug = space.slug;
  const spaceId = space.id;
  const chatThreadId = space.chat_thread_id;
  const chatEnabled =
    space.settings?.group_chat_support === 'yes' && !!chatThreadId;
  const canViewDocuments = !!space.permissions?.can_view_documents;

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleLeaveSpace = () => {
    setMenuVisible(false);

    Alert.alert('Leave Space', 'Are you sure you want to leave this space?', [
      { text: 'Cancel', style: 'cancel' },
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

  const handleChatPress = () => {
    setMenuVisible(false);
    if (!chatThreadId) return;
    router.push({
      pathname: '/messages/space/[threadId]',
      params: { threadId: String(chatThreadId) },
    });
  };

  const openSheet = (sheet: Exclude<ActiveSheet, null>) => {
    setMenuVisible(false);
    // Defer mounting the sheet by a frame so the dropdown's modal has time to
    // dismiss — avoids both modals fighting for the screen on iOS.
    requestAnimationFrame(() => setActiveSheet(sheet));
  };

  // ---------------------------------------------------------------------------
  // Build menu items in display order
  // ---------------------------------------------------------------------------

  const items: DropdownMenuItem[] = [
    {
      key: 'members',
      label: 'Members',
      icon: 'people-outline',
      onPress: handleMembersPress,
      disabled: isLeaving,
    },
  ];

  if (canViewDocuments) {
    items.push({
      key: 'documents',
      label: 'Documents',
      icon: 'folder-open-outline',
      onPress: () => openSheet('documents'),
      disabled: isLeaving,
    });
  }

  if (chatEnabled) {
    items.push({
      key: 'chat',
      label: 'Chat',
      icon: 'chatbubbles-outline',
      onPress: handleChatPress,
      disabled: isLeaving,
    });
  }

  items.push({
    key: 'featured',
    label: 'Featured Posts',
    icon: 'star-outline',
    onPress: () => openSheet('featured'),
    disabled: isLeaving,
  });

  items.push({
    key: 'activity',
    label: 'Recent Activity',
    icon: 'time-outline',
    onPress: () => openSheet('activity'),
    disabled: isLeaving,
  });

  if (role === 'admin') {
    items.push({
      key: 'settings',
      label: 'Space Settings',
      icon: 'settings-outline',
      onPress: handleSettingsPress,
      disabled: isLeaving,
    });
  }

  items.push({
    key: 'leave',
    label: isLeaving ? 'Leaving...' : 'Leave Space',
    icon: 'exit-outline',
    onPress: handleLeaveSpace,
    destructive: true,
    disabled: isLeaving,
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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

      <SpaceFeaturedSheet
        visible={activeSheet === 'featured'}
        onClose={() => setActiveSheet(null)}
        spaceId={spaceId}
      />
      <SpaceActivitySheet
        visible={activeSheet === 'activity'}
        onClose={() => setActiveSheet(null)}
        spaceId={spaceId}
      />
      <SpaceDocumentsSheet
        visible={activeSheet === 'documents'}
        onClose={() => setActiveSheet(null)}
        spaceId={spaceId}
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
