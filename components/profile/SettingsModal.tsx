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
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

export function SettingsModal({ visible, onClose, userEmail, userName }: SettingsModalProps) {
  const { logout } = useAuth();
  const { colors: themeColors } = useTheme();

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
            <View style={[styles.modal, { backgroundColor: themeColors.surface }]}>
              {/* User Info */}
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: themeColors.text }]}>{userName || 'User'}</Text>
                {userEmail && <Text style={[styles.userEmail, { color: themeColors.textSecondary }]}>{userEmail}</Text>}
              </View>

              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

              {/* Menu Items */}
              <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); }}>
                <Text style={styles.menuIcon}>👤</Text>
                <Text style={[styles.menuText, { color: themeColors.text }]}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); }}>
                <Text style={styles.menuIcon}>🔖</Text>
                <Text style={[styles.menuText, { color: themeColors.text }]}>Bookmarks</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { onClose(); }}>
                <Text style={styles.menuIcon}>🔔</Text>
                <Text style={[styles.menuText, { color: themeColors.text }]}>Notification Settings</Text>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: themeColors.border }]} />

              {/* Logout */}
              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Text style={styles.menuIcon}>🚪</Text>
                <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
              </TouchableOpacity>

              {/* App Version */}
              <View style={[styles.footer, { borderTopColor: themeColors.border }]}>
                <Text style={[styles.version, { color: themeColors.textTertiary }]}>Two Birds Community v1.0.0</Text>
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
  },

  userEmail: {
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },

  divider: {
    height: 1,
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
  },

  logoutText: {
  },

  footer: {
    padding: spacing.lg,
    alignItems: 'center',
    borderTopWidth: 1,
  },

  version: {
    fontSize: typography.size.xs,
  },
});

export default SettingsModal;
