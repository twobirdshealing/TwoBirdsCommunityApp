// =============================================================================
// PROFILE PHOTO PICKER - Shared cover + avatar photo section
// =============================================================================
// Used by: registration step 6, edit profile screen
// Visual: cover photo (landscape) with avatar overlapping at bottom
// Both tappable with camera overlays and loading indicators
// =============================================================================

import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from './Avatar';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ProfilePhotoPickerProps {
  avatarSource?: string | null;
  coverSource?: string | null;
  fallbackName?: string;
  onAvatarPress: () => void;
  onCoverPress: () => void;
  avatarUploading?: boolean;
  coverUploading?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ProfilePhotoPicker({
  avatarSource,
  coverSource,
  fallbackName,
  onAvatarPress,
  onCoverPress,
  avatarUploading,
  coverUploading,
}: ProfilePhotoPickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.photoSection}>
      {/* Cover Photo */}
      <TouchableOpacity
        style={[styles.coverContainer, { backgroundColor: colors.backgroundSecondary }]}
        onPress={onCoverPress}
        activeOpacity={0.85}
        disabled={coverUploading}
      >
        {coverSource ? (
          <Image
            source={{ uri: coverSource }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.coverImage, { backgroundColor: colors.primary }]} />
        )}
        <View style={styles.coverOverlay}>
          {coverUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.coverText}>Change Cover</Text>
            </>
          )}
        </View>
      </TouchableOpacity>

      {/* Avatar */}
      <TouchableOpacity
        style={[styles.avatarWrapper, { borderColor: colors.background }]}
        onPress={onAvatarPress}
        activeOpacity={0.85}
        disabled={avatarUploading}
      >
        <Avatar
          source={avatarSource}
          size="xl"
          fallback={fallbackName}
        />
        {avatarUploading ? (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : (
          <View style={styles.avatarOverlay}>
            <Ionicons name="camera-outline" size={16} color="#fff" />
            <Text style={styles.avatarText}>Change{'\n'}Avatar</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  coverContainer: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },

  coverImage: {
    width: '100%',
    height: '100%',
  },

  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  coverText: {
    color: '#fff',
    fontSize: typography.size.sm,
    fontWeight: '600' as const,
  },

  avatarWrapper: {
    marginTop: -40,
    borderRadius: 48,
    borderWidth: 4,
    position: 'relative',
  },

  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 0,
  },

  avatarText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    marginTop: 2,
  },
});
