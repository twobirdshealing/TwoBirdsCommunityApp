// =============================================================================
// LOGIN SCREEN - User authentication
// =============================================================================
// Updated: Uses proper logo and background images
// =============================================================================

import React, { useState } from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, sizing } from '@/constants/layout';
import { PRIVACY_POLICY_URL, APP_NAME, getLogoSource } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { hapticMedium } from '@/utils/haptics';
import { Button } from '@/components/common/Button';
import { TextInputField } from '@/components/common/TextInputField';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();
  const { colors: themeColors, branding, isDark } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const siteName = branding?.site_name || APP_NAME;
  const siteTagline = branding ? branding.site_tagline : 'Community';
  const logoSource = getLogoSource(branding, isDark);

  const handleLogin = async () => {
    hapticMedium();
    setError(null);

    if (!username.trim()) {
      setError('Please enter your email or username');
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    const result = await login(username.trim(), password);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/login_background_img.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior="padding"
      >
        <View style={styles.content}>
          {/* Logo / Header */}
          <View style={styles.header}>
            {logoSource && (
              <Image
                source={logoSource}
                style={styles.logo}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={200}
              />
            )}
            <Text style={[styles.title, { color: themeColors.text }]}>{siteName}</Text>
            {siteTagline ? <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{siteTagline}</Text> : null}
          </View>

          {/* Form Card */}
          <View style={[styles.formCard, { backgroundColor: withOpacity(themeColors.surface, 0.95) }]}>
            {/* Error Message */}
            {error && (
              <View style={[styles.errorContainer, { backgroundColor: themeColors.errorLight, borderColor: withOpacity(themeColors.error, 0.3) }]}>
                <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
              </View>
            )}

            {/* Username/Email Input */}
            <TextInputField
              label="Email or Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your email or username"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="username"
              editable={!isLoading}
            />

            {/* Password Input */}
            <TextInputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              password
              textContentType="password"
              autoComplete="password"
              editable={!isLoading}
              onSubmitEditing={handleLogin}
            />

            {/* Login Button */}
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              style={styles.loginButton}
            />

            {/* Forgot Password Link */}
            <Pressable style={styles.forgotPassword} onPress={() => router.push('/forgot-password')} accessibilityRole="link" accessibilityLabel="Forgot password">
              <Text style={[styles.forgotPasswordText, { color: themeColors.primary }]}>Forgot password?</Text>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
              Don&rsquo;t have an account?{' '}
              <Text
                style={[styles.footerLink, { color: themeColors.primary }]}
                onPress={() => router.push('/register')}
              >
                Sign up
              </Text>
            </Text>
            <Pressable
              style={styles.privacyLink}
              onPress={() => router.push({ pathname: '/webview', params: { url: PRIVACY_POLICY_URL, title: 'Privacy Policy', noAuth: '1' } })}
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
            >
              <Text style={[styles.privacyLinkText, { color: themeColors.textTertiary }]}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Bottom safe area - outside KAV so keyboard calc is correct */}
      <View style={{ height: insets.bottom }} />
    </ImageBackground>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },

  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  logo: {
    width: 250,
    height: 180,
  },

  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },

  subtitle: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  // Form Card
  formCard: {
    borderRadius: sizing.borderRadius.lg,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },

  errorContainer: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  errorText: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  loginButton: {
    marginTop: spacing.md,
  },

  forgotPassword: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },

  forgotPasswordText: {
    fontSize: typography.size.sm,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },

  footerText: {
    fontSize: typography.size.sm,
  },

  footerLink: {
    fontWeight: typography.weight.semibold,
  },

  privacyLink: {
    marginTop: spacing.md,
  },

  privacyLinkText: {
    fontSize: typography.size.xs,
  },
});
