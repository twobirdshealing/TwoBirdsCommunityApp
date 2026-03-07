// =============================================================================
// FORCE UPDATE SCREEN - Blocking overlay when app version is below minimum
// =============================================================================
// Shown before auth/maintenance — user cannot proceed until they update.
// =============================================================================

import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { UpdateConfig } from '@/services/api/theme';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ForceUpdateScreenProps {
  updateConfig: UpdateConfig;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ForceUpdateScreen({ updateConfig }: ForceUpdateScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const storeUrl = Platform.OS === 'ios'
    ? updateConfig.ios_store_url
    : updateConfig.android_store_url;

  const handleUpdate = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
        />

        {/* Icon */}
        <Ionicons name="cloud-download-outline" size={56} color={colors.textSecondary} style={styles.icon} />

        {/* Message */}
        <Text style={[styles.title, { color: colors.text }]}>
          Update Required
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          A new version of Two Birds is available. Please update to continue using the app.
        </Text>

        {/* Update button (only if store URL is configured) */}
        {storeUrl ? (
          <Pressable
            style={({ pressed }) => [
              styles.updateButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleUpdate}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color={colors.textInverse} />
            <Text style={[styles.updateText, { color: colors.textInverse }]}>Update Now</Text>
          </Pressable>
        ) : (
          <Text style={[styles.fallback, { color: colors.textTertiary }]}>
            Please update from your app store.
          </Text>
        )}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  logo: {
    width: 160,
    height: 44,
    marginBottom: spacing.xl,
  },

  icon: {
    marginBottom: spacing.lg,
  },

  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  message: {
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    maxWidth: 320,
  },

  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    minWidth: 140,
    gap: spacing.sm,
  },

  updateText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  fallback: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
});
