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
    slug: 'TwoBirdsCommunity',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/app_icon_ios.png',
    scheme: 'twobirdscommunity',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: 'com.twobirdschurch.community',
      supportsTablet: true,
      icon: './assets/images/app_icon_ios.png',
      googleServicesFile: './GoogleService-Info.plist',
      associatedDomains: [
        `applinks:${new URL(siteUrl).hostname}`,
      ],
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
      // @ts-expect-error 'adjustNothing' works at runtime but Expo types only allow 'resize' | 'pan'
      softwareKeyboardLayoutMode: 'adjustNothing',
      predictiveBackGestureEnabled: false,
      googleServicesFile: './google-services.json',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            // Portal is at root — list each known community path prefix
            { scheme: 'https', host: new URL(siteUrl).hostname, pathPrefix: '/spaces/' },
            { scheme: 'https', host: new URL(siteUrl).hostname, pathPrefix: '/u/' },
            { scheme: 'https', host: new URL(siteUrl).hostname, pathPrefix: '/courses/' },
            { scheme: 'https', host: new URL(siteUrl).hostname, pathPrefix: '/notifications' },
            { scheme: 'https', host: new URL(siteUrl).hostname, pathPrefix: '/leaderboard' },
            { scheme: 'https', host: new URL(siteUrl).hostname, pathPrefix: '/blog/' },
            { scheme: 'https', host: new URL(siteUrl).hostname, pathPrefix: '/chat/' },
            { scheme: 'https', host: new URL(siteUrl).hostname, pathPrefix: '/bookclub/' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
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
      'expo-asset',
      'expo-image',
      'expo-sharing',
      'expo-video',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      siteUrl,
      router: {},
      eas: {
        projectId: '65cb660f-a72f-4737-844b-39db0aef9dd4',
      },
    },
  };
};
