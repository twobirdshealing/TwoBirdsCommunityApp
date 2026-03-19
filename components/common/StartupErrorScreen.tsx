// =============================================================================
// STARTUP ERROR SCREEN - Generic error gate for failed startup
// =============================================================================
// Shown when essential config can't be loaded (from server or cache).
// Used by _layout.tsx as a gate after the maintenance check.
// =============================================================================

import { getHeaderLogoSource } from '@/constants/config';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Button } from '@/components/common/Button';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface StartupErrorScreenProps {
  onRetry: () => void;
  isRetrying: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function StartupErrorScreen({ onRetry, isRetrying }: StartupErrorScreenProps) {
  const { colors, branding, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const logoSource = getHeaderLogoSource(branding, isDark);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        {logoSource && (
          <Image
            source={logoSource}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
          />
        )}

        <Ionicons name="cloud-offline-outline" size={56} color={colors.textSecondary} style={styles.icon} />

        <Text style={[styles.title, { color: colors.text }]}>
          Unable to Connect
        </Text>

        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Check your internet connection and try again.
        </Text>

        <Button
          title="Try Again"
          icon="refresh-outline"
          onPress={onRetry}
          loading={isRetrying}
          disabled={isRetrying}
        />
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
    fontSize: typography.size.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  message: {
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
});
