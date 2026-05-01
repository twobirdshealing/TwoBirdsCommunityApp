// =============================================================================
// EDIT PROFILE SCREEN - Edit native + custom profile fields
// =============================================================================
// Route: /profile/edit
// Fetches current profile, renders editable form, saves via single POST
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { hapticLight } from '@/utils/haptics';
import { spacing, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { profilesApi, patchProfileMedia } from '@/services/api/profiles';
import { showAvatarPicker, showCoverPicker } from '@/utils/avatarPicker';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { useAppQuery } from '@/hooks/useAppQuery';
import { Profile, NativeCustomField } from '@/types/user';
import { SocialLinksForm } from '@/components/common/SocialLinksForm';
import { ProfilePhotoPicker } from '@/components/common/ProfilePhotoPicker';
import { DynamicFormField } from '@/components/common/DynamicFormField';
import { SelectModal } from '@/components/common/SelectModal';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { useSocialProviders } from '@/hooks/useSocialProviders';
import { createLogger } from '@/utils/logger';

const log = createLogger('ProfileEdit');

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
  const { user: currentUser, updateUser } = useAuth();
  const { colors: themeColors } = useTheme();
  const providers = useSocialProviders();

  const username = currentUser?.username || '';

  // State
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

  // ---------------------------------------------------------------------------
  // Load Profile (TanStack Query — instant render from cache + revalidate)
  // ---------------------------------------------------------------------------

  const {
    data: profile,
    isLoading: loading,
    error: loadError,
    mutate: mutateProfile,
  } = useAppQuery<Profile>({
    cacheKey: `tbc_profile_edit_${username}`,
    enabled: !!username,
    fetcher: async () => {
      const response = await profilesApi.getProfile(username);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load profile');
      }
      if (!response.data.profile) {
        throw new Error('Failed to load profile');
      }
      return response.data.profile;
    },
  });

  // Surface load failure once, then bail out — same UX as before
  useEffect(() => {
    if (!loadError) return;
    log.error(loadError, 'Failed to load profile for edit');
    Alert.alert('Error', 'Failed to load profile.');
    router.back();
  }, [loadError, router]);

  // Populate form data once when profile first arrives. We deliberately do NOT
  // rebuild the form on later refetches — that would wipe the user's edits.
  const formInitializedRef = useRef(false);
  useEffect(() => {
    if (!profile || formInitializedRef.current) return;

    // Pre-populate custom fields from FC native custom_field_groups
    const customValues: Record<string, any> = {};
    if (profile.custom_field_groups) {
      for (const group of profile.custom_field_groups) {
        for (const field of group.fields) {
          if (!field.is_enabled) continue;
          customValues[field.slug] = field.value || '';
        }
      }
    }

    // Build social links from profile data using dynamic provider keys
    const profileSocial = profile.social_links || profile.meta?.social_links || {};
    const sl: Record<string, string> = {};
    for (const provider of providers) {
      sl[provider.key] = profileSocial[provider.key] || '';
    }

    setFormData({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      email: profile.email || '',
      username: profile.username || '',
      short_description: profile.short_description || '',
      website: profile.website || profile.meta?.website || '',
      social_links: sl,
      custom_fields: customValues,
    });
    formInitializedRef.current = true;
  }, [profile, providers]);

  // ---------------------------------------------------------------------------
  // Field helpers
  // ---------------------------------------------------------------------------

  const setFieldValue = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => {
      if (!prev[key]) return prev;
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
        } catch {
          // Fall through — avatar was uploaded, just assignment failed
        }
        setAvatarUploading(false);
        setLocalAvatar(null);
        mutateProfile((prev) => (prev ? { ...prev, avatar: remoteUrl } : prev));
        await updateUser({ avatar: remoteUrl });
        cacheEvents.emit(CACHE_EVENTS.PROFILE);
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
        } catch {
          Alert.alert('Upload Failed', 'Failed to save cover photo.');
        }
        setCoverUploading(false);
        setLocalCover(null);
        mutateProfile((prev) => (prev ? { ...prev, cover_photo: remoteUrl } : prev));
        cacheEvents.emit(CACHE_EVENTS.PROFILE);
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

  const handleSave = async () => {
    if (saving || !username) return;

    const errors: Record<string, string> = {};
    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }

    if (profile?.custom_field_groups) {
      for (const group of profile.custom_field_groups) {
        for (const field of group.fields) {
          if (field.is_required && field.is_enabled && !formData.custom_fields[field.slug]) {
            errors[`cf_${field.slug}`] = `${field.label} is required`;
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
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
      payload.username = (formData.username || username).trim();

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

      const response = await profilesApi.updateProfile(username, payload);

      if (response.success) {
        const displayName = [formData.first_name.trim(), formData.last_name.trim()].filter(Boolean).join(' ');
        await updateUser({ displayName });
        cacheEvents.emit(CACHE_EVENTS.PROFILE);
        router.back();
      } else {
        const errorData = response.error as any;
        const message = errorData?.message || errorData?.data?.message;
        Alert.alert('Error', message || 'Failed to save profile.');
      }
    } catch (err) {
      log.error(err, 'Failed to save profile');
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Custom field renderer (FC native format)
  // ---------------------------------------------------------------------------

  // Flatten custom_field_groups into a slug→field map for rendering
  const nativeFieldsMap = useMemo(() => {
    const map: Record<string, NativeCustomField> = {};
    if (profile?.custom_field_groups) {
      for (const group of profile.custom_field_groups) {
        for (const field of group.fields) {
          if (field.is_enabled) {
            map[field.slug] = field;
          }
        }
      }
    }
    return map;
  }, [profile?.custom_field_groups]);

  const renderCustomField = (slug: string, field: NativeCustomField) => {
    // Adapt NativeCustomField to DynamicFormField's expected config shape
    const config = {
      label: field.label,
      type: field.type === 'radio' ? 'select' : field.type, // radio renders as select in mobile
      placeholder: field.placeholder || '',
      instructions: '',
      required: field.is_required,
      options: field.options,
    };

    return (
      <DynamicFormField
        key={slug}
        fieldKey={slug}
        field={config}
        value={formData.custom_fields[slug] ?? ''}
        onChange={(val) => setCustomField(slug, val)}
        error={fieldErrors[`cf_${slug}`]}
        onSelectPress={(k) => {
          setSelectModalField(k);
          setSelectModalVisible(true);
        }}
      />
    );
  };

  // Select modal field config (adapted from native field)
  const selectNativeField = selectModalField ? nativeFieldsMap[selectModalField] : null;
  const selectConfig = selectNativeField ? {
    label: selectNativeField.label,
    options: selectNativeField.options,
  } : null;

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PageHeader
          left={<HeaderIconButton icon="close" onPress={() => router.back()} />}
          center={<HeaderTitle>Edit Profile</HeaderTitle>}
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

  const hasCustomFields = Object.keys(nativeFieldsMap).length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <PageHeader
        left={<HeaderIconButton icon="close" onPress={() => router.back()} />}
        center={<HeaderTitle>Edit Profile</HeaderTitle>}
        right={
          <Button
            title="Save"
            size="sm"
            onPress={() => handleSave()}
            loading={saving}
          />
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
                onChangeText={(text) => setFieldValue('username', text.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="username"
                placeholderTextColor={themeColors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.fieldInstructions, { color: themeColors.textTertiary, marginTop: spacing.xs, marginBottom: 0 }]}>
                Lowercase letters, numbers, and underscores only
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
              {Object.entries(nativeFieldsMap).map(([slug, field]) =>
                renderCustomField(slug, field)
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
    borderRadius: sizing.borderRadius.sm,
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

  fieldError: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },

});
