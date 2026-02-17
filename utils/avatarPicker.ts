// =============================================================================
// IMAGE PICKER - Shared utility for picking and uploading profile images
// =============================================================================
// Used by: registration flow, edit profile, profile view
// Supports: avatar (1:1) and cover photo (16:9)
// Handles: pick from library / camera → upload to Fluent Community media
// Callers handle the assignment (PUT to profile endpoint)
// =============================================================================

import * as ImagePicker from 'expo-image-picker';
import { Platform, ActionSheetIOS, Alert } from 'react-native';
import { uploadMedia } from '@/services/api/media';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ImagePickerCallbacks {
  onUploadStart?: (localUri: string) => void;
  onSuccess: (remoteUrl: string) => void;
  onError: (message: string) => void;
}

/** @deprecated Use ImagePickerCallbacks instead */
export type AvatarPickerCallbacks = ImagePickerCallbacks;

export interface ImagePickerOptions {
  aspect?: [number, number];    // default [1, 1]
  quality?: number;              // default 0.8
  defaultFileName?: string;      // default 'photo.jpg'
  objectSource?: string;         // default 'profile'
}

// -----------------------------------------------------------------------------
// Core: Process and upload an image asset
// -----------------------------------------------------------------------------

async function processAndUpload(
  asset: ImagePicker.ImagePickerAsset,
  callbacks: ImagePickerCallbacks,
  options?: ImagePickerOptions
): Promise<void> {
  callbacks.onUploadStart?.(asset.uri);

  try {
    const uploadResult = await uploadMedia(
      asset.uri,
      asset.mimeType || 'image/jpeg',
      asset.fileName || options?.defaultFileName || 'photo.jpg',
      options?.objectSource || 'profile'
    );

    if (!uploadResult.success || !uploadResult.data?.url) {
      callbacks.onError('Failed to upload photo.');
      return;
    }

    callbacks.onSuccess(uploadResult.data.url);
  } catch (e) {
    callbacks.onError('Failed to upload photo.');
  }
}

// -----------------------------------------------------------------------------
// Pick from library
// -----------------------------------------------------------------------------

async function pickFromLibrary(
  callbacks: ImagePickerCallbacks,
  options?: ImagePickerOptions
): Promise<void> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: options?.aspect || [1, 1],
      quality: options?.quality ?? 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    await processAndUpload(result.assets[0], callbacks, options);
  } catch (e) {
    callbacks.onError('Failed to pick photo.');
  }
}

// -----------------------------------------------------------------------------
// Take photo with camera
// -----------------------------------------------------------------------------

async function takePhoto(
  callbacks: ImagePickerCallbacks,
  options?: ImagePickerOptions
): Promise<void> {
  try {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow camera access to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: options?.aspect || [1, 1],
      quality: options?.quality ?? 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;
    await processAndUpload(result.assets[0], callbacks, options);
  } catch (e) {
    callbacks.onError('Failed to take photo.');
  }
}

// -----------------------------------------------------------------------------
// Generic: Show platform action sheet and pick
// -----------------------------------------------------------------------------

export function showImagePicker(
  callbacks: ImagePickerCallbacks,
  options?: ImagePickerOptions
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) takePhoto(callbacks, options);
        else if (buttonIndex === 2) pickFromLibrary(callbacks, options);
      }
    );
  } else {
    Alert.alert('Change Photo', 'Choose an option', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take Photo', onPress: () => takePhoto(callbacks, options) },
      { text: 'Choose from Library', onPress: () => pickFromLibrary(callbacks, options) },
    ]);
  }
}

// -----------------------------------------------------------------------------
// Convenience wrappers
// -----------------------------------------------------------------------------

/** Pick and upload an avatar (1:1 square crop) */
export function showAvatarPicker(callbacks: ImagePickerCallbacks): void {
  showImagePicker(callbacks, { aspect: [1, 1], defaultFileName: 'avatar.jpg' });
}

/** Pick and upload a cover photo (16:9 landscape crop) */
export function showCoverPicker(callbacks: ImagePickerCallbacks): void {
  showImagePicker(callbacks, { aspect: [16, 9], defaultFileName: 'cover.jpg' });
}
