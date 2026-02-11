// =============================================================================
// REGISTRATION SCREEN - Multi-step registration wizard
// =============================================================================
// Step 1: Basic info (name, email, username, password)
// Step 2: Custom profile fields + terms
// Step 3: OTP verification (if required)
// Step 4: Avatar upload (post auto-login, optional)
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { spacing, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/common/Avatar';
import { uploadMedia } from '@/services/api/media';
import { updateStoredUser } from '@/services/auth';
import {
  getRegistrationFields,
  submitRegistration,
  verifyOtp,
  resendOtp,
  requestVoiceCall,
  updateAvatar,
  type RegistrationField,
  type FieldsResponse,
} from '@/services/api/registration';

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
  const { registerAndLogin, isAuthenticated } = useAuth();
  const { colors: themeColors, isDark } = useTheme();

  // State
  const [step, setStep] = useState<Step>(1);
  const [fieldsConfig, setFieldsConfig] = useState<FieldsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form data (all steps)
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfPassword, setShowConfPassword] = useState(false);

  // OTP state (step 3)
  const [otpCode, setOtpCode] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [phoneMasked, setPhoneMasked] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Email verification state (step 3, if enabled)
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');

  // Avatar state (step 5)
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Stored credentials for auto-login
  const credentialsRef = useRef<{ username: string; password: string } | null>(null);

  // Select modal state
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalField, setSelectModalField] = useState<string | null>(null);

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
  // OTP resend timer
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

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

      if (key === 'password' && value) {
        if (value.length < 6) {
          errors[key] = 'Password must be at least 6 characters.';
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
    setError(null);
    if (!validateStep(step)) return;
    setStep((prev) => (prev + 1) as Step);
  }, [step, validateStep]);

  const handleSubmitRegistration = useCallback(async (otpSessionKey?: string, emailCode?: string, emailToken?: string) => {
    setError(null);

    // Validate step 2 fields first (if coming from step 2 directly)
    if (!otpSessionKey && !emailCode && !validateStep(2)) return;

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
      } else if (verificationToken && emailVerifyCode) {
        // Use stored state if not passed as params
        payload.__two_fa_code = emailVerifyCode;
        payload.__two_fa_signed_token = verificationToken;
      }

      // Include OTP session key if verifying
      if (otpSessionKey) {
        payload.tbc_otp_session_key = otpSessionKey;
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
        setSessionKey(result.session_key);
        setPhoneMasked(result.phone_masked || '');
        setResendTimer(60);
        setStep(4);
        return;
      }

      if (result.success && result.token && result.user) {
        // Store credentials for silent refresh
        credentialsRef.current = {
          username: formData.username || '',
          password: formData.password || '',
        };

        // Auto-login
        await registerAndLogin(
          result.token,
          {
            id: result.user.id,
            username: result.user.username,
            displayName: result.user.display_name,
            email: result.user.email,
          },
          credentialsRef.current
        );

        // Go to avatar step
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
  }, [formData, validateStep, registerAndLogin, getFieldsForStep, verificationToken, emailVerifyCode]);

  const handleVerifyOtp = useCallback(async () => {
    setError(null);

    if (!otpCode.length) {
      setError('Please enter the verification code.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await verifyOtp(sessionKey, otpCode);

      if (result.success) {
        // OTP verified - resubmit registration with session key
        await handleSubmitRegistration(sessionKey);
      } else {
        setError(result.message || 'Invalid code. Please try again.');
      }
    } catch (e) {
      setError('Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [otpCode, sessionKey, handleSubmitRegistration]);

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
  // Email verification (Step 3)
  // ---------------------------------------------------------------------------

  const handleVerifyEmail = useCallback(async () => {
    setError(null);

    if (!emailVerifyCode.length) {
      setError('Please enter the verification code from your email.');
      return;
    }

    setSubmitting(true);

    try {
      // Resubmit registration with email verification code + token
      await handleSubmitRegistration(undefined, emailVerifyCode, verificationToken);
    } catch (e) {
      setError('Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [emailVerifyCode, verificationToken, handleSubmitRegistration]);

  const handleResendEmailCode = useCallback(async () => {
    if (resendTimer > 0) return;

    setError(null);
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
        setResendTimer(60);
        setEmailVerifyCode('');
      } else {
        setError('Failed to resend code.');
      }
    } catch (e) {
      setError('Failed to resend code.');
    } finally {
      setSubmitting(false);
    }
  }, [formData, resendTimer]);

  // ---------------------------------------------------------------------------
  // Avatar upload (Step 5)
  // ---------------------------------------------------------------------------

  const processAvatarAsset = useCallback(async (asset: ImagePicker.ImagePickerAsset) => {
    setAvatarUri(asset.uri);
    setUploadingAvatar(true);
    setError(null);

    try {
      const uploadResult = await uploadMedia(
        asset.uri,
        asset.mimeType || 'image/jpeg',
        asset.fileName || 'avatar.jpg',
        'profile'
      );

      if (!uploadResult.success || !uploadResult.data?.url) {
        setError('Failed to upload photo. You can add it later from your profile.');
        setUploadingAvatar(false);
        return;
      }

      const profileResult = await updateAvatar(uploadResult.data.url);

      if (profileResult.success) {
        await updateStoredUser({ avatar: profileResult.avatar || uploadResult.data.url });
      }

      setUploadingAvatar(false);
    } catch (e) {
      setError('Failed to upload photo. You can add it later from your profile.');
      setUploadingAvatar(false);
    }
  }, [formData.username]);

  const handlePickFromLibrary = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;
      await processAvatarAsset(result.assets[0]);
    } catch (e) {
      setError('Failed to upload photo. You can add it later from your profile.');
    }
  }, [processAvatarAsset]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow camera access to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;
      await processAvatarAsset(result.assets[0]);
    } catch (e) {
      setError('Failed to take photo. You can add it later from your profile.');
    }
  }, [processAvatarAsset]);

  const handlePickAvatar = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleTakePhoto();
          else if (buttonIndex === 2) handlePickFromLibrary();
        }
      );
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickFromLibrary },
      ]);
    }
  }, [handleTakePhoto, handlePickFromLibrary]);

  const handleFinish = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  // ---------------------------------------------------------------------------
  // Dynamic field renderer
  // ---------------------------------------------------------------------------

  const renderField = useCallback((key: string, field: RegistrationField) => {
    const value = formData[key] ?? '';
    const fieldError = fieldErrors[key];

    // Checkbox type
    if (field.type === 'inline_checkbox') {
      return (
        <View key={key} style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setFieldValue(key, !value)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.checkbox,
              { borderColor: fieldError ? '#EF4444' : themeColors.border },
              value && { backgroundColor: themeColors.primary, borderColor: themeColors.primary },
            ]}>
              {value && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>
              {field.inline_label || field.label}
              {field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
            </Text>
          </TouchableOpacity>
          {fieldError && <Text style={styles.fieldError}>{fieldError}</Text>}
        </View>
      );
    }

    // Select / Radio / Gender type
    if (field.type === 'select' || field.type === 'radio' || field.type === 'gender') {
      return (
        <View key={key} style={styles.inputContainer}>
          <Text style={[styles.label, { color: themeColors.text }]}>
            {field.label}{field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              styles.selectInput,
              {
                backgroundColor: themeColors.background,
                borderColor: fieldError ? '#EF4444' : themeColors.border,
              },
            ]}
            onPress={() => {
              setSelectModalField(key);
              setSelectModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.selectText,
              { color: value ? themeColors.text : themeColors.textTertiary },
            ]}>
              {value || field.placeholder || `Select ${field.label}`}
            </Text>
            <Text style={{ color: themeColors.textSecondary }}>▼</Text>
          </TouchableOpacity>
          {fieldError && <Text style={styles.fieldError}>{fieldError}</Text>}
        </View>
      );
    }

    // Textarea
    if (field.type === 'textarea') {
      return (
        <View key={key} style={styles.inputContainer}>
          <Text style={[styles.label, { color: themeColors.text }]}>
            {field.label}{field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textareaInput,
              {
                backgroundColor: themeColors.background,
                borderColor: fieldError ? '#EF4444' : themeColors.border,
                color: themeColors.text,
              },
            ]}
            value={value}
            onChangeText={(text) => setFieldValue(key, text)}
            placeholder={field.placeholder || ''}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {fieldError && <Text style={styles.fieldError}>{fieldError}</Text>}
        </View>
      );
    }

    // Password type
    if (field.type === 'password') {
      const isConfirm = key === 'conf_password';
      const visible = isConfirm ? showConfPassword : showPassword;
      const toggleVisible = isConfirm
        ? () => setShowConfPassword(!showConfPassword)
        : () => setShowPassword(!showPassword);

      return (
        <View key={key} style={styles.inputContainer}>
          <Text style={[styles.label, { color: themeColors.text }]}>
            {field.label}{field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
          </Text>
          <View style={[
            styles.passwordContainer,
            {
              backgroundColor: themeColors.background,
              borderColor: fieldError ? '#EF4444' : themeColors.border,
            },
          ]}>
            <TextInput
              style={[styles.passwordInput, { color: themeColors.text }]}
              value={value}
              onChangeText={(text) => setFieldValue(key, text)}
              placeholder={field.placeholder || ''}
              placeholderTextColor={themeColors.textTertiary}
              secureTextEntry={!visible}
              textContentType={isConfirm ? 'newPassword' : 'newPassword'}
              autoComplete={isConfirm ? 'password-new' : 'password-new'}
            />
            <TouchableOpacity
              style={styles.showPasswordButton}
              onPress={toggleVisible}
            >
              <Text style={styles.showPasswordText}>{visible ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {fieldError && <Text style={styles.fieldError}>{fieldError}</Text>}
        </View>
      );
    }

    // Default: text, email, phone, date, number, url
    let keyboardType: TextInput['props']['keyboardType'] = 'default';
    let autoCapitalize: TextInput['props']['autoCapitalize'] = 'sentences';
    let autoComplete: TextInput['props']['autoComplete'] = 'off';
    let placeholder = field.placeholder || '';

    switch (field.type) {
      case 'email':
        keyboardType = 'email-address';
        autoCapitalize = 'none';
        autoComplete = 'email';
        break;
      case 'phone':
        keyboardType = 'phone-pad';
        autoCapitalize = 'none';
        break;
      case 'number':
        keyboardType = 'numeric';
        break;
      case 'date':
        placeholder = placeholder || 'YYYY-MM-DD';
        autoCapitalize = 'none';
        break;
      case 'url':
        keyboardType = 'url';
        autoCapitalize = 'none';
        break;
      case 'text':
      default:
        if (key === 'username') {
          autoCapitalize = 'none';
          autoComplete = 'username-new';
        }
        break;
    }

    return (
      <View key={key} style={styles.inputContainer}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {field.label}{field.required && <Text style={{ color: '#EF4444' }}> *</Text>}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: themeColors.background,
              borderColor: fieldError ? '#EF4444' : themeColors.border,
              color: themeColors.text,
            },
          ]}
          value={value}
          onChangeText={(text) => setFieldValue(key, text)}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textTertiary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          editable={!submitting}
        />
        {fieldError && <Text style={styles.fieldError}>{fieldError}</Text>}
      </View>
    );
  }, [formData, fieldErrors, themeColors, showPassword, showConfPassword, submitting, setFieldValue]);

  // ---------------------------------------------------------------------------
  // Select modal
  // ---------------------------------------------------------------------------

  const renderSelectModal = () => {
    if (!selectModalField || !fieldsConfig?.fields[selectModalField]) return null;

    const field = fieldsConfig.fields[selectModalField];
    const options = field.options || [];

    return (
      <Modal
        visible={selectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              Select {field.label}
            </Text>
            <ScrollView style={styles.modalScroll}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.modalOption,
                    { borderBottomColor: themeColors.border },
                    formData[selectModalField!] === option && {
                      backgroundColor: `${themeColors.primary}15`,
                    },
                  ]}
                  onPress={() => {
                    setFieldValue(selectModalField!, option);
                    setSelectModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: themeColors.text },
                    formData[selectModalField!] === option && {
                      color: themeColors.primary,
                      fontWeight: typography.weight.semibold,
                    },
                  ]}>
                    {option}
                  </Text>
                  {formData[selectModalField!] === option && (
                    <Text style={{ color: themeColors.primary }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCancel, { borderTopColor: themeColors.border }]}
              onPress={() => setSelectModalVisible(false)}
            >
              <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    );
  };

  // ---------------------------------------------------------------------------
  // Step indicator
  // ---------------------------------------------------------------------------

  const hasEmailVerify = fieldsConfig?.email_verification_required || false;
  const hasPhoneOtp = fieldsConfig?.otp_required || false;
  const totalSteps = 2 + (hasEmailVerify ? 1 : 0) + (hasPhoneOtp ? 1 : 0) + 1; // base 2 + optional email + optional OTP + avatar

  // Map actual step number to visual position (accounting for skipped steps)
  const getVisualStep = useCallback((actualStep: number): number => {
    let visual = actualStep;
    if (!hasEmailVerify && actualStep >= 3) visual--;
    if (!hasPhoneOtp && actualStep >= 4) visual--;
    return visual;
  }, [hasEmailVerify, hasPhoneOtp]);

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
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
              onPress={() => router.back()}
            >
              <Text style={styles.primaryButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <>
      {getFieldsForStep(1).map(([key, field]) => renderField(key, field))}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: themeColors.primary }, submitting && styles.buttonDisabled]}
        onPress={handleNextStep}
        disabled={submitting}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Next</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={() => router.back()}>
        <Text style={[styles.linkText, { color: themeColors.primary }]}>Back to Login</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      {getFieldsForStep(2).map(([key, field]) => renderField(key, field))}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: themeColors.primary }, submitting && styles.buttonDisabled]}
        onPress={() => handleSubmitRegistration()}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Create Account</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={() => { setError(null); setStep(1); }}>
        <Text style={[styles.linkText, { color: themeColors.primary }]}>Back</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep3_EmailVerify = () => (
    <>
      <View style={styles.otpHeader}>
        <Text style={[styles.otpTitle, { color: themeColors.text }]}>
          Verify Your Email
        </Text>
        <Text style={[styles.otpSubtitle, { color: themeColors.textSecondary }]}>
          Enter the 6-digit code sent to {formData.email || 'your email'}
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
          value={emailVerifyCode}
          onChangeText={(text) => setEmailVerifyCode(text.replace(/[^0-9]/g, ''))}
          placeholder="000000"
          placeholderTextColor={themeColors.textTertiary}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
      </View>
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: themeColors.primary }, submitting && styles.buttonDisabled]}
        onPress={handleVerifyEmail}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Verify Email</Text>
        )}
      </TouchableOpacity>
      <View style={styles.otpActions}>
        <TouchableOpacity
          onPress={handleResendEmailCode}
          disabled={resendTimer > 0}
          style={styles.otpAction}
        >
          <Text style={[
            styles.linkText,
            { color: resendTimer > 0 ? themeColors.textTertiary : themeColors.primary },
          ]}>
            {resendTimer > 0 ? `Resend code (${resendTimer}s)` : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.linkButton} onPress={() => { setError(null); setEmailVerifyCode(''); setStep(2); }}>
        <Text style={[styles.linkText, { color: themeColors.primary }]}>Go Back</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep4_PhoneOtp = () => (
    <>
      <View style={styles.otpHeader}>
        <Text style={[styles.otpTitle, { color: themeColors.text }]}>
          Verify Your Phone
        </Text>
        <Text style={[styles.otpSubtitle, { color: themeColors.textSecondary }]}>
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
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: themeColors.primary }, submitting && styles.buttonDisabled]}
        onPress={handleVerifyOtp}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Verify</Text>
        )}
      </TouchableOpacity>
      <View style={styles.otpActions}>
        <TouchableOpacity
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
        </TouchableOpacity>
        {fieldsConfig?.voice_fallback && (
          <TouchableOpacity onPress={handleVoiceCall} style={styles.otpAction}>
            <Text style={[styles.linkText, { color: themeColors.primary }]}>
              Try voice call
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.linkButton} onPress={() => { setError(null); setOtpCode(''); setStep(hasEmailVerify ? 3 : 2); }}>
        <Text style={[styles.linkText, { color: themeColors.primary }]}>Go Back</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep5_Avatar = () => (
    <>
      <View style={styles.avatarHeader}>
        <Text style={[styles.otpTitle, { color: themeColors.text }]}>
          Add a Profile Photo
        </Text>
        <Text style={[styles.otpSubtitle, { color: themeColors.textSecondary }]}>
          Help others recognize you
        </Text>
      </View>
      <View style={styles.avatarContainer}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
        ) : (
          <Avatar
            source={null}
            fallback={formData.full_name || formData.username || 'U'}
            size="xxl"
          />
        )}
        {uploadingAvatar && (
          <View style={styles.avatarOverlay}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
      </View>
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: themeColors.primary }, uploadingAvatar && styles.buttonDisabled]}
        onPress={handlePickAvatar}
        disabled={uploadingAvatar}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>
          {avatarUri ? 'Change Photo' : 'Add Photo'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: themeColors.border }]}
        onPress={handleFinish}
        disabled={uploadingAvatar}
        activeOpacity={0.8}
      >
        <Text style={[styles.secondaryButtonText, { color: themeColors.text }]}>
          {avatarUri ? 'Done' : 'Skip for now'}
        </Text>
      </TouchableOpacity>
    </>
  );

  const stepTitles: Record<Step, string> = {
    1: 'Create Account',
    2: 'Your Profile',
    3: 'Verify Email',
    4: 'Verify Phone',
    5: 'Profile Photo',
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo (smaller than login) */}
          {step <= 2 && (
            <View style={styles.header}>
              <Image
                source={require('@/assets/images/login_logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Form Card */}
          <View style={[styles.formCard, isDark && { backgroundColor: themeColors.surface }]}>
            {renderStepIndicator()}

            <Text style={[styles.formTitle, { color: themeColors.text }]}>
              {stepTitles[step]}
            </Text>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3_EmailVerify()}
            {step === 4 && renderStep4_PhoneOtp()}
            {step === 5 && renderStep5_Avatar()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {renderSelectModal()}
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
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
    borderRadius: 4,
  },

  stepDotActive: {
    width: 24,
    borderRadius: 4,
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
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  textareaInput: {
    height: 80,
    paddingTop: spacing.md,
  },

  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  selectText: {
    fontSize: typography.size.md,
    flex: 1,
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

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  checkboxLabel: {
    fontSize: typography.size.sm,
    flex: 1,
  },

  // Errors
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },

  errorText: {
    color: '#DC2626',
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  fieldError: {
    color: '#DC2626',
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },

  // Buttons
  primaryButton: {
    borderRadius: 12,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },

  primaryButtonText: {
    color: '#fff',
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },

  secondaryButton: {
    borderRadius: 12,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
  },

  secondaryButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
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

  // OTP (Step 3)
  otpHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  otpTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },

  otpSubtitle: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  otpInput: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 8,
  },

  otpActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },

  otpAction: {
    paddingVertical: spacing.xs,
  },

  // Avatar (Step 5)
  avatarHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },

  avatarPreview: {
    width: sizing.avatar.xxl,
    height: sizing.avatar.xxl,
    borderRadius: sizing.avatar.xxl / 2,
  },

  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: sizing.avatar.xxl / 2,
    justifyContent: 'center',
    alignItems: 'center',
    width: sizing.avatar.xxl,
    alignSelf: 'center',
    height: sizing.avatar.xxl,
  },

  // Select Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  modalContent: {
    borderRadius: 16,
    maxHeight: '60%',
    overflow: 'hidden',
  },

  modalTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    padding: spacing.lg,
    textAlign: 'center',
  },

  modalScroll: {
    maxHeight: 300,
  },

  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  modalOptionText: {
    fontSize: typography.size.md,
  },

  modalCancel: {
    padding: spacing.lg,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  modalCancelText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
});
