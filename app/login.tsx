// =============================================================================
// LOGIN SCREEN - User authentication
// =============================================================================
// Updated: Uses proper logo and background images
// =============================================================================

import React, { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, sizing } from '@/constants/layout';
import { PRIVACY_POLICY_URL, APP_NAME, getLogoSource } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

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
  const [showPassword, setShowPassword] = useState(false);

  const siteName = branding?.site_name || APP_NAME;
  const siteTagline = branding ? branding.site_tagline : 'Community';

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
            <Image
              source={getLogoSource(branding, isDark)}
              placeholder={require('@/assets/images/login_logo.png')}
              style={styles.logo}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={200}
            />
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
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: themeColors.text }]}>Email or Username</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your email or username"
                placeholderTextColor={themeColors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                autoComplete="username"
                editable={!isLoading}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: themeColors.text }]}>Password</Text>
              <View style={[styles.passwordContainer, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                <TextInput
                  style={[styles.passwordInput, { color: themeColors.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={themeColors.textTertiary}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  autoComplete="password"
                  editable={!isLoading}
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  style={styles.showPasswordButton}
                  onPress={() => { hapticLight(); setShowPassword(!showPassword); }}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={themeColors.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Login Button */}
            <AnimatedPressable
              style={[styles.loginButton, { backgroundColor: themeColors.primary }, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
            >
              {isLoading ? (
                <ActivityIndicator color={themeColors.textInverse} />
              ) : (
                <Text style={[styles.loginButtonText, { color: themeColors.textInverse }]}>Sign In</Text>
              )}
            </AnimatedPressable>

            {/* Forgot Password Link */}
            <Pressable style={styles.forgotPassword} onPress={() => router.push('/forgot-password')} accessibilityRole="link" accessibilityLabel="Forgot password">
              <Text style={[styles.forgotPasswordText, { color: themeColors.primary }]}>Forgot password?</Text>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: themeColors.textSecondary }]}>
              Don't have an account?{' '}
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
    marginBottom: spacing.xl,
  },

  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.md,
  },

  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },

  subtitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.medium,
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

  inputContainer: {
    marginBottom: spacing.lg,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },

  input: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  showPasswordButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    borderRadius: sizing.borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
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
