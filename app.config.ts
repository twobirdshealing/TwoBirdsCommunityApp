// =============================================================================
// APP CONFIG - Dynamic Expo configuration
// =============================================================================
// Supports environment-based URLs via EAS build profiles.
// When production domain is ready, change one line in eas.json.
// =============================================================================

import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // Read from EAS env or fall back to staging
  const siteUrl =
    process.env.SITE_URL || 'https://staging.twobirdschurch.com';

  return {
    ...config,
    name: 'Two Birds Community',
    slug: 'FluentCommunityApp',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/app_icon_ios.png',
    scheme: 'fluentcommunityapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      bundleIdentifier: 'com.twobirdschurch.community',
      supportsTablet: true,
      icon: './assets/images/app_icon_ios.png',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.community.twobirdschurch',
      adaptiveIcon: {
        backgroundColor: '#2196F3',
        foregroundImage: './assets/images/app_icon_android_adaptive_fg.png',
        backgroundImage: './assets/images/app_icon_android_adaptive_bg.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      googleServicesFile: './google-services.json',
    },
    web: {
      output: 'static' as const,
      favicon: './assets/images/app_icon_ios.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash_screen_img.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#1a1a1a',
            image: './assets/images/splash_screen_img.png',
          },
        },
      ],
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/images/app_icon_ios.png',
          color: '#6366F1',
        },
      ],
      'expo-font',
      [
        'expo-audio',
        {
          microphonePermission: false,
        },
      ],
      [
        'expo-image-picker',
        {
          cameraPermission:
            'Allow Two Birds Community to access your camera to take a profile photo.',
          photosPermission:
            'Allow Two Birds Community to access your photos to share images and set your profile picture.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission:
            'Allow Two Birds Community to save images to your photo library.',
          savePhotosPermission:
            'Allow Two Birds Community to save images to your photo library.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      siteUrl,
      router: {},
      eas: {
        projectId: '57d798c2-d48d-42f7-9e51-e88688f940bb',
      },
    },
  };
};
