// =============================================================================
// MAINTENANCE SCREEN - Blocking overlay for maintenance / coming soon mode
// =============================================================================
// Shows admin-configured message, auto-retries every 30s, manual retry button,
// and a login button so bypass-eligible users can authenticate.
// =============================================================================

import { getHeaderLogoSource } from '@/constants/config';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={getHeaderLogoSource(branding, isDark)}
          placeholder={require('@/assets/images/logo.png')}
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={200}
        />

        {/* Icon */}
        <Ionicons name="construct-outline" size={56} color={colors.textSecondary} style={styles.icon} />

        {/* Message */}
        <Text style={[styles.message, { color: colors.text }]}>
          {message || 'We are performing scheduled maintenance. Please check back shortly.'}
        </Text>

        {/* Retry button */}
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={onRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color={colors.textInverse} />
              <Text style={[styles.retryText, { color: colors.textInverse }]}>Try Again</Text>
            </>
          )}
        </Pressable>

        <Text style={[styles.autoRetry, { color: colors.textTertiary }]}>
          Auto-checking every 30 seconds
        </Text>
      </View>

      {/* Bottom: Login or Logout button */}
      <View style={styles.bottomSection}>
        {isAuthenticated ? (
          onLogout && (
            <Pressable
              style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}
              onPress={onLogout}
            >
              <Text style={[styles.textButtonLabel, { color: colors.textSecondary }]}>Logout</Text>
            </Pressable>
          )
        ) : (
          onLogin && (
            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={onLogin}
            >
              <Ionicons name="log-in-outline" size={18} color={colors.text} />
              <Text style={[styles.loginText, { color: colors.text }]}>Login</Text>
            </Pressable>
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

  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    minWidth: 140,
    gap: spacing.sm,
  },

  retryText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  autoRetry: {
    fontSize: typography.size.sm,
    marginTop: spacing.md,
  },

  bottomSection: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },

  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },

  loginText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },

  textButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  textButtonLabel: {
    fontSize: typography.size.md,
  },
});
