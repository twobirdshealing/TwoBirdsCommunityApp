// =============================================================================
// QUICK POST BOX - Simple composer prompt at top of feed
// =============================================================================
// Shows avatar + "What's happening?" - taps to open full composer
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

  // Fetch avatar from profile API
  useEffect(() => {
    const fetchAvatar = async () => {
      if (!user?.username) return;
      
      try {
        const response = await profilesApi.getProfile(user.username);
        if (response.success && response.data.profile?.avatar) {
          setAvatar(response.data.profile.avatar);
        }
      } catch (err) {
        // Silent fail - will show fallback
      }
    };

    fetchAvatar();
  }, [user?.username]);

  // FIXED: Use displayName (camelCase) to match User type in AuthContext
  const displayName = user?.displayName || user?.username || 'User';
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

      {/* Placeholder text */}
      <View style={styles.inputPlaceholder}>
        <Text style={styles.placeholderText}>{placeholder}</Text>
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
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },

  avatarContainer: {
    marginRight: spacing.md,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    color: colors.textInverse,
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  inputPlaceholder: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },

  placeholderText: {
    color: colors.textTertiary,
    fontSize: typography.size.md,
  },
});

export default QuickPostBox;
