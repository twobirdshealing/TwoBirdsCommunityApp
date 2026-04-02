// =============================================================================
// FORGOT PASSWORD SCREEN - Email-based password recovery
// =============================================================================
// User enters email/username → server sends password reset email → success msg
// =============================================================================

import React, { useCallback, useState } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, sizing } from '@/constants/layout';
import { getLogoSource } from '@/constants/config';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { forgotPassword } from '@/services/api/registration';
import { Button } from '@/components/common/Button';
import { TextInputField } from '@/components/common/TextInputField';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors, branding, isDark } = useTheme();

  // State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [login, setLogin] = useState('');
  const logoSource = getLogoSource(branding, isDark);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleForgot = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);

    if (!login.trim()) {
      setError('Please enter your email or username.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await forgotPassword(login.trim());

      if (result.email_sent || result.success) {
        setSuccessMessage(result.message || 'Check your email for a password reset link.');
      } else {
        setError(result.message || 'Something went wrong. Please try again.');
      }
    } catch (e) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [login]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
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
          </View>

          {/* Form Card */}
          <View style={[styles.formCard, { backgroundColor: withOpacity(themeColors.surface, 0.95) }]}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: themeColors.text }]}>
                Forgot Password?
              </Text>
              <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
                Enter your email or username and we'll send you a password reset link.
              </Text>
            </View>

            {/* Success Message */}
            {successMessage && (
              <View style={[styles.successContainer, { backgroundColor: themeColors.successLight, borderColor: withOpacity(themeColors.success, 0.3) }]}>
                <Text style={[styles.successText, { color: themeColors.success }]}>{successMessage}</Text>
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={[styles.errorContainer, { backgroundColor: themeColors.errorLight, borderColor: withOpacity(themeColors.error, 0.3) }]}>
                <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
              </View>
            )}

            {!successMessage ? (
              <>
                <TextInputField
                  label="Email or Username"
                  value={login}
                  onChangeText={setLogin}
                  placeholder="Enter your email or username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  autoComplete="username"
                  editable={!submitting}
                  onSubmitEditing={handleForgot}
                />

                <Button
                  title="Send Reset Link"
                  onPress={handleForgot}
                  loading={submitting}
                  style={styles.buttonMargin}
                />
              </>
            ) : null}

            <Button
              title="Back to Login"
              variant="text"
              onPress={() => router.back()}
              style={styles.linkButton}
            />
          </View>
        </ScrollView>
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

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  logo: {
    width: 80,
    height: 80,
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

  // Step header
  stepHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  stepTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },

  stepSubtitle: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Messages
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

  successContainer: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  successText: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  // Buttons
  buttonMargin: {
    marginTop: spacing.md,
  },

  linkButton: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
});
