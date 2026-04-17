// =============================================================================
// PROFILE COMPLETION - Single-page form
// =============================================================================
// Mirrors the Fluent Community web portal's completion popup: avatar + cover,
// bio, optional social links, and a single Complete Profile button. Used by
// both the registration step and the login gate.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/common/Button';
import { SocialLinksForm } from '@/components/common/SocialLinksForm';
import { ProfilePhotoPicker } from '@/components/common/ProfilePhotoPicker';
import { useSocialProviders } from '@/hooks/useSocialProviders';
import { updateProfile, patchProfileMedia } from '@/services/api/profiles';
import { completeRegistration, type ProfileExistingData } from '../services/profileCompletion';
import { showAvatarPicker, showCoverPicker } from '@/utils/avatarPicker';
import { hapticMedium } from '@/utils/haptics';

interface ProfileCompletionStepsProps {
  username: string;
  displayName: string;
  onComplete: () => void;
  existing?: ProfileExistingData;
  avatarRequired?: boolean;
  bioRequired?: boolean;
}

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

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [bio, setBio] = useState(existing?.bio || '');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(
    existing?.social_links && typeof existing.social_links === 'object'
      ? { ...existing.social_links }
      : {}
  );
  const [socialOpen, setSocialOpen] = useState(
    !!(existing?.social_links && Object.values(existing.social_links).some(v => v))
  );

  const [avatarUri, setAvatarUri] = useState<string | null>(existing?.avatar || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(existing?.cover_photo || null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const nameParts = useMemo(() => {
    let first = currentUser?.firstName || '';
    let last = currentUser?.lastName || '';
    if (!first && displayName) {
      const parts = displayName.trim().split(/\s+/);
      first = parts[0] || '';
      last = parts.slice(1).join(' ') || '';
    }
    return { first, last };
  }, [currentUser?.firstName, currentUser?.lastName, displayName]);

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

  const handleSubmit = useCallback(async () => {
    hapticMedium();

    const bioTrimmed = bio.trim();
    if (bioRequired && !bioTrimmed) {
      setError('Please write a short bio before continuing.');
      return;
    }
    if (avatarRequired && !avatarUri) {
      setError('Please add a profile photo before continuing.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const profileData: Record<string, any> = {
        username,
        user_id: currentUser?.id,
        first_name: nameParts.first,
        last_name: nameParts.last,
        short_description: bioTrimmed,
      };

      const trimmedLinks = Object.fromEntries(
        Object.entries(socialLinks).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])
      );
      if (Object.keys(trimmedLinks).length > 0) {
        profileData.social_links = trimmedLinks;
      }

      const response = await updateProfile(username, profileData);
      if (!response.success) {
        setError('Could not save profile. Please try again.');
        setSaving(false);
        return;
      }

      const marked = await completeRegistration();
      if (!marked) {
        setError('Please complete all required fields before continuing.');
        setSaving(false);
        return;
      }

      onComplete();
    } catch {
      setError('Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    bio,
    bioRequired,
    avatarRequired,
    avatarUri,
    socialLinks,
    username,
    nameParts,
    currentUser?.id,
    onComplete,
  ]);

  const canSubmit =
    !saving &&
    !uploadingAvatar &&
    !uploadingCover &&
    (!bioRequired || !!bio.trim()) &&
    (!avatarRequired || !!avatarUri);

  return (
    <>
      <Text style={[styles.greeting, { color: themeColors.text }]}>
        {nameParts.first ? `Welcome, ${nameParts.first}!` : 'Welcome!'}
      </Text>
      <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
        Complete your profile to join the community
      </Text>

      <ProfilePhotoPicker
        avatarSource={avatarUri}
        coverSource={coverUri}
        fallbackName={displayName || username || 'U'}
        onAvatarPress={handlePickAvatar}
        onCoverPress={handlePickCover}
        avatarUploading={uploadingAvatar}
        coverUploading={uploadingCover}
      />

      {error && (
        <View
          style={[
            styles.errorContainer,
            {
              backgroundColor: themeColors.errorLight,
              borderColor: withOpacity(themeColors.error, 0.3),
            },
          ]}
        >
          <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <Text style={[styles.fieldLabel, { color: themeColors.text }]}>
          About You{bioRequired && <Text style={{ color: themeColors.error }}> *</Text>}
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
          placeholder="Tell us a little about yourself..."
          placeholderTextColor={themeColors.textTertiary}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, { color: themeColors.textTertiary }]}>
          {bio.length}/500
        </Text>
      </View>

      <TouchableOpacity
        style={styles.socialToggle}
        onPress={() => setSocialOpen(o => !o)}
        activeOpacity={0.7}
      >
        <Feather
          name={socialOpen ? 'minus' : 'plus'}
          size={16}
          color={themeColors.primary}
        />
        <Text style={[styles.socialToggleText, { color: themeColors.primary }]}>
          {socialOpen ? 'Hide social links' : 'Add social links'}
        </Text>
      </TouchableOpacity>

      {socialOpen && (
        <View style={styles.socialContainer}>
          <SocialLinksForm
            providers={socialProviders}
            values={socialLinks}
            onChange={(key, value) =>
              setSocialLinks(prev => ({ ...prev, [key]: value }))
            }
          />
        </View>
      )}

      <Button
        title="Complete Profile"
        onPress={handleSubmit}
        loading={saving}
        disabled={!canSubmit}
        style={styles.buttonMargin}
      />
    </>
  );
}

const styles = StyleSheet.create({
  greeting: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputContainer: {
    marginBottom: spacing.md,
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
  charCount: {
    fontSize: typography.size.xs,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  socialToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  socialToggleText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  socialContainer: {
    marginBottom: spacing.md,
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
  buttonMargin: {
    marginTop: spacing.md,
  },
});
