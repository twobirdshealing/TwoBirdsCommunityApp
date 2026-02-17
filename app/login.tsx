// =============================================================================
// LOGIN SCREEN - User authentication
// =============================================================================
// Updated: Uses proper logo and background images
// =============================================================================

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();
  const { colors: themeColors } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
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
        style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Logo / Header */}
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/login_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={[styles.title, { color: themeColors.text }]}>Two Birds</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Community</Text>
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
                <TouchableOpacity
                  style={styles.showPasswordButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.showPasswordText}>
                    {showPassword ? '🙈' : '👁️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: themeColors.primary }, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={themeColors.textInverse} />
              ) : (
                <Text style={[styles.loginButtonText, { color: themeColors.textInverse }]}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <TouchableOpacity style={styles.forgotPassword} onPress={() => router.push('/forgot-password')}>
              <Text style={[styles.forgotPasswordText, { color: themeColors.primary }]}>Forgot password?</Text>
            </TouchableOpacity>
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
          </View>
        </View>
      </KeyboardAvoidingView>
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
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },

  subtitle: {
    fontSize: 20,
    fontWeight: '500',
  },

  // Form Card
  formCard: {
    borderRadius: 20,
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
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
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

  showPasswordText: {
    fontSize: 20,
  },

  errorContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  errorText: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  loginButton: {
    borderRadius: 12,
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
});
