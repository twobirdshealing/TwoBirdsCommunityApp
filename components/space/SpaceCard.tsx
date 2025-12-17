// =============================================================================
// SPACE CARD COMPONENT - Unified card for all space displays
// =============================================================================
// Shows: title, description, privacy icon
// Keeps member count and detailed stats for the space detail page
// =============================================================================

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Space } from '@/types';

interface SpaceCardProps {
  space: Space;
  onPress: () => void;
}

export function SpaceCard({ space, onPress }: SpaceCardProps) {
  // Privacy icon and label helpers
  const getPrivacyIcon = (): string => {
    switch (space.privacy) {
      case 'public':
        return '🌍';
      case 'private':
        return '🔒';
      case 'secret':
        return '🔐';
      default:
        return '🌍';
    }
  };

  const getPrivacyLabel = (): string => {
    return space.privacy.charAt(0).toUpperCase() + space.privacy.slice(1);
  };

  // Default cover if none provided
  const coverPhoto = space.cover_photo || 'https://via.placeholder.com/400x120/e0e0e0/666?text=Space';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {/* Cover Photo */}
      <Image source={{ uri: coverPhoto }} style={styles.cover} resizeMode="cover" />

      {/* Logo Overlay (if exists) */}
      {space.logo && <Image source={{ uri: space.logo }} style={styles.logo} resizeMode="cover" />}

      {/* Emoji Badge (if exists) */}
      {space.settings?.emoji && <Text style={styles.emoji}>{space.settings.emoji}</Text>}

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {space.title}
        </Text>

        {/* Description */}
        {space.description && (
          <Text style={styles.description} numberOfLines={2}>
            {space.description.replace(/<[^>]*>/g, '')}
          </Text>
        )}

        {/* Privacy Indicator */}
        <View style={styles.footer}>
          <Text style={styles.privacy}>
            {getPrivacyIcon()} {getPrivacyLabel()}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  cover: {
    width: '100%',
    height: 120,
    backgroundColor: '#e0e0e0',
  },
  logo: {
    position: 'absolute',
    top: 70,
    left: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  emoji: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    width: 40,
    height: 40,
    textAlign: 'center',
    lineHeight: 40,
  },
  content: {
    padding: 16,
    paddingTop: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacy: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
});
