'use strict';

const fs = require('fs');
const { PATHS } = require('./paths');
const { readJsonSafe, findPluginConfig, ensurePath } = require('./file-utils');

// ---------------------------------------------------------------------------
// Config Writer
// ---------------------------------------------------------------------------

function writeConfigValues(changes) {
  const results = [];

  // --- app.json ---
  if (changes.appName !== undefined || changes.slug !== undefined || changes.scheme !== undefined ||
      changes.version !== undefined || changes.iosBundleId !== undefined || changes.androidPackage !== undefined ||
      changes.easOwner !== undefined || changes.easProjectId !== undefined ||
      changes.splashColorLight !== undefined || changes.splashColorDark !== undefined ||
      changes.notificationColor !== undefined || changes.adaptiveIconBgMode !== undefined) {
    const appJson = readJsonSafe(PATHS.appJson);
    if (appJson) {
      const expo = appJson.expo;
      if (changes.appName !== undefined) {
        expo.name = changes.appName;
        if (expo.plugins) {
          for (const plugin of expo.plugins) {
            if (Array.isArray(plugin) && plugin[0] === 'expo-image-picker' && plugin[1]) {
              plugin[1].cameraPermission = `Allow ${changes.appName} to access your camera to take a profile photo.`;
              plugin[1].photosPermission = `Allow ${changes.appName} to access your photos to share images and set your profile picture.`;
            }
            if (Array.isArray(plugin) && plugin[0] === 'expo-media-library' && plugin[1]) {
              plugin[1].photosPermission = `Allow ${changes.appName} to save images to your photo library.`;
              plugin[1].savePhotosPermission = `Allow ${changes.appName} to save images to your photo library.`;
            }
          }
        }
      }
      if (changes.slug !== undefined) expo.slug = changes.slug;
      if (changes.scheme !== undefined) expo.scheme = changes.scheme;
      if (changes.version !== undefined) {
        const v = changes.version;
        expo.version = v;
        if (!expo.ios) expo.ios = {};
        expo.ios.buildNumber = v;
        if (!expo.android) expo.android = {};
        const parts = v.split('.').map(Number);
        expo.android.versionCode = (parts[0] || 0) * 100 + (parts[1] || 0) * 10 + (parts[2] || 0);
      }
      if (changes.iosBundleId !== undefined) expo.ios.bundleIdentifier = changes.iosBundleId;
      if (changes.androidPackage !== undefined) expo.android.package = changes.androidPackage;
      if (changes.easOwner !== undefined) expo.owner = changes.easOwner;
      if (changes.easProjectId !== undefined) {
        if (!expo.extra) expo.extra = {};
        if (!expo.extra.eas) expo.extra.eas = {};
        expo.extra.eas.projectId = changes.easProjectId;
      }
      // Splash screen colors
      if (changes.splashColorLight !== undefined || changes.splashColorDark !== undefined) {
        const splashCfg = findPluginConfig(expo.plugins, 'expo-splash-screen');
        if (splashCfg) {
          if (changes.splashColorLight !== undefined) splashCfg.backgroundColor = changes.splashColorLight;
          if (changes.splashColorDark !== undefined) {
            if (!splashCfg.dark) splashCfg.dark = {};
            splashCfg.dark.backgroundColor = changes.splashColorDark;
          }
        }
      }
      // Adaptive icon background mode
      if (changes.adaptiveIconBgMode !== undefined) {
        if (!expo.android) expo.android = {};
        if (!expo.android.adaptiveIcon) expo.android.adaptiveIcon = {};
        if (changes.adaptiveIconBgMode === 'color') {
          delete expo.android.adaptiveIcon.backgroundImage;
          expo.android.adaptiveIcon.backgroundColor = changes.adaptiveIconBgColor || '#FFFFFF';
        } else {
          expo.android.adaptiveIcon.backgroundImage = './assets/images/app_icon_android_adaptive_bg.png';
          if (changes.adaptiveIconBgColor) expo.android.adaptiveIcon.backgroundColor = changes.adaptiveIconBgColor;
        }
      }
      // Notification accent color + fix icon path
      if (changes.notificationColor !== undefined) {
        const notifCfg = findPluginConfig(expo.plugins, 'expo-notifications');
        if (notifCfg) {
          notifCfg.color = changes.notificationColor;
          notifCfg.icon = './assets/images/app_icon_android_notification.png';
        }
      }
      fs.writeFileSync(PATHS.appJson, JSON.stringify(appJson, null, 2) + '\n');
      results.push('app.json updated');
    }
  }

  // --- eas.json ---
  if (changes.siteUrl !== undefined || changes.stagingUrl !== undefined || changes.appleId !== undefined || changes.ascAppId !== undefined ||
      changes.ascApiKeyId !== undefined || changes.ascApiKeyIssuerId !== undefined ||
      changes.googlePlayTrack !== undefined || changes.googlePlayServiceAccountKeyPath !== undefined) {
    const easJson = readJsonSafe(PATHS.easJson);
    if (easJson) {
      if (changes.siteUrl !== undefined) {
        const profiles = easJson.build || {};
        for (const key of Object.keys(profiles)) {
          // Skip development profile — it uses staging URL, not production
          if (key === 'development') continue;
          if (!profiles[key].env) profiles[key].env = {};
          profiles[key].env.EXPO_PUBLIC_SITE_URL = changes.siteUrl;
        }
      }
      if (changes.stagingUrl !== undefined) {
        // Update development profile with staging URL
        if (!easJson.build) easJson.build = {};
        if (!easJson.build.development) easJson.build.development = {};
        if (!easJson.build.development.env) easJson.build.development.env = {};
        easJson.build.development.env.EXPO_PUBLIC_SITE_URL = changes.stagingUrl;
      }
      if (changes.appleId !== undefined) {
        ensurePath(easJson, 'submit', 'production', 'ios').appleId = changes.appleId;
      }
      if (changes.ascAppId !== undefined) {
        ensurePath(easJson, 'submit', 'production', 'ios').ascAppId = changes.ascAppId;
      }
      if (changes.ascApiKeyId !== undefined) {
        ensurePath(easJson, 'submit', 'production', 'ios').ascApiKeyId = changes.ascApiKeyId;
      }
      if (changes.ascApiKeyIssuerId !== undefined) {
        ensurePath(easJson, 'submit', 'production', 'ios').ascApiKeyIssuerId = changes.ascApiKeyIssuerId;
      }
      if (changes.googlePlayTrack !== undefined || changes.googlePlayServiceAccountKeyPath !== undefined) {
        const android = ensurePath(easJson, 'submit', 'production', 'android');
        if (changes.googlePlayTrack !== undefined) android.track = changes.googlePlayTrack;
        if (changes.googlePlayServiceAccountKeyPath !== undefined) android.serviceAccountKeyPath = changes.googlePlayServiceAccountKeyPath;
      }
      fs.writeFileSync(PATHS.easJson, JSON.stringify(easJson, null, 2) + '\n');
      results.push('eas.json updated');
    }
  }

  // --- constants/config.ts ---
  if (changes.appNameConfig !== undefined || changes.userAgent !== undefined || changes.appToken !== undefined || changes.loginLogoMode !== undefined) {
    let content = fs.readFileSync(PATHS.configTs, 'utf8');
    if (changes.appNameConfig !== undefined) {
      content = content.replace(/export const APP_NAME = '[^']*'/, `export const APP_NAME = '${changes.appNameConfig}'`);
    }
    if (changes.userAgent !== undefined) {
      content = content.replace(/export const APP_USER_AGENT = '[^']*'/, `export const APP_USER_AGENT = '${changes.userAgent}'`);
    }
    if (changes.loginLogoMode !== undefined) {
      content = content.replace(/const LOGIN_LOGO_MODE = '[^']*'/, `const LOGIN_LOGO_MODE = '${changes.loginLogoMode}'`);
      // Swap the STATIC_LOGO line — Metro resolves require() statically, so we can't use a ternary
      if (changes.loginLogoMode === 'static') {
        content = content.replace(
          /const STATIC_LOGO: ImageSource \| null = .+/,
          "const STATIC_LOGO: ImageSource | null = require('@/assets/images/login_logo.png');"
        );
      } else {
        content = content.replace(
          /const STATIC_LOGO: ImageSource \| null = .+/,
          "const STATIC_LOGO: ImageSource | null = null; // static mode: require('@/assets/images/login_logo.png')"
        );
      }
    }
    fs.writeFileSync(PATHS.configTs, content);
    results.push('constants/config.ts updated');
  }

  // --- app.config.ts ---
  if (changes.productionUrl !== undefined || changes.stagingUrl !== undefined || changes.fallbackName !== undefined || changes.fallbackSlug !== undefined) {
    let content = fs.readFileSync(PATHS.appConfigTs, 'utf8');
    if (changes.productionUrl !== undefined) {
      content = content.replace(/const productionUrl = '[^']*'/, `const productionUrl = '${changes.productionUrl}'`);
    }
    if (changes.stagingUrl !== undefined) {
      content = content.replace(/const stagingUrl = '[^']*'/, `const stagingUrl = '${changes.stagingUrl}'`);
    }
    if (changes.fallbackName !== undefined) {
      content = content.replace(/config\.name \?\? '[^']*'/, `config.name ?? '${changes.fallbackName}'`);
    }
    if (changes.fallbackSlug !== undefined) {
      content = content.replace(/config\.slug \?\? '[^']*'/, `config.slug ?? '${changes.fallbackSlug}'`);
    }
    fs.writeFileSync(PATHS.appConfigTs, content);
    results.push('app.config.ts updated');
  }

  // --- package.json ---
  if (changes.packageName !== undefined || changes.version !== undefined || changes.stagingUrl !== undefined) {
    const pkgJson = readJsonSafe(PATHS.packageJson);
    if (pkgJson) {
      if (changes.packageName !== undefined) pkgJson.name = changes.packageName;
      if (changes.version !== undefined) pkgJson.version = changes.version;
      if (changes.stagingUrl !== undefined && pkgJson.scripts?.['dev:staging']) {
        pkgJson.scripts['dev:staging'] = pkgJson.scripts['dev:staging']
          .replace(/EXPO_PUBLIC_SITE_URL=[^\s]*/, `EXPO_PUBLIC_SITE_URL=${changes.stagingUrl}`);
      }
      fs.writeFileSync(PATHS.packageJson, JSON.stringify(pkgJson, null, 2) + '\n');
      results.push('package.json updated');

      // Sync version into package-lock.json so npm ci doesn't fail
      if (changes.version !== undefined) {
        const lock = readJsonSafe(PATHS.packageLockJson);
        if (lock) {
          lock.version = changes.version;
          if (lock.packages && lock.packages['']) lock.packages[''].version = changes.version;
          fs.writeFileSync(PATHS.packageLockJson, JSON.stringify(lock, null, 2) + '\n');
        }
      }
    }
  }

  return results;
}

module.exports = { writeConfigValues };
