// =============================================================================
// PROFILE MENU - Profile settings dropdown menu
// =============================================================================

import { Alert } from 'react-native';
import { DropdownMenu } from '@/components/common';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  onEditProfile: () => void;
}

export function ProfileMenu({ visible, onClose, onEditProfile }: ProfileMenuProps) {
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
      onPress: () => {
        onClose();
        Alert.alert('Coming Soon', 'Account deactivation will be available in a future update.');
      },
      destructive: true,
    },
  ];

  return (
    <DropdownMenu
      visible={visible}
      onClose={onClose}
      items={items}
    />
  );
}
