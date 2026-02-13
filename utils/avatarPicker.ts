// =============================================================================
// AVATAR PICKER - Shared utility for picking and uploading avatar photos
// =============================================================================
// Used by: registration flow (app/register.tsx) and profile screen
// Reuses: uploadMedia (services/api/media.ts), updateAvatar (services/api/registration.ts)
// =============================================================================

import * as ImagePicker from 'expo-image-picker';
import { Platform, ActionSheetIOS, Alert } from 'react-native';
import { uploadMedia } from '@/services/api/media';
import { updateAvatar } from '@/services/api/registration';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AvatarPickerCallbacks {
  onUploadStart?: (localUri: string) => void;
  onSuccess: (avatarUrl: string) => void;
  onError: (message: string) => void;
}

// -----------------------------------------------------------------------------
// Core: Process and upload an avatar asset
// -----------------------------------------------------------------------------

export async function processAndUploadAvatar(
  asset: ImagePicker.ImagePickerAsset,
  callbacks: AvatarPickerCallbacks
): Promise<void> {
  callbacks.onUploadStart?.(asset.uri);

  try {
    const uploadResult = await uploadMedia(
      asset.uri,
      asset.mimeType || 'image/jpeg',
      asset.fileName || 'avatar.jpg',
      'profile'
    );

    if (!uploadResult.success || !uploadResult.data?.url) {
      callbacks.onError('Failed to upload photo.');
      return;
    }

    const profileResult = await updateAvatar(uploadResult.data.url);

    if (profileResult.success) {
      callbacks.onSuccess(profileResult.avatar || uploadResult.data.url);
    } else {
      callbacks.onError(profileResult.message || 'Failed to update avatar.');
    }
  } catch (e) {
    callbacks.onError('Failed to upload photo.');
  }
}

// -----------------------------------------------------------------------------
// Pick from library
// -----------------------------------------------------------------------------

export async function pickAvatarFromLibrary(callbacks: AvatarPickerCallbacks): Promise<void> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    await processAndUploadAvatar(result.assets[0], callbacks);
  } catch (e) {
    callbacks.onError('Failed to pick photo.');
  }
}

// -----------------------------------------------------------------------------
// Take photo with camera
// -----------------------------------------------------------------------------

export async function takeAvatarPhoto(callbacks: AvatarPickerCallbacks): Promise<void> {
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
    await processAndUploadAvatar(result.assets[0], callbacks);
  } catch (e) {
    callbacks.onError('Failed to take photo.');
  }
}

// -----------------------------------------------------------------------------
// Show platform action sheet and pick
// -----------------------------------------------------------------------------

export function showAvatarPicker(callbacks: AvatarPickerCallbacks): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) takeAvatarPhoto(callbacks);
        else if (buttonIndex === 2) pickAvatarFromLibrary(callbacks);
      }
    );
  } else {
    Alert.alert('Change Photo', 'Choose an option', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: () => takeAvatarPhoto(callbacks) },
      { text: 'Choose from Library', onPress: () => pickAvatarFromLibrary(callbacks) },
    ]);
  }
}
