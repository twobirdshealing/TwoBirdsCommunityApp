// =============================================================================
// FORGOT PASSWORD SCREEN - OTP-based password recovery
// =============================================================================
// Step 1: Enter email/username → sends OTP to phone (or email fallback)
// Step 2: Enter OTP code → verifies and returns reset token
// Step 3: Set new password → resets password
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
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
import { getLogoSource } from '@/constants/config';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { forgotPassword, resetPassword } from '@/services/api/registration';
import { verifyOtp, resendOtp, requestVoiceCall } from '@/services/api/otp';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { PasswordStrengthMeter } from '@/components/common/PasswordStrengthMeter';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Step = 1 | 2 | 3;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors, branding, isDark } = useTheme();

  // State
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Step 1: Login input
  const [login, setLogin] = useState('');

  // Step 2: OTP state
  const [otpCode, setOtpCode] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [voiceFallback, setVoiceFallback] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Step 3: New password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetLogin, setResetLogin] = useState('');

  // ---------------------------------------------------------------------------
  // Resend timer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // ---------------------------------------------------------------------------
  // Step 1: Submit login
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

      if (result.otp_sent && result.session_key) {
        // OTP sent to phone → go to step 2
        setSessionKey(result.session_key);
        setPhoneMasked(result.phone_masked || '');
        setVoiceFallback(result.voice_fallback || false);
        setResendTimer(60);
        setStep(2);
      } else if (result.email_sent) {
        // Email fallback — show message, stay on step 1
        setSuccessMessage(result.message || 'Check your email for a password reset link.');
      } else if (!result.success) {
        setError(result.message || 'Something went wrong. Please try again.');
      }
    } catch (e) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [login]);

  // ---------------------------------------------------------------------------
  // Step 2: Verify OTP
  // ---------------------------------------------------------------------------

  const handleVerifyOtp = useCallback(async () => {
    setError(null);

    if (!otpCode.length) {
      setError('Please enter the verification code.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await verifyOtp(sessionKey, otpCode);

      if (result.success && result.reset_token && result.login) {
        setResetToken(result.reset_token);
        setResetLogin(result.login);
        setStep(3);
      } else {
        setError(result.message || 'Invalid code. Please try again.');
      }
    } catch (e) {
      setError('Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [otpCode, sessionKey]);

  const handleResendOtp = useCallback(async () => {
    if (resendTimer > 0) return;

    try {
      const result = await resendOtp(sessionKey);
      if (result.success) {
        setResendTimer(60);
        setError(null);
      } else {
        setError(result.message || 'Failed to resend code.');
      }
    } catch (e) {
      setError('Failed to resend code.');
    }
  }, [sessionKey, resendTimer]);

  const handleVoiceCall = useCallback(async () => {
    try {
      const result = await requestVoiceCall(sessionKey);
      if (result.success) {
        setResendTimer(60);
        setError(null);
      } else {
        setError(result.message || 'Failed to initiate call.');
      }
    } catch (e) {
      setError('Failed to initiate call.');
    }
  }, [sessionKey]);

  // ---------------------------------------------------------------------------
  // Step 3: Reset password
  // ---------------------------------------------------------------------------

  const handleResetPassword = useCallback(async () => {
    setError(null);

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await resetPassword(resetToken, resetLogin, newPassword);

      if (result.success) {
        setSuccessMessage(result.message || 'Password updated successfully!');
        // Navigate back to login after a short delay
        setTimeout(() => {
          router.replace('/login');
        }, 1500);
      } else {
        setError(result.message || 'Failed to reset password. Please try again.');
      }
    } catch (e) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [newPassword, confirmPassword, resetToken, resetLogin, router]);

  // ---------------------------------------------------------------------------
  // Step indicator
  // ---------------------------------------------------------------------------

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            {
              backgroundColor: i <= step ? themeColors.primary : themeColors.border,
            },
            i === step && styles.stepDotActive,
          ]}
        />
      ))}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>
          Forgot Password?
        </Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          Enter your email or username and we'll help you reset your password.
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>Email or Username</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: themeColors.background,
              borderColor: themeColors.border,
              color: themeColors.text,
            },
          ]}
          value={login}
          onChangeText={setLogin}
          placeholder="Enter your email or username"
          placeholderTextColor={themeColors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="username"
          editable={!submitting}
          onSubmitEditing={handleForgot}
        />
      </View>

      <AnimatedPressable
        style={[styles.primaryButton, { backgroundColor: themeColors.primary }, submitting && styles.buttonDisabled]}
        onPress={handleForgot}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={themeColors.textInverse} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: themeColors.textInverse }]}>Send Code</Text>
        )}
      </AnimatedPressable>

      <Pressable style={styles.linkButton} onPress={() => router.back()}>
        <Text style={[styles.linkText, { color: themeColors.primary }]}>Back to Login</Text>
      </Pressable>
    </>
  );

  const renderStep2 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>
          Verify Your Phone
        </Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          Enter the code sent to {phoneMasked}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            styles.otpInput,
            {
              backgroundColor: themeColors.background,
              borderColor: themeColors.border,
              color: themeColors.text,
            },
          ]}
          value={otpCode}
          onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, ''))}
          placeholder="0000"
          placeholderTextColor={themeColors.textTertiary}
          keyboardType="number-pad"
          maxLength={8}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
        />
      </View>

      <AnimatedPressable
        style={[styles.primaryButton, { backgroundColor: themeColors.primary }, submitting && styles.buttonDisabled]}
        onPress={handleVerifyOtp}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={themeColors.textInverse} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: themeColors.textInverse }]}>Verify</Text>
        )}
      </AnimatedPressable>

      <View style={styles.otpActions}>
        <Pressable
          onPress={handleResendOtp}
          disabled={resendTimer > 0}
          style={styles.otpAction}
        >
          <Text style={[
            styles.linkText,
            { color: resendTimer > 0 ? themeColors.textTertiary : themeColors.primary },
          ]}>
            {resendTimer > 0 ? `Resend code (${resendTimer}s)` : 'Resend code'}
          </Text>
        </Pressable>
        {voiceFallback && (
          <Pressable onPress={handleVoiceCall} style={styles.otpAction}>
            <Text style={[styles.linkText, { color: themeColors.primary }]}>
              Try voice call
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={styles.linkButton}
        onPress={() => { setError(null); setOtpCode(''); setStep(1); }}
      >
        <Text style={[styles.linkText, { color: themeColors.primary }]}>Go Back</Text>
      </Pressable>
    </>
  );

  const renderStep3 = () => (
    <>
      <View style={styles.stepHeader}>
        <Text style={[styles.stepTitle, { color: themeColors.text }]}>
          Set New Password
        </Text>
        <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>
          Choose a strong password for your account.
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>New Password</Text>
        <View style={[
          styles.passwordContainer,
          {
            backgroundColor: themeColors.background,
            borderColor: themeColors.border,
          },
        ]}>
          <TextInput
            style={[styles.passwordInput, { color: themeColors.text }]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={themeColors.textTertiary}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            autoComplete="password-new"
            editable={!submitting}
          />
          <Pressable
            style={styles.showPasswordButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={themeColors.textSecondary} />
          </Pressable>
        </View>
        <PasswordStrengthMeter password={newPassword} />
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>Confirm Password</Text>
        <View style={[
          styles.passwordContainer,
          {
            backgroundColor: themeColors.background,
            borderColor: themeColors.border,
          },
        ]}>
          <TextInput
            style={[styles.passwordInput, { color: themeColors.text }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={themeColors.textTertiary}
            secureTextEntry={!showConfirmPassword}
            textContentType="newPassword"
            autoComplete="password-new"
            editable={!submitting}
            onSubmitEditing={handleResetPassword}
          />
          <Pressable
            style={styles.showPasswordButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={themeColors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <AnimatedPressable
        style={[styles.primaryButton, { backgroundColor: themeColors.primary }, submitting && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={themeColors.textInverse} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: themeColors.textInverse }]}>Reset Password</Text>
        )}
      </AnimatedPressable>
    </>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const stepTitles: Record<Step, string> = {
    1: 'Forgot Password',
    2: 'Verify Phone',
    3: 'New Password',
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          {step === 1 && (
            <View style={styles.header}>
              <Image
                source={getLogoSource(branding, isDark)}
                placeholder={require('@/assets/images/login_logo.png')}
                style={styles.logo}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={200}
              />
            </View>
          )}

          {/* Form Card */}
          <View style={[styles.formCard, { backgroundColor: withOpacity(themeColors.surface, 0.95) }]}>
            {renderStepIndicator()}

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

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
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

  // Step indicator
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },

  stepDot: {
    width: 8,
    height: 8,
    borderRadius: sizing.borderRadius.sm,
  },

  stepDotActive: {
    width: 24,
    borderRadius: sizing.borderRadius.sm,
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

  // Inputs
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

  otpInput: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    letterSpacing: 8,
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
  primaryButton: {
    borderRadius: sizing.borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },

  primaryButtonText: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  linkButton: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },

  linkText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  // OTP actions
  otpActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },

  otpAction: {
    paddingVertical: spacing.xs,
  },
});
