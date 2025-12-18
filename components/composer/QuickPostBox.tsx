// =============================================================================
// QUICK POST BOX - Simple composer prompt at top of feed
// =============================================================================
// Shows avatar + "What's happening?" - taps to expand to full composer
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { profilesApi } from '@/services/api';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface QuickPostBoxProps {
  placeholder?: string;
  onPress: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function QuickPostBox({
  placeholder = "What's happening?",
  onPress,
}: QuickPostBoxProps) {
  const { user } = useAuth();
  const [avatar, setAvatar] = useState<string | null>(null);

  // Fetch avatar
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user?.username) return;
      
      try {
        const response = await profilesApi.getProfile(user.username);
        if (response.success && response.data.profile?.avatar) {
          setAvatar(response.data.profile.avatar);
        }
      } catch (err) {
        // Silent fail
      }
    };

    fetchAvatar();
  }, [user?.username]);

  const displayName = user?.display_name || user?.username || 'User';
  const firstName = displayName.split(' ')[0];

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Input Placeholder */}
      <View style={styles.inputContainer}>
        <Text style={styles.placeholder}>
          {placeholder.replace('{name}', firstName)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  avatarContainer: {
    marginRight: spacing.md,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.skeleton,
  },

  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  inputContainer: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },

  placeholder: {
    fontSize: typography.size.md,
    color: colors.textTertiary,
  },
});

export default QuickPostBox;
