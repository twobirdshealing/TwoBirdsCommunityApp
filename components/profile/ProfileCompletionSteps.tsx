// =============================================================================
// PROFILE COMPLETION STEPS - Shared bio + avatar component
// =============================================================================
// Used by register.tsx (after account creation) and profile-complete.tsx (login gate).
// Two internal steps:
//   Step 1: Bio + website + social links (bio required)
//   Step 2: Avatar + cover photo (avatar required by default, cover optional)
// =============================================================================

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { SocialLinksForm } from '@/components/common/SocialLinksForm';
import { ProfilePhotoPicker } from '@/components/common/ProfilePhotoPicker';
import { useSocialProviders } from '@/hooks/useSocialProviders';
import { updateProfile, patchProfileMedia } from '@/services/api/profiles';
import { completeRegistration, type ProfileExistingData } from '@/services/api/registration';
import { showAvatarPicker, showCoverPicker } from '@/utils/avatarPicker';
import { hapticMedium } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ProfileCompletionStepsProps {
  username: string;
  displayName: string;
  onComplete: () => void;
  existing?: ProfileExistingData;
  /** Whether avatar upload is required before completing. Default true. */
  avatarRequired?: boolean;
  /** Whether bio is required before completing. Default true. */
  bioRequired?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ProfileCompletionSteps({
  username,
  displayName,
  onComplete,
  existing,
  avatarRequired = true,
  bioRequired = true,
}: ProfileCompletionStepsProps) {
  const { user: currentUser, updateUser } = useAuth();
  const { colors: themeColors } = useTheme();
  const socialProviders = useSocialProviders();

  // Internal step (1 = bio, 2 = avatar)
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state — pre-populated from existing profile data if available
  const [bio, setBio] = useState(existing?.bio || '');
  const [website, setWebsite] = useState(existing?.website || '');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(
    existing?.social_links && typeof existing.social_links === 'object'
      ? { ...existing.social_links }
      : {}
  );
  const [saving, setSaving] = useState(false);

  // Step 2 state — pre-populated from existing profile data if available
  const [avatarUri, setAvatarUri] = useState<string | null>(existing?.avatar || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(existing?.cover_photo || null);
  const [uploadingCover, setUploadingCover] = useState(false);

  // ---------------------------------------------------------------------------
  // Step 1: Save bio + social
  // ---------------------------------------------------------------------------

  const handleSaveBio = useCallback(async () => {
    hapticMedium();

    const bioTrimmed = bio.trim();
    if (bioRequired && !bioTrimmed) {
      setError('Please write a short bio before continuing.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let firstName = currentUser?.firstName || '';
      let lastName = currentUser?.lastName || '';
      if (!firstName && displayName) {
        const parts = displayName.trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }

      const profileData: Record<string, any> = {
        username,
        user_id: currentUser?.id,
        first_name: firstName,
        last_name: lastName,
        short_description: bioTrimmed,
      };

      const websiteTrimmed = website.trim();
      if (websiteTrimmed) {
        profileData.website = websiteTrimmed;
      }

      const trimmedLinks = Object.fromEntries(
        Object.entries(socialLinks).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])
      );
      if (Object.keys(trimmedLinks).length > 0) {
        profileData.social_links = trimmedLinks;
      }

      const response = await updateProfile(username, profileData);

      if (response.success) {
        setStep(2);
      } else {
        setError('Could not save profile. Please try again.');
      }
    } catch {
      setError('Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [bio, bioRequired, website, socialLinks, username, displayName, currentUser]);

  // ---------------------------------------------------------------------------
  // Step 2: Avatar + Cover
  // ---------------------------------------------------------------------------

  const handlePickAvatar = useCallback(() => {
    showAvatarPicker({
      onUploadStart: (localUri) => {
        setAvatarUri(localUri);
        setUploadingAvatar(true);
        setError(null);
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { avatar: remoteUrl });
          await updateUser({ avatar: remoteUrl });
        } catch {
          setError('Failed to save avatar. You can add it later from your profile.');
        }
        setUploadingAvatar(false);
      },
      onError: (msg) => {
        setError(msg + ' You can add it later from your profile.');
        setUploadingAvatar(false);
      },
    });
  }, [username, updateUser]);

  const handlePickCover = useCallback(() => {
    showCoverPicker({
      onUploadStart: (localUri) => {
        setCoverUri(localUri);
        setUploadingCover(true);
        setError(null);
      },
      onSuccess: async (remoteUrl) => {
        try {
          await patchProfileMedia(username, { cover_photo: remoteUrl });
          setCoverUri(remoteUrl);
        } catch {
          setError('Failed to save cover photo. You can add it later from your profile.');
        }
        setUploadingCover(false);
      },
      onError: (msg) => {
        setError(msg + ' You can add it later from your profile.');
        setUploadingCover(false);
      },
    });
  }, [username]);

  const handleFinish = useCallback(async () => {
    hapticMedium();

    if (avatarRequired && !avatarUri) {
      setError('Please add a profile photo before continuing.');
      return;
    }

    const success = await completeRegistration();
    if (!success) {
      setError('Please complete all required fields before continuing.');
      return;
    }

    onComplete();
  }, [onComplete, avatarRequired, avatarUri]);

  // ---------------------------------------------------------------------------
  // Step indicator
  // ---------------------------------------------------------------------------

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            { backgroundColor: i <= step ? themeColors.primary : themeColors.border },
            i === step && styles.stepDotActive,
          ]}
        />
      ))}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {renderStepIndicator()}

      <Text style={[styles.formTitle, { color: themeColors.text }]}>
        {step === 1 ? 'About You' : 'Personalize'}
      </Text>

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: themeColors.errorLight, borderColor: withOpacity(themeColors.error, 0.3) }]}>
          <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
        </View>
      )}

      {step === 1 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              Tell people a little about yourself
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>
              Bio{bioRequired && <Text style={{ color: themeColors.error }}> *</Text>}
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.bioInput,
                {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.border,
                  color: themeColors.text,
                },
              ]}
              value={bio}
              onChangeText={setBio}
              placeholder="A few words about yourself..."
              placeholderTextColor={themeColors.textTertiary}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Website</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.border,
                  color: themeColors.text,
                },
              ]}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://yourwebsite.com"
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <SocialLinksForm
            providers={socialProviders}
            values={socialLinks}
            onChange={(key, value) => setSocialLinks(prev => ({ ...prev, [key]: value }))}
          />

          <AnimatedPressable
            style={[styles.primaryButton, { backgroundColor: themeColors.primary }, saving && styles.buttonDisabled]}
            onPress={handleSaveBio}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save and continue"
          >
            {saving ? (
              <ActivityIndicator color={themeColors.textInverse} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: themeColors.textInverse }]}>Save & Continue</Text>
            )}
          </AnimatedPressable>
          {!bioRequired && !bio.trim() && (
            <AnimatedPressable
              style={[styles.skipButton]}
              onPress={() => setStep(2)}
              accessibilityRole="button"
              accessibilityLabel="Skip bio"
            >
              <Text style={[styles.skipButtonText, { color: themeColors.textSecondary }]}>Skip for now</Text>
            </AnimatedPressable>
          )}
        </>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
              {(avatarUri || coverUri) ? 'Update your profile photo and cover image' : 'Add a profile photo and cover image'}
            </Text>
          </View>

          <ProfilePhotoPicker
            avatarSource={avatarUri}
            coverSource={coverUri}
            fallbackName={displayName || username || 'U'}
            onAvatarPress={handlePickAvatar}
            onCoverPress={handlePickCover}
            avatarUploading={uploadingAvatar}
            coverUploading={uploadingCover}
          />

          <AnimatedPressable
            style={[
              avatarUri
                ? [styles.primaryButton, { backgroundColor: themeColors.primary }]
                : [styles.secondaryButton, { borderColor: themeColors.border }],
              (uploadingAvatar || uploadingCover) && styles.buttonDisabled,
            ]}
            onPress={handleFinish}
            disabled={uploadingAvatar || uploadingCover}
            accessibilityRole="button"
            accessibilityLabel={avatarUri ? 'Done' : (avatarRequired ? 'Add a profile photo' : 'Skip profile photos')}
          >
            <Text style={[
              avatarUri
                ? [styles.primaryButtonText, { color: themeColors.textInverse }]
                : [styles.secondaryButtonText, { color: themeColors.text }],
            ]}>
              {avatarUri ? 'Done' : (avatarRequired ? 'Add a profile photo' : 'Skip for now')}
            </Text>
          </AnimatedPressable>
        </>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
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

  formTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  sectionHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  subtitle: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  inputContainer: {
    marginBottom: spacing.lg,
  },

  fieldLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },

  input: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  bioInput: {
    minHeight: 100,
    paddingTop: spacing.md,
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

  secondaryButton: {
    borderRadius: sizing.borderRadius.md,
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

  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },

  skipButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});
