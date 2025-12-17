// =============================================================================
// SPACE CARD COMPONENT - Unified card for all space displays
// =============================================================================
// Fixed: Removed broken placeholder URL, uses gradient fallback
// Shows: title, description, privacy icon
// =============================================================================

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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

  // Use actual cover photo or fallback
  const hasCoverPhoto = space.cover_photo && space.cover_photo.trim() !== '';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {/* Cover Photo or Gradient Fallback */}
      {hasCoverPhoto ? (
        <Image source={{ uri: space.cover_photo }} style={styles.cover} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#d946ef']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}
        >
          {space.settings?.emoji && (
            <Text style={styles.coverEmoji}>{space.settings.emoji}</Text>
          )}
        </LinearGradient>
      )}

      {/* Logo Overlay (if exists and has cover photo) */}
      {space.logo && hasCoverPhoto && (
        <Image source={{ uri: space.logo }} style={styles.logo} resizeMode="cover" />
      )}

      {/* Emoji Badge (if exists and has cover photo) */}
      {space.settings?.emoji && hasCoverPhoto && (
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{space.settings.emoji}</Text>
        </View>
      )}

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
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverEmoji: {
    fontSize: 48,
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
  emojiContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 20,
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
