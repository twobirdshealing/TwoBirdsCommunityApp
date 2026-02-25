// =============================================================================
// PROFILE MENU - Profile settings dropdown menu
// =============================================================================

import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DropdownMenu } from '@/components/common';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';
import { deactivateAccount, deleteAccount } from '@/services/api/account';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
}

export function ProfileMenu({ visible, onClose, onEditProfile }: ProfileMenuProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const { colors: themeColors } = useTheme();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Deactivate Account
  // ---------------------------------------------------------------------------

  const handleDeactivate = () => {
    onClose();
    Alert.alert(
      'Deactivate Account',
      'Your profile will be hidden from other members. You can reactivate it by logging in on the website.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            const result = await deactivateAccount();
            if (result.success) {
              await logout();
              router.replace('/login');
            } else {
              Alert.alert('Error', result.error?.message || 'Failed to deactivate account.');
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Delete Account — two-step: Alert → type "DELETE" in modal
  // ---------------------------------------------------------------------------

  const handleDeletePress = () => {
    onClose();
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and ALL your data including posts, comments, messages, and profile information.\n\nThis action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setDeleteModalVisible(true);
          },
        },
      ]
    );
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    const result = await deleteAccount();
    setDeleting(false);

    if (result.success) {
      setDeleteModalVisible(false);
      await logout();
      router.replace('/login');
    } else {
      Alert.alert('Error', result.error?.message || 'Failed to delete account.');
    }
  };

  // ---------------------------------------------------------------------------
  // Menu Items
  // ---------------------------------------------------------------------------

  const items: DropdownMenuItem[] = [
    {
      key: 'edit-profile',
      label: 'Edit Profile',
      icon: 'create-outline',
      onPress: () => { onClose(); onEditProfile(); },
    },
    {
      key: 'deactivate',
      label: 'Deactivate Account',
      icon: 'person-remove-outline',
      onPress: handleDeactivate,
      destructive: true,
    },
    {
      key: 'delete',
      label: 'Delete Account',
      icon: 'trash-outline',
      onPress: handleDeletePress,
      destructive: true,
    },
  ];

  return (
    <>
      <DropdownMenu
        visible={visible}
        onClose={onClose}
        items={items}
      />

      {/* Delete Confirmation Modal — requires typing "DELETE" */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteModalVisible(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: themeColors.overlay }]}
          onPress={() => !deleting && setDeleteModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: themeColors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Ionicons name="warning-outline" size={40} color={themeColors.error} />
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Confirm Deletion</Text>
            <Text style={[styles.modalDescription, { color: themeColors.textSecondary }]}>
              Type <Text style={{ fontWeight: '700', color: themeColors.error }}>DELETE</Text> to permanently delete your account.
            </Text>
            <TextInput
              style={[styles.modalInput, {
                backgroundColor: themeColors.background,
                borderColor: deleteConfirmText === 'DELETE' ? themeColors.error : themeColors.border,
                color: themeColors.text,
              }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={themeColors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: themeColors.background }]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
              >
                <Text style={[styles.modalButtonText, { color: themeColors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  { backgroundColor: themeColors.error },
                  deleteConfirmText !== 'DELETE' && styles.modalButtonDisabled,
                ]}
                onPress={handleDeleteConfirm}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
              >
                <Text style={[styles.modalButtonText, { color: themeColors.textInverse }]}>
                  {deleting ? 'Deleting...' : 'Delete Forever'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: typography.size.lg,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  modalDescription: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontWeight: '600',
    letterSpacing: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.4,
  },
  modalButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },
});
