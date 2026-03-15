// =============================================================================
// SPACE LOCK SCREEN - Shown to non-members of private spaces
// =============================================================================
// Handles 3 modes: default lock screen, custom blocks, and pending state.
// Redirect mode is handled by the parent (SpacePage) before rendering this.
// =============================================================================

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { Button } from '@/components/common/Button';
import { LockScreenBlock, LockScreenConfig } from '@/types/space';
import { stripHtmlTags } from '@/utils/htmlToText';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SpaceLockScreenProps {
  config: LockScreenConfig;
  onRequestAccess: () => void;
  isPending: boolean;
  isRequesting: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SpaceLockScreen({ config, onRequestAccess, isPending, isRequesting }: SpaceLockScreenProps) {
  const { colors: themeColors } = useTheme();

  // Pending state (from API or after successful request)
  if (isPending || config.is_pending) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={[styles.defaultCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Ionicons name="time-outline" size={48} color={themeColors.textTertiary} />
          <Text style={[styles.defaultTitle, { color: themeColors.text }]}>
            You're all set!
          </Text>
          <Text style={[styles.defaultDescription, { color: themeColors.textSecondary }]}>
            A team member will review and let you in soon.
          </Text>
        </View>
      </View>
    );
  }

  // Custom lock screen with blocks
  if (config.showCustom && config.lockScreen) {
    return (
      <ScrollView style={{ backgroundColor: themeColors.background }} contentContainerStyle={styles.customContainer}>
        {config.lockScreen
          .filter(block => !block.hidden)
          .map((block, index) => (
            <LockScreenBlockRenderer key={`${block.name}-${index}`} block={block} />
          ))}
        {config.canSendRequest && (
          <View style={styles.requestButtonContainer}>
            <Button
              title="Ask to Join"
              onPress={onRequestAccess}
              loading={isRequesting}
            />
          </View>
        )}
      </ScrollView>
    );
  }

  // Default lock screen
  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.defaultCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Ionicons name="lock-closed-outline" size={48} color={themeColors.textTertiary} />
        <Text style={[styles.defaultTitle, { color: themeColors.text }]}>
          This is a private space
        </Text>
        <Text style={[styles.defaultDescription, { color: themeColors.textSecondary }]}>
          Ask to join and a team member will let you in soon.
        </Text>
        {config.canSendRequest && (
          <Button
            title="Request Access"
            onPress={onRequestAccess}
            loading={isRequesting}
            style={styles.requestButton}
          />
        )}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Block Renderer
// -----------------------------------------------------------------------------

function LockScreenBlockRenderer({ block }: { block: LockScreenBlock }) {
  const { colors: themeColors } = useTheme();
  const router = useRouter();

  if (block.type === 'image') {
    const hasBackground = block.background_image && block.background_image.trim() !== '';
    const overlayColor = block.overlay_color || themeColors.textSecondary;

    const handleButtonPress = () => {
      if (block.button_link && block.button_link.trim()) {
        router.push(`/webview?url=${encodeURIComponent(block.button_link)}`);
      }
    };

    return (
      <View style={[styles.imageBlock, { backgroundColor: overlayColor }]}>
        {hasBackground && (
          <Image
            source={{ uri: block.background_image }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayColor, opacity: hasBackground ? 0.7 : 1 }]} />
        <View style={styles.imageBlockContent}>
          {block.heading && (
            <Text style={[styles.imageBlockHeading, { color: block.heading_color || '#fff' }]}>
              {block.heading}
            </Text>
          )}
          {block.description && (
            <Text style={[styles.imageBlockDescription, { color: block.text_color || '#fff' }]}>
              {block.description}
            </Text>
          )}
          {block.button_text && block.button_link?.trim() && (
            <Pressable
              onPress={handleButtonPress}
              style={[styles.blockButton, { backgroundColor: block.button_color || themeColors.primaryDark }]}
            >
              <Text style={[styles.blockButtonText, { color: block.button_text_color || '#fff' }]}>
                {block.button_text}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (block.type === 'block' && block.content) {
    const text = stripHtmlTags(block.content).trim();
    if (!text) return null;

    return (
      <View style={[styles.textBlock, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.textBlockContent, { color: themeColors.text }]}>
          {text}
        </Text>
      </View>
    );
  }

  return null;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },

  // Default lock screen
  defaultCard: {
    alignItems: 'center',
    padding: spacing.xxl,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
    width: '100%',
    gap: spacing.sm,
  },
  defaultTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  defaultDescription: {
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: typography.size.md * 1.5,
  },

  // Request button
  requestButton: {
    marginTop: spacing.md,
  },
  requestButtonContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },

  // Custom lock screen
  customContainer: {
    paddingBottom: spacing.xxl,
  },

  // Image block (Banner / CTA)
  imageBlock: {
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imageBlockContent: {
    alignItems: 'center',
    padding: spacing.xl,
    zIndex: 1,
  },
  imageBlockHeading: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  imageBlockDescription: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  blockButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
  },
  blockButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  // Text block (Description)
  textBlock: {
    padding: spacing.lg,
  },
  textBlockContent: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.5,
  },
});
