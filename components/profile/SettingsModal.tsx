// =============================================================================
// SETTINGS MODAL - Profile settings with logout
// =============================================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

export function SettingsModal({ visible, onClose, userEmail, userName }: SettingsModalProps) {
  const { logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await logout();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              {/* User Info */}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{userName || 'User'}</Text>
                {userEmail && <Text style={styles.userEmail}>{userEmail}</Text>}
              </View>

              <View style={styles.divider} />

              {/* Menu Items */}
              <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); }}>
                <Text style={styles.menuIcon}>👤</Text>
                <Text style={styles.menuText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); }}>
                <Text style={styles.menuIcon}>🔖</Text>
                <Text style={styles.menuText}>Bookmarks</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); }}>
                <Text style={styles.menuIcon}>🔔</Text>
                <Text style={styles.menuText}>Notification Settings</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Logout */}
              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Text style={styles.menuIcon}>🚪</Text>
                <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
              </TouchableOpacity>

              {/* App Version */}
              <View style={styles.footer}>
                <Text style={styles.version}>Two Birds Community v1.0.0</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  modal: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },

  userInfo: {
    padding: spacing.lg,
    alignItems: 'center',
  },

  userName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },

  userEmail: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  menuIcon: {
    fontSize: 18,
    marginRight: spacing.md,
    width: 28,
    textAlign: 'center',
  },

  menuText: {
    fontSize: typography.size.md,
    color: colors.text,
  },

  logoutText: {
    color: colors.error,
  },

  footer: {
    padding: spacing.lg,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  version: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
  },
});

export default SettingsModal;
