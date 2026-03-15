// =============================================================================
// REGISTRATION SCREEN - Multi-step registration wizard
// =============================================================================
// Step 1: Basic info (name, email, username, password)
// Step 2: Custom profile fields + terms
// Step 3: Email verification (if required)  → EmailVerifyStep
// Step 4: Phone OTP verification (if required) → PhoneOtpStep
// Step 5: Profile completion (bio + avatar)  → ProfileCompletionSteps
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
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
import { PRIVACY_POLICY_URL, getLogoSource } from '@/constants/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { Button } from '@/components/common/Button';
import { DynamicFormField } from '@/components/common/DynamicFormField';
import { PasswordStrengthMeter } from '@/components/common/PasswordStrengthMeter';
import { SelectModal } from '@/components/common/SelectModal';
import { ProfileCompletionSteps } from '@/components/profile/ProfileCompletionSteps';
import { EmailVerifyStep } from '@/components/register/EmailVerifyStep';
import { PhoneOtpStep } from '@/components/register/PhoneOtpStep';
import { useOtpVerification } from '@/hooks/useOtpVerification';
import {
  getRegistrationFields,
  submitRegistration,
  type RegistrationField,
  type FieldsResponse,
} from '@/services/api/registration';
import { hapticMedium } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4 | 5;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { registerAndLogin, user: currentUser } = useAuth();
  const { colors: themeColors, branding, isDark } = useTheme();

  // State
  const [step, setStep] = useState<Step>(1);
  const [fieldsConfig, setFieldsConfig] = useState<FieldsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form data (all steps)
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Email verification token (set when server requires email verify)
  const [verificationToken, setVerificationToken] = useState('');

  // Select modal state
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalField, setSelectModalField] = useState<string | null>(null);

  // OTP verification (step 4 — phone)
  // We use a ref for handleSubmitRegistration so the hook callback always
  // sees the latest version without needing to be in its dependency array.
  const submitRef = useRef<(otpSessionKey?: string) => Promise<void>>(undefined);

  const handleOtpVerified = useCallback(async (sessionKey: string) => {
    await submitRef.current?.(sessionKey);
  }, []);

  const otp = useOtpVerification({
    onVerified: handleOtpVerified,
  });

  // ---------------------------------------------------------------------------
  // Fetch fields on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      const result = await getRegistrationFields();
      if (result) {
        setFieldsConfig(result);
      } else {
        setError('Unable to load registration form. Please try again.');
      }
      setLoading(false);
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const setFieldValue = useCallback((key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear field-specific error on change
    setFieldErrors((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  const getFieldsForStep = useCallback((s: number): [string, RegistrationField][] => {
    if (!fieldsConfig?.fields) return [];
    return Object.entries(fieldsConfig.fields).filter(([, f]) => f.step === s);
  }, [fieldsConfig]);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const validateStep = useCallback((s: number): boolean => {
    const fields = getFieldsForStep(s);
    const errors: Record<string, string> = {};

    for (const [key, field] of fields) {
      const value = formData[key];

      if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        errors[key] = `${field.label || key} is required.`;
        continue;
      }

      if (key === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors[key] = 'Please enter a valid email address.';
        }
      }

      if (key === 'username' && value) {
        if (value.length < 4) {
          errors[key] = 'Username must be at least 4 characters.';
        } else if (!/^[a-z0-9_]+$/.test(value)) {
          errors[key] = 'Username can only contain lowercase letters, numbers, and underscores.';
        }
      }

      if (key === 'conf_password' && value) {
        if (value !== formData['password']) {
          errors[key] = 'Passwords do not match.';
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, getFieldsForStep]);

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  const handleNextStep = useCallback(() => {
    hapticMedium();
    setError(null);
    if (!validateStep(step)) return;
    setStep((prev) => (prev + 1) as Step);
  }, [step, validateStep]);

  const handleSubmitRegistration = useCallback(async (otpSessionKey?: string, emailCode?: string, emailToken?: string) => {
    hapticMedium();
    setError(null);

    // Validate form fields (skip if resubmitting after OTP/email verification)
    if (!otpSessionKey && !emailCode) {
      if (!validateStep(1)) return;
      if (!validateStep(2)) return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, any> = { ...formData };

      // Clean username
      if (payload.username) {
        payload.username = payload.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      }

      // Include email verification params if available
      if (emailCode && emailToken) {
        payload.__two_fa_code = emailCode;
        payload.__two_fa_signed_token = emailToken;
      }

      // Include OTP session key if verifying
      if (otpSessionKey) {
        payload.tbc_fp_session_key = otpSessionKey;
      }

      const result = await submitRegistration(payload);

      if (result.email_verification_required && result.verification_token) {
        // Email verification needed — go to step 3
        setVerificationToken(result.verification_token);
        setStep(3);
        return;
      }

      if (result.otp_required && result.session_key) {
        // Phone OTP needed — go to step 4
        otp.start({
          sessionKey: result.session_key,
          phoneMasked: result.phone_masked,
          voiceFallback: fieldsConfig?.voice_fallback,
        });
        setStep(4);
        return;
      }

      if (result.success && result.access_token && result.user) {
        // Auto-login with token pair
        await registerAndLogin(
          result.access_token,
          result.refresh_token || '',
          {
            id: result.user.id,
            username: result.user.username,
            displayName: result.user.display_name,
            email: result.user.email,
          },
        );

        // Skip profile completion if gate is disabled
        if (!fieldsConfig?.profile_completion?.enabled) {
          router.replace('/(tabs)');
          return;
        }

        // Go to profile completion step
        setStep(5);
        return;
      }

      // Handle errors
      if (result.errors) {
        setFieldErrors(result.errors);
        // Navigate back to the step with the error
        const errorKeys = Object.keys(result.errors);
        const step1Fields = getFieldsForStep(1).map(([k]) => k);
        const hasStep1Error = errorKeys.some((k) => step1Fields.includes(k));
        if (hasStep1Error) {
          setStep(1);
        } else {
          setStep(2);
        }
      }

      setError(result.message || 'Registration failed. Please try again.');
    } catch (e) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, validateStep, registerAndLogin, getFieldsForStep, otp, fieldsConfig]);

  // Keep ref in sync so OTP onVerified always calls latest version
  submitRef.current = handleSubmitRegistration;

  // ---------------------------------------------------------------------------
  // Email verification callbacks (passed to EmailVerifyStep)
  // ---------------------------------------------------------------------------

  const handleEmailVerify = useCallback(async (code: string, token: string) => {
    await handleSubmitRegistration(undefined, code, token);
  }, [handleSubmitRegistration]);

  const handleEmailResend = useCallback(async () => {
    setSubmitting(true);

    try {
      // Resubmit without email code to trigger a new email
      const payload: Record<string, any> = { ...formData };
      if (payload.username) {
        payload.username = payload.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      }

      const result = await submitRegistration(payload);

      if (result.email_verification_required && result.verification_token) {
        setVerificationToken(result.verification_token);
        return {};
      } else {
        return { error: 'Failed to resend code.' };
      }
    } catch (e) {
      return { error: 'Failed to resend code.' };
    } finally {
      setSubmitting(false);
    }
  }, [formData]);

  // ---------------------------------------------------------------------------
  // Dynamic field renderer
  // ---------------------------------------------------------------------------

  const renderField = useCallback((key: string, field: RegistrationField) => {
    return (
      <DynamicFormField
        key={key}
        fieldKey={key}
        field={field}
        value={formData[key] ?? ''}
        onChange={(val) => setFieldValue(key, val)}
        error={fieldErrors[key]}
        onSelectPress={(k) => {
          setSelectModalField(k);
          setSelectModalVisible(true);
        }}
        disabled={submitting}
        extraContent={key === 'password' ? <PasswordStrengthMeter password={formData[key] ?? ''} /> : undefined}
      />
    );
  }, [formData, fieldErrors, submitting, setFieldValue]);

  // Select modal field config
  const selectField = selectModalField ? fieldsConfig?.fields[selectModalField] : null;

  // ---------------------------------------------------------------------------
  // Step indicator
  // ---------------------------------------------------------------------------

  const hasCustomFields = getFieldsForStep(2).some(([key]) => key !== 'terms');
  const hasEmailVerify = fieldsConfig?.email_verification_required || false;
  const hasPhoneOtp = fieldsConfig?.otp_required || false;
  const totalSteps = (hasCustomFields ? 2 : 1) + (hasEmailVerify ? 1 : 0) + (hasPhoneOtp ? 1 : 0);

  // Map actual step number to visual position (accounting for skipped steps)
  const getVisualStep = useCallback((actualStep: number): number => {
    let visual = actualStep;
    if (!hasCustomFields && actualStep >= 2) visual--;
    if (!hasEmailVerify && actualStep >= 3) visual--;
    if (!hasPhoneOtp && actualStep >= 4) visual--;
    return visual;
  }, [hasCustomFields, hasEmailVerify, hasPhoneOtp]);

  const renderStepIndicator = () => {
    const visualStep = getVisualStep(step);
    return (
      <View style={styles.stepIndicator}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              {
                backgroundColor: i + 1 <= visualStep ? themeColors.primary : themeColors.border,
              },
              i + 1 === visualStep && styles.stepDotActive,
            ]}
          />
        ))}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <ImageBackground
        source={require('@/assets/images/login_background_img.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </ImageBackground>
    );
  }

  if (!fieldsConfig?.registration_enabled) {
    return (
      <ImageBackground
        source={require('@/assets/images/login_background_img.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <View style={styles.formCard}>
            <Text style={[styles.disabledTitle, { color: themeColors.text }]}>
              Registration Closed
            </Text>
            <Text style={[styles.disabledText, { color: themeColors.textSecondary }]}>
              {fieldsConfig?.message || 'Registration is currently closed. Please try again later.'}
            </Text>
            <Button
              title="Back to Login"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </ImageBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // Render steps 1 & 2 (inline — they're thin dynamic field lists)
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <>
      {getFieldsForStep(1).map(([key, field]) => renderField(key, field))}
      {/* When no custom fields, merge step 2 fields (terms) into step 1 */}
      {!hasCustomFields && getFieldsForStep(2).map(([key, field]) => renderField(key, field))}
      <Button
        title={hasCustomFields ? 'Next' : 'Create Account'}
        onPress={hasCustomFields ? handleNextStep : () => handleSubmitRegistration()}
        loading={submitting}
        style={styles.buttonMargin}
      />
      <Button
        title="Back to Login"
        variant="text"
        onPress={() => router.back()}
        style={styles.linkButton}
      />
      <Pressable
        style={styles.linkButton}
        onPress={() => router.push({ pathname: '/webview', params: { url: PRIVACY_POLICY_URL, title: 'Privacy Policy', noAuth: '1' } })}
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
      >
        <Text style={[styles.privacyText, { color: themeColors.textTertiary }]}>Privacy Policy</Text>
      </Pressable>
    </>
  );

  const renderStep2 = () => (
    <>
      {getFieldsForStep(2).map(([key, field]) => renderField(key, field))}
      <Button
        title="Create Account"
        onPress={() => handleSubmitRegistration()}
        loading={submitting}
        style={styles.buttonMargin}
      />
      <Button
        title="Back"
        variant="text"
        onPress={() => { setError(null); setStep(1); }}
        style={styles.linkButton}
      />
    </>
  );

  const stepTitles: Record<Step, string> = {
    1: 'Create Account',
    2: 'Your Profile',
    3: 'Verify Email',
    4: 'Verify Phone',
    5: '', // Handled by ProfileCompletionSteps
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
          {/* Logo (smaller than login) */}
          {step <= 2 && (
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
            {step < 5 && renderStepIndicator()}

            {step < 5 && stepTitles[step] ? (
              <Text style={[styles.formTitle, { color: themeColors.text }]}>
                {stepTitles[step]}
              </Text>
            ) : null}

            {/* Error Message (steps 1-2 only — verification steps manage their own errors) */}
            {error && step <= 2 && (
              <View style={[styles.errorContainer, { backgroundColor: themeColors.errorLight, borderColor: withOpacity(themeColors.error, 0.3) }]}>
                <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
              </View>
            )}

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && (
              <EmailVerifyStep
                email={formData.email || ''}
                verificationToken={verificationToken}
                submitting={submitting}
                onVerify={handleEmailVerify}
                onResend={handleEmailResend}
                onBack={() => { setError(null); setStep(hasCustomFields ? 2 : 1); }}
              />
            )}
            {step === 4 && (
              <PhoneOtpStep
                otp={otp}
                submitting={submitting}
                onBack={() => { setError(null); otp.setCode(''); setStep(hasEmailVerify ? 3 : hasCustomFields ? 2 : 1); }}
              />
            )}
            {step === 5 && (
              <ProfileCompletionSteps
                username={currentUser?.username || formData.username || ''}
                displayName={currentUser?.displayName || formData.full_name || ''}
                onComplete={() => router.replace('/(tabs)')}
                avatarRequired={fieldsConfig?.profile_completion?.require_avatar ?? true}
                bioRequired={fieldsConfig?.profile_completion?.require_bio ?? true}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom safe area - outside KAV so keyboard calc is correct */}
      <View style={{ height: insets.bottom }} />

      {selectField && (
        <SelectModal
          visible={selectModalVisible}
          title={`Select ${selectField.label}`}
          options={selectField.options || []}
          selectedValue={formData[selectModalField!]}
          onSelect={(val) => setFieldValue(selectModalField!, val)}
          onClose={() => setSelectModalVisible(false)}
        />
      )}
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

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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

  formTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.lg,
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

  // Errors
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

  // Buttons
  buttonMargin: {
    marginTop: spacing.md,
  },

  linkButton: {
    marginTop: spacing.sm,
  },

  privacyText: {
    fontSize: typography.size.xs,
  },

  // Registration disabled
  disabledTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  disabledText: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
