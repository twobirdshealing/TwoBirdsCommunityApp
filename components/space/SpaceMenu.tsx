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
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { spacesApi } from '@/services/api/spaces';

interface SpaceMenuProps {
  slug: string;
  role?: 'member' | 'moderator' | 'admin';
  onLeaveSuccess?: () => void;
}

export function SpaceMenu({ slug, role, onLeaveSuccess }: SpaceMenuProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

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

            // Navigate back and trigger success callback
            router.back();
            onLeaveSuccess?.();
          } catch (error) {
            console.error('Error leaving space:', error);
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
    // TODO: Implement space settings screen
    Alert.alert('Coming Soon', 'Space settings will be available soon.');
  };

  return (
    <>
      {/* Menu Button */}
      <Pressable onPress={() => setMenuVisible(true)} style={styles.menuButton}>
        <Text style={styles.menuIcon}>⋯</Text>
      </Pressable>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            {/* Members List */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleMembersPress}
              disabled={isLeaving}
            >
              <Text style={styles.menuItemIcon}>👥</Text>
              <Text style={styles.menuItemText}>Members</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Leave Space (red/destructive) */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLeaveSpace}
              disabled={isLeaving}
            >
              <Text style={styles.menuItemIcon}>🚪</Text>
              <Text style={[styles.menuItemText, styles.destructiveText]}>
                {isLeaving ? 'Leaving...' : 'Leave Space'}
              </Text>
            </TouchableOpacity>

            {/* Admin: Space Settings (future) */}
            {role === 'admin' && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleSettingsPress}
                  disabled={isLeaving}
                >
                  <Text style={styles.menuItemIcon}>⚙️</Text>
                  <Text style={styles.menuItemText}>Space Settings</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  destructiveText: {
    color: '#d32f2f',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
});