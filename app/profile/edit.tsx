// =============================================================================
// EDIT PROFILE SCREEN - Edit native + custom profile fields
// =============================================================================
// Route: /profile/edit
// Fetches current profile, renders editable form, saves via single POST
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '@/utils/haptics';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { profilesApi, patchProfileMedia } from '@/services/api/profiles';
import { updateStoredUser } from '@/services/auth';
import { showAvatarPicker, showCoverPicker } from '@/utils/avatarPicker';
import { Profile, CustomFieldConfig } from '@/types/user';
import { SocialLinksForm } from '@/components/common/SocialLinksForm';
import { ProfilePhotoPicker } from '@/components/common/ProfilePhotoPicker';
import { DynamicFormField } from '@/components/common/DynamicFormField';
import { SelectModal } from '@/components/common/SelectModal';
import { PageHeader } from '@/components/navigation';
import { useSocialProviders } from '@/hooks/useSocialProviders';
import { useOtpVerification } from '@/hooks/useOtpVerification';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  short_description: string;
  website: string;
  social_links: Record<string, string>;
  custom_fields: Record<string, any>;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { colors: themeColors } = useTheme();
  const providers = useSocialProviders();

  const username = currentUser?.username || '';

  // State
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form data
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    short_description: '',
    website: '',
    social_links: {},
    custom_fields: {},
  });

  // Avatar/cover upload state
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [localCover, setLocalCover] = useState<string | null>(null);

  // Select modal state
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectModalField, setSelectModalField] = useState<string | null>(null);

  // OTP verification (phone change)
  const [showOtp, setShowOtp] = useState(false);

  // We need a ref pattern to avoid circular dependency between handleSave and otp.onVerified
  const handleSaveRef = React.useRef<(otpSessionKey?: string) => Promise<void>>(undefined);

  const otp = useOtpVerification({
    onVerified: async (sessionKey) => {
      await handleSaveRef.current?.(sessionKey);
    },
  });

  // ---------------------------------------------------------------------------
  // Load Profile
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!username) return;

    (async () => {
      try {
        setLoading(true);
        const response = await profilesApi.getProfile(username);

        if (response.success && response.data.profile) {
          const p = response.data.profile;
          setProfile(p);

          // Pre-populate form
          const customValues: Record<string, any> = {};
          if (p.custom_fields) {
            Object.entries(p.custom_fields).forEach(([key, field]) => {
              customValues[key] = field.value || '';
              if (field.visibility) {
                customValues[`${key}_visibility`] = field.visibility;
              }
            });
          }

          // Build social links from profile data using dynamic provider keys
          const profileSocial = p.social_links || p.meta?.social_links || {};
          const sl: Record<string, string> = {};
          for (const provider of providers) {
            sl[provider.key] = profileSocial[provider.key] || '';
          }

          setFormData({
            first_name: p.first_name || '',
            last_name: p.last_name || '',
            email: p.email || '',
            username: p.username || '',
            short_description: p.short_description || '',
            website: p.website || p.meta?.website || '',
            social_links: sl,
            custom_fields: customValues,
          });
        }
      } catch (err) {
        if (__DEV__) console.error('Failed to load profile for edit:', err);
        Alert.alert('Error', 'Failed to load profile.');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  // ---------------------------------------------------------------------------
  // Field helpers
  // ---------------------------------------------------------------------------

  const setFieldValue = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const setSocialLink = useCallback((provider: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      social_links: { ...prev.social_links, [provider]: value },
    }));
  }, []);

  const setCustomField = useCallback((key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: { ...prev.custom_fields, [key]: value },
    }));
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[`cf_${key}`];
      return next;
    });
  }, []);

  const setCustomFieldVisibility = useCallback((key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: { ...prev.custom_fields, [`${key}_visibility`]: value },
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Avatar handler
  // ---------------------------------------------------------------------------

  const handleAvatarPress = () => {
    if (!username) return;
    hapticLight();
    showAvatarPicker({
      onUploadStart: (localUri) => {
        setAvatarUploading(true);
        setLocalAvatar(localUri);
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { avatar: remoteUrl });
        } catch (e) {
          // Fall through — avatar was uploaded, just assignment failed
        }
        setAvatarUploading(false);
        setLocalAvatar(null);
        if (profile) {
          setProfile({ ...profile, avatar: remoteUrl });
        }
        await updateStoredUser({ avatar: remoteUrl });
      },
      onError: (message) => {
        setAvatarUploading(false);
        setLocalAvatar(null);
        Alert.alert('Upload Failed', message);
      },
    });
  };

  const handleCoverPhotoPress = () => {
    if (!username) return;
    hapticLight();
    showCoverPicker({
      onUploadStart: (localUri) => {
        setCoverUploading(true);
        setLocalCover(localUri);
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { cover_photo: remoteUrl });
        } catch (e) {
          Alert.alert('Upload Failed', 'Failed to save cover photo.');
        }
        setCoverUploading(false);
        setLocalCover(null);
        if (profile) {
          setProfile({ ...profile, cover_photo: remoteUrl });
        }
      },
      onError: (message) => {
        setCoverUploading(false);
        setLocalCover(null);
        Alert.alert('Upload Failed', message);
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async (otpSessionKeyOverride?: string) => {
    if (saving || !username) return;

    // Basic validation (skip if resubmitting after OTP)
    if (!otpSessionKeyOverride) {
      const errors: Record<string, string> = {};
      if (!formData.first_name.trim()) {
        errors.first_name = 'First name is required';
      }

      if (profile?.custom_field_configs) {
        Object.entries(profile.custom_field_configs).forEach(([key, config]) => {
          if (config.required && !formData.custom_fields[key]) {
            errors[`cf_${key}`] = `${config.label} is required`;
          }
        });
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }

    try {
      setSaving(true);

      const payload: Parameters<typeof profilesApi.updateProfile>[1] = {
        user_id: profile?.user_id,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        short_description: formData.short_description.trim(),
        website: formData.website.trim(),
        social_links: formData.social_links,
        custom_fields: formData.custom_fields,
      };

      if (profile?.can_change_email && formData.email.trim()) {
        payload.email = formData.email.trim();
      }
      if (profile?.can_change_username && formData.username.trim()) {
        payload.username = formData.username.trim();
      }

      // Preserve admin-managed fields (server resets these if omitted for moderators)
      if (profile?.is_verified !== undefined) {
        payload.is_verified = profile.is_verified;
      }
      if (profile?.badge_slugs) {
        payload.badge_slugs = profile.badge_slugs;
      }
      if (profile?.status) {
        payload.status = profile.status;
      }

      // Include verified OTP session key for resubmit
      if (otpSessionKeyOverride) {
        payload.tbc_otp_session_key = otpSessionKeyOverride;
      }

      const response = await profilesApi.updateProfile(username, payload);

      if (response.success) {
        const displayName = [formData.first_name.trim(), formData.last_name.trim()].filter(Boolean).join(' ');
        await updateStoredUser({ displayName });
        setShowOtp(false);
        router.back();
      } else {
        const errorData = response.error as any;
        // Check for OTP required response (phone change verification)
        const otpData = errorData?.data || errorData;
        if (otpData?.otp_required) {
          otp.start({
            sessionKey: otpData.session_key || '',
            phoneMasked: otpData.phone_masked,
            voiceFallback: otpData.voice_fallback,
          });
          setShowOtp(true);
        } else {
          const message = otpData?.message || errorData?.message;
          Alert.alert('Error', message || 'Failed to save profile.');
        }
      }
    } catch (err) {
      if (__DEV__) console.error('Failed to save profile:', err);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  // Keep ref in sync so OTP onVerified always calls latest handleSave
  handleSaveRef.current = handleSave;

  // ---------------------------------------------------------------------------
  // Visibility selector (shared across custom field types)
  // ---------------------------------------------------------------------------

  const visibilityOptions = [
    { key: 'public', label: 'Everyone' },
    { key: 'members', label: 'Members' },
    { key: 'friends', label: 'Friends' },
    { key: 'admins', label: 'Admins' },
  ] as const;

  const renderVisibilityRow = (key: string, config: CustomFieldConfig) => {
    if (!config.allow_user_override) return null;
    const currentVisibility = formData.custom_fields[`${key}_visibility`] || config.visibility || 'public';
    return (
      <View style={styles.visibilityRow}>
        <Ionicons name="eye-outline" size={14} color={themeColors.textTertiary} />
        {visibilityOptions.map((vis) => (
          <TouchableOpacity
            key={vis.key}
            style={[
              styles.visibilityChip,
              {
                backgroundColor: currentVisibility === vis.key ? themeColors.primary : themeColors.background,
                borderColor: currentVisibility === vis.key ? themeColors.primary : themeColors.border,
              },
            ]}
            onPress={() => setCustomFieldVisibility(key, vis.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.visibilityChipText, {
              color: currentVisibility === vis.key ? themeColors.textInverse : themeColors.textSecondary,
            }]}>
              {vis.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Custom field renderer
  // ---------------------------------------------------------------------------

  const renderCustomField = (key: string, config: CustomFieldConfig) => (
    <DynamicFormField
      key={key}
      fieldKey={key}
      field={config}
      value={formData.custom_fields[key] ?? ''}
      onChange={(val) => setCustomField(key, val)}
      error={fieldErrors[`cf_${key}`]}
      onSelectPress={(k) => {
        setSelectModalField(k);
        setSelectModalVisible(true);
      }}
      extraContent={renderVisibilityRow(key, config)}
    />
  );

  // Select modal field config
  const selectConfig = selectModalField ? profile?.custom_field_configs?.[selectModalField] : null;

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageHeader
          leftAction="close"
          onLeftPress={() => router.back()}
          title="Edit Profile"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Form
  // ---------------------------------------------------------------------------

  const customFieldConfigs = profile?.custom_field_configs || {};
  const hasCustomFields = Object.keys(customFieldConfigs).length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <PageHeader
        leftAction="close"
        onLeftPress={() => router.back()}
        title="Edit Profile"
        rightElement={
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: themeColors.primary }]}
            onPress={() => handleSave()}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={themeColors.textInverse} />
            ) : (
              <Text style={[styles.saveButtonText, { color: themeColors.textInverse }]}>Save</Text>
            )}
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* --- Profile Photos --- */}
          <ProfilePhotoPicker
            avatarSource={localAvatar || profile?.avatar}
            coverSource={localCover || profile?.cover_photo || profile?.meta?.cover_photo}
            fallbackName={profile?.display_name}
            onAvatarPress={handleAvatarPress}
            onCoverPress={handleCoverPhotoPress}
            avatarUploading={avatarUploading}
            coverUploading={coverUploading}
          />

          {/* --- Basic Info --- */}
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Basic Info</Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>
              First Name<Text style={[styles.required, { color: themeColors.error }]}> *</Text>
            </Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: themeColors.background,
                borderColor: fieldErrors.first_name ? themeColors.error : themeColors.border,
                color: themeColors.text,
              }]}
              value={formData.first_name}
              onChangeText={(text) => setFieldValue('first_name', text)}
              placeholder="First name"
              placeholderTextColor={themeColors.textTertiary}
              autoCapitalize="words"
            />
            {fieldErrors.first_name && <Text style={[styles.fieldError, { color: themeColors.error }]}>{fieldErrors.first_name}</Text>}
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Last Name</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: themeColors.background,
                borderColor: themeColors.border,
                color: themeColors.text,
              }]}
              value={formData.last_name}
              onChangeText={(text) => setFieldValue('last_name', text)}
              placeholder="Last name"
              placeholderTextColor={themeColors.textTertiary}
              autoCapitalize="words"
            />
          </View>

          {profile?.can_change_email && (
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: themeColors.text }]}>Email</Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.border,
                  color: themeColors.text,
                }]}
                value={formData.email}
                onChangeText={(text) => setFieldValue('email', text)}
                placeholder="your@email.com"
                placeholderTextColor={themeColors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {profile?.can_change_username && (
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: themeColors.text }]}>Username</Text>
              <TextInput
                style={[styles.input, {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.border,
                  color: themeColors.text,
                }]}
                value={formData.username}
                onChangeText={(text) => setFieldValue('username', text.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="username"
                placeholderTextColor={themeColors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.fieldInstructions, { color: themeColors.textTertiary, marginTop: spacing.xs, marginBottom: 0 }]}>
                Lowercase letters, numbers, hyphens, underscores only
              </Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textareaInput, {
                backgroundColor: themeColors.background,
                borderColor: themeColors.border,
                color: themeColors.text,
              }]}
              value={formData.short_description}
              onChangeText={(text) => setFieldValue('short_description', text)}
              placeholder="Tell people about yourself"
              placeholderTextColor={themeColors.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>Website</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: themeColors.background,
                borderColor: themeColors.border,
                color: themeColors.text,
              }]}
              value={formData.website}
              onChangeText={(text) => setFieldValue('website', text)}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* --- Social Links --- */}
          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: themeColors.text }]}>Social Links</Text>

          <SocialLinksForm
            providers={providers}
            values={formData.social_links}
            onChange={setSocialLink}
          />

          {/* --- Custom Fields --- */}
          {hasCustomFields && (
            <>
              <Text style={[styles.sectionTitle, styles.sectionTitleSpaced, { color: themeColors.text }]}>Additional Info</Text>
              {Object.entries(customFieldConfigs).map(([key, config]) =>
                renderCustomField(key, config)
              )}
            </>
          )}

          {/* Bottom spacer */}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom safe area - outside KAV so keyboard calc is correct */}
      <View style={{ height: insets.bottom }} />

      {/* Select modal for custom fields */}
      {selectConfig && (
        <SelectModal
          visible={selectModalVisible}
          title={`Select ${selectConfig.label}`}
          options={selectConfig.options || []}
          selectedValue={formData.custom_fields[selectModalField!]}
          onSelect={(val) => setCustomField(selectModalField!, val)}
          onClose={() => setSelectModalVisible(false)}
        />
      )}

      {/* OTP verification modal */}
      <Modal
        visible={showOtp}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtp(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: themeColors.overlay }]}
          onPress={() => setShowOtp(false)}
        >
          <Pressable style={[styles.otpModalContent, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              Verify Your Phone
            </Text>
            <Text style={[styles.otpSubtitle, { color: themeColors.textSecondary }]}>
              Enter the code sent to {otp.phoneMasked}
            </Text>

            {otp.error ? (
              <View style={[styles.otpErrorContainer, { backgroundColor: themeColors.errorLight, borderColor: withOpacity(themeColors.error, 0.3) }]}>
                <Text style={[styles.otpErrorText, { color: themeColors.error }]}>{otp.error}</Text>
              </View>
            ) : null}

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
              value={otp.code}
              onChangeText={(text) => otp.setCode(text.replace(/[^0-9]/g, ''))}
              placeholder="0000"
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="number-pad"
              maxLength={8}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.otpVerifyButton, { backgroundColor: themeColors.primary }, (otp.verifying || saving) && styles.otpButtonDisabled]}
              onPress={otp.handleVerify}
              disabled={otp.verifying || saving}
              activeOpacity={0.8}
            >
              {otp.verifying || saving ? (
                <ActivityIndicator color={themeColors.textInverse} />
              ) : (
                <Text style={[styles.otpVerifyButtonText, { color: themeColors.textInverse }]}>Verify</Text>
              )}
            </TouchableOpacity>

            <View style={styles.otpActions}>
              <TouchableOpacity
                onPress={otp.handleResend}
                disabled={otp.resendTimer > 0}
              >
                <Text style={[
                  styles.otpActionText,
                  { color: otp.resendTimer > 0 ? themeColors.textTertiary : themeColors.primary },
                ]}>
                  {otp.resendTimer > 0 ? `Resend code (${otp.resendTimer}s)` : 'Resend code'}
                </Text>
              </TouchableOpacity>
              {otp.voiceFallback && (
                <TouchableOpacity onPress={otp.handleVoiceCall}>
                  <Text style={[styles.otpActionText, { color: themeColors.primary }]}>
                    Try voice call
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.otpCancelButton}
              onPress={() => setShowOtp(false)}
            >
              <Text style={[styles.otpActionText, { color: themeColors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  flex: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    padding: spacing.lg,
  },

  // Save button in header
  saveButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },

  saveButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  // Section titles
  sectionTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.md,
  },

  sectionTitleSpaced: {
    marginTop: spacing.xl,
  },

  // Inputs
  inputContainer: {
    marginBottom: spacing.md,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginBottom: spacing.xs,
  },

  required: {
  },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
  },

  textareaInput: {
    minHeight: 90,
    paddingTop: spacing.sm + 2,
  },

  fieldInstructions: {
    fontSize: typography.size.xs,
    marginBottom: spacing.xs,
  },

  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },

  visibilityChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },

  visibilityChipText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },

  fieldError: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },

  // OTP + Select overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  modalTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    padding: spacing.lg,
    textAlign: 'center',
  },

  // OTP modal
  otpModalContent: {
    borderRadius: 16,
    width: '100%',
    padding: spacing.xl,
  },

  otpSubtitle: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  otpInput: {
    fontSize: 24,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    letterSpacing: 8,
    marginBottom: spacing.md,
  },

  otpVerifyButton: {
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: spacing.sm,
  },

  otpVerifyButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  otpButtonDisabled: {
    opacity: 0.7,
  },

  otpActions: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: spacing.xl,
    marginTop: spacing.lg,
  },

  otpActionText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  otpCancelButton: {
    alignItems: 'center' as const,
    marginTop: spacing.md,
  },

  otpErrorContainer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },

  otpErrorText: {
    fontSize: typography.size.xs,
    textAlign: 'center' as const,
  },
});
