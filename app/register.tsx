// =============================================================================
// REGISTRATION SCREEN - Multi-step registration wizard
// =============================================================================
// Step 1: Basic info (name, email, username, password)
// Step 2: Custom profile fields + terms
// Step 3: Email verification (if required)  → EmailVerifyStep (core)
// Step 4+: Module-provided steps from registry
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAppConfig } from '@/contexts/AppConfigContext';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { Button } from '@/components/common/Button';
import { DynamicFormField } from '@/components/common/DynamicFormField';
import { PasswordStrengthMeter } from '@/components/common/PasswordStrengthMeter';
import { SelectModal } from '@/components/common/SelectModal';
import { EmailVerifyStep } from '@/components/register/EmailVerifyStep';
import { getRegistrationSteps } from '@/modules/_registry';
import type { RegistrationStepRegistration } from '@/modules/_types';
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

// Steps 1-2: form fields, step 3: email verify (core), steps 4+: dynamic module steps
type Step = number;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { registerAndLogin } = useAuth();
  const { colors: themeColors, branding, isDark } = useTheme();

  const { registration: registrationConfig } = useAppConfig();

  // State
  const [step, setStep] = useState<Step>(1);
  const [fieldsConfig, setFieldsConfig] = useState<FieldsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoSource = getLogoSource(branding, isDark);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form data (all steps)
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Server response from last submit (used by module steps)
  const [submitResponse, setSubmitResponse] = useState<Record<string, any>>({});

  // Accumulated verification extras — carried forward across steps so each
  // resubmit includes all prior verification params (email code + module extras)
  const verificationExtrasRef = useRef<Record<string, any>>({});

  // Email verification token (set when server requires email verify)
  const [verificationToken, setVerificationToken] = useState('');

  // Select modal state
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalField, setSelectModalField] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Module registration steps from registry
  // -------------------------------------------------------------------------

  /** Active module steps, computed after server response */
  const activeModuleSteps = useMemo(() => {
    const allSteps = getRegistrationSteps();
    // Filter out core email-verify (handled directly) and inactive steps
    return allSteps.filter(
      (s) =>
        s.id !== 'email-verify' &&
        s.shouldActivate({ submitResponse, registrationConfig })
    );
  }, [submitResponse, registrationConfig]);

  /**
   * Step mapping:
   *   1 = form fields page 1
   *   2 = form fields page 2 (custom fields + terms)
   *   3 = email verification (core, if needed)
   *   4 .. 4+N-1 = pre-creation module steps
   */
  const MODULE_STEPS_START = 4;

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

  /**
   * Submit registration to server. Returns an error string if something went
   * wrong (so callers like email-verify can display it), or null on success.
   */
  const handleSubmitRegistration = useCallback(async (extras?: Record<string, any>, emailCode?: string, emailToken?: string): Promise<string | null> => {
    hapticMedium();
    setError(null);

    // Validate form fields (skip if resubmitting after verification step)
    if (!extras && !emailCode) {
      if (!validateStep(1)) return null;
      if (!validateStep(2)) return null;
    }

    setSubmitting(true);

    try {
      // Accumulate verification extras from this and prior steps
      if (extras) {
        verificationExtrasRef.current = { ...verificationExtrasRef.current, ...extras };
      }
      if (emailCode && emailToken) {
        verificationExtrasRef.current.__two_fa_code = emailCode;
        verificationExtrasRef.current.__two_fa_signed_token = emailToken;
      }

      const payload: Record<string, any> = {
        ...formData,
        ...verificationExtrasRef.current,
      };

      // Clean username
      if (payload.username) {
        payload.username = payload.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      }

      const result = await submitRegistration(payload);

      // Store response so module steps can check shouldActivate
      setSubmitResponse(result);

      if (result.email_verification_required && result.verification_token) {
        // Only go to email verify if we haven't already passed it.
        // If we're past email (step 4+), the token likely expired — show error instead.
        if (step < 3 || !verificationExtrasRef.current.__two_fa_code) {
          setVerificationToken(result.verification_token);
          setStep(3);
          return null;
        }
        // Email token expired mid-flow — restart
        verificationExtrasRef.current = {};
        setVerificationToken(result.verification_token);
        setStep(3);
        setError('Your verification session expired. Please verify your email again.');
        return 'Session expired';
      }

      // Check if any pre-creation module step should activate (before auto-login)
      // Module interception responses have success: false with module-specific flags
      if (!result.success) {
        const activePreSteps = getRegistrationSteps().filter(
          (s) => s.id !== 'email-verify' && s.phase === 'pre-creation' &&
                 s.shouldActivate({ submitResponse: result, registrationConfig })
        );

        if (activePreSteps.length > 0) {
          setStep(MODULE_STEPS_START);
          return null;
        }
      }

      // Registration complete — auto-login and go to app
      if (result.success && result.access_token && result.user) {
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

        verificationExtrasRef.current = {};
        router.replace('/(tabs)');
        return null;
      }

      // Handle errors
      const errorMsg = result.message || 'Registration failed. Please try again.';

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

      setError(errorMsg);
      return errorMsg;
    } catch (e) {
      const msg = 'An unexpected error occurred. Please try again.';
      setError(msg);
      return msg;
    } finally {
      setSubmitting(false);
    }
  }, [formData, validateStep, registerAndLogin, getFieldsForStep, registrationConfig]);

  /** Called by module steps to resubmit the form with extra verification data */
  const handleModuleResubmit = useCallback(async (extras: Record<string, any>) => {
    await handleSubmitRegistration(extras);
  }, [handleSubmitRegistration]);

  // ---------------------------------------------------------------------------
  // Email verification callbacks (passed to EmailVerifyStep)
  // ---------------------------------------------------------------------------

  const handleEmailVerify = useCallback(async (code: string, token: string): Promise<string | null> => {
    return await handleSubmitRegistration(undefined, code, token);
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

  // Total visible steps: form pages + email verify (if needed) + active module steps
  const totalSteps = (hasCustomFields ? 2 : 1)
    + (hasEmailVerify ? 1 : 0)
    + activeModuleSteps.length;

  // Map actual step number to visual position (accounting for skipped steps)
  const getVisualStep = useCallback((actualStep: number): number => {
    let visual = actualStep;
    if (!hasCustomFields && actualStep >= 2) visual--;
    if (!hasEmailVerify && actualStep >= 3) visual--;
    return visual;
  }, [hasCustomFields, hasEmailVerify]);

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

  /** Get title for current step */
  const getStepTitle = (s: number): string => {
    if (s === 1) return 'Create Account';
    if (s === 2) return 'Your Profile';
    if (s === 3) return 'Verify Email';
    if (s >= MODULE_STEPS_START) {
      return activeModuleSteps[s - MODULE_STEPS_START]?.title || '';
    }
    return '';
  };

  /** Get the module step registration for the current step, if any */
  const getCurrentModuleStep = (): RegistrationStepRegistration | null => {
    if (step >= MODULE_STEPS_START) {
      return activeModuleSteps[step - MODULE_STEPS_START] || null;
    }
    return null;
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
          )}

          {/* Form Card */}
          <View style={[styles.formCard, { backgroundColor: withOpacity(themeColors.surface, 0.95) }]}>
            {renderStepIndicator()}

            {getStepTitle(step) ? (
              <Text style={[styles.formTitle, { color: themeColors.text }]}>
                {getStepTitle(step)}
              </Text>
            ) : null}

            {/* Error Message — module steps (4+) manage their own error UI;
                parent errors show on form steps (1-2) and email verify (3) */}
            {error && step < MODULE_STEPS_START && (
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

            {/* Dynamic module steps — rendered from registry */}
            {(() => {
              const moduleStep = getCurrentModuleStep();
              if (!moduleStep) return null;
              const StepComponent = moduleStep.component;
              return (
                <StepComponent
                  formData={formData}
                  submitResponse={submitResponse}
                  submitting={submitting}
                  onResubmit={handleModuleResubmit}
                  onComplete={() => router.replace('/(tabs)')}
                  onBack={() => {
                    setError(null);
                    if (step === MODULE_STEPS_START) {
                      setStep(hasEmailVerify ? 3 : hasCustomFields ? 2 : 1);
                    } else {
                      setStep((step - 1) as Step);
                    }
                  }}
                />
              );
            })()}
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
