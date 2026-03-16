// =============================================================================
// MAINTENANCE SCREEN - Blocking overlay for maintenance / coming soon mode
// =============================================================================
// Shows admin-configured message, auto-retries every 30s, manual retry button,
// and a login button so bypass-eligible users can authenticate.
// =============================================================================

import { getHeaderLogoSource } from '@/constants/config';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Button } from '@/components/common/Button';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface MaintenanceScreenProps {
  message: string;
  onRetry: () => void;
  onLogin?: () => void;
  onLogout?: () => void;
  isAuthenticated?: boolean;
  isRetrying?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MaintenanceScreen({
  message,
  onRetry,
  onLogin,
  onLogout,
  isAuthenticated = false,
  isRetrying = false,
}: MaintenanceScreenProps) {
  const { colors, branding, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-retry every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(onRetry, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onRetry]);

  const logoSource = getHeaderLogoSource(branding, isDark);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        {/* Logo */}
        {logoSource && (
          <Image
            source={logoSource}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={200}
          />
        )}

        {/* Icon */}
        <Ionicons name="construct-outline" size={56} color={colors.textSecondary} style={styles.icon} />

        {/* Message */}
        <Text style={[styles.message, { color: colors.text }]}>
          {message || 'We are performing scheduled maintenance. Please check back shortly.'}
        </Text>

        {/* Retry button */}
        <Button
          title="Try Again"
          icon="refresh-outline"
          onPress={onRetry}
          loading={isRetrying}
          disabled={isRetrying}
        />

        <Text style={[styles.autoRetry, { color: colors.textTertiary }]}>
          Auto-checking every 30 seconds
        </Text>
      </View>

      {/* Bottom: Login or Logout button */}
      <View style={styles.bottomSection}>
        {isAuthenticated ? (
          onLogout && (
            <Button
              title="Logout"
              variant="text"
              onPress={onLogout}
            />
          )
        ) : (
          onLogin && (
            <Button
              title="Login"
              variant="secondary"
              icon="log-in-outline"
              onPress={onLogin}
            />
          )
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

  message: {
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
    maxWidth: 320,
  },

  autoRetry: {
    fontSize: typography.size.sm,
    marginTop: spacing.md,
  },

  bottomSection: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },

});
