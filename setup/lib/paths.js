'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Dashboard version (bumped when the update system changes)
// ---------------------------------------------------------------------------

const DASHBOARD_VERSION = 1;

// ---------------------------------------------------------------------------
// Resolve project root
// ---------------------------------------------------------------------------

const PROJECT_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../..');

const PORT = 3456;

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

const PATHS = {
  appJson: path.join(PROJECT_DIR, 'app.json'),
  easJson: path.join(PROJECT_DIR, 'eas.json'),
  configTs: path.join(PROJECT_DIR, 'constants', 'config.ts'),
  appConfigTs: path.join(PROJECT_DIR, 'app.config.ts'),
  packageJson: path.join(PROJECT_DIR, 'package.json'),
  packageLockJson: path.join(PROJECT_DIR, 'package-lock.json'),
  assetsDir: path.join(PROJECT_DIR, 'assets', 'images'),
  pluginsDir: path.join(PROJECT_DIR, 'companion plugins'),
  modulesDir: path.join(PROJECT_DIR, 'modules'),
  registryTs: path.join(PROJECT_DIR, 'modules', '_registry.ts'),
  tabsDir: path.join(PROJECT_DIR, 'app', '(tabs)'),
  appDir: path.join(PROJECT_DIR, 'app'),
  googleServicesJson: path.join(PROJECT_DIR, 'google-services.json'),
  googleServiceInfoPlist: path.join(PROJECT_DIR, 'GoogleService-Info.plist'),
  googlePlayKeyFile: path.join(PROJECT_DIR, 'google-play-service-account.json'),
  ascApiKeyFile: path.join(PROJECT_DIR, 'asc-api-key.p8'),
  manifest: path.join(PROJECT_DIR, 'manifest.json'),
  licenseFile: path.join(PROJECT_DIR, 'setup', '.license'),
  coreFilesManifest: path.join(PROJECT_DIR, 'setup', '.core-files.json'),
  corePackageJson: path.join(PROJECT_DIR, 'setup', '.core-package.json'),
  notesMd: path.join(PROJECT_DIR, 'NOTES.md'),
  tempDir: path.join(PROJECT_DIR, 'setup', '.temp'),
  logsDir: path.join(PROJECT_DIR, 'setup', 'logs'),
  submissionsLog: path.join(PROJECT_DIR, 'setup', 'logs', 'build-submissions.json'),
  buildPresetsFile: path.join(PROJECT_DIR, 'setup', 'logs', 'build-presets.json'),
};

// ---------------------------------------------------------------------------
// Required branding assets
// ---------------------------------------------------------------------------

const REQUIRED_ASSETS = [
  { file: 'app_icon_ios.png', label: 'iOS App Icon', size: '1024x1024', purpose: 'App Store & home screen icon',
    help: 'Exactly 1024×1024px PNG. <strong>No transparency</strong> — the App Store will reject icons with an alpha channel. No rounded corners — iOS applies the corner mask automatically. Fill the entire canvas with your icon.' },
  { file: 'app_icon_android_adaptive_fg.png', label: 'Android Adaptive Foreground', size: '1024x1024', purpose: 'Adaptive icon foreground layer',
    help: '1024×1024px PNG with <strong>transparent background</strong>. Keep your logo centered in the inner 66% safe zone — the outer area gets cropped into circles, squircles, or rounded squares depending on the device. This is the top layer only; the background layer sits behind it.',
    link: 'https://developer.android.com/develop/ui/views/launch/icon_design_adaptive',
    linkLabel: 'Android Adaptive Icons Guide' },
  { file: 'app_icon_android_adaptive_bg.png', label: 'Android Adaptive Background', size: '1024x1024', purpose: 'Adaptive icon background layer',
    help: '1024×1024px PNG. The layer behind your foreground icon — usually a solid color, gradient, or pattern. You can skip this image and use a solid color instead via the toggle below. This layer can shift slightly with parallax effects on some launchers.' },
  { file: 'app_icon_android_notification.png', label: 'Android Notification Icon', size: '96x96', purpose: 'Push notification small icon',
    help: '96×96px PNG with <strong>transparent background</strong>. Android uses only the alpha channel — any opaque pixels render as white, transparent areas stay clear. The image can contain colors, but they won\'t display; only the shape matters. The <em>Notification Accent Color</em> (set in Branding Colors below) tints the icon background. Keep the shape simple and recognizable at small sizes.' },
  { file: 'splash_screen_img.png', label: 'Splash Screen Image', size: '600x600', purpose: 'Shown during app load',
    help: '600×600px PNG recommended. Centered on the splash background color — displayed at 200px wide on screen (3× for sharp rendering on retina displays). Transparent background recommended so it works on both light and dark splash colors. Usually a logo mark without text. Shows for 1–2 seconds during app load.' },
  { file: 'login_logo.png', label: 'Login Logo', size: '750x540', purpose: 'Logo on login/register screens',
    help: '750×540px PNG recommended. In <strong>Dynamic</strong> mode the logo is fetched from your Fluent Community site automatically — no upload needed. Switch to <strong>Static</strong> mode to bundle a custom image instead. Transparent background recommended.' },
  { file: 'login_background_img.png', label: 'Login Background', size: '1284x2778', purpose: 'Background image on auth screens',
    help: '1284×2778px PNG recommended (iPhone Pro Max resolution). Full-screen background behind the login/register forms — scaled and cropped to fit different screen sizes. A dark or blurred image works best so the white text and form fields remain readable.' },
];

// ---------------------------------------------------------------------------
// Core companion plugins
// ---------------------------------------------------------------------------

const CORE_PLUGINS = [
  { folder: 'tbc-community-app', label: 'TBC Community App', required: true, description: 'Main bridge plugin — auth, registration, push notifications, config, branding, theme sync' },
];

// ---------------------------------------------------------------------------
// Placeholders — values that ship in the white-label snapshot for manual editors.
// The dashboard treats these as empty so fields show as "not yet configured".
// ---------------------------------------------------------------------------

const PLACEHOLDERS = [
  'My Community App', 'MyCommunityApp', 'mycommunityapp', 'My Community',
  'com.yourcompany.communityapp', 'CommunityApp/1.0', 'community-app',
  'your-expo-account', 'YOUR_EAS_PROJECT_ID',
  'https://community.yoursite.com', 'community.yoursite.com',
  'your-apple-id@example.com', 'YOUR_ASC_APP_ID',
];

function isPlaceholder(val) {
  if (!val) return true;
  return PLACEHOLDERS.some(p => val === p);
}

// ---------------------------------------------------------------------------
// EAS Build — allowlists for shell command arguments (prevents injection)
// ---------------------------------------------------------------------------

const VALID_PLATFORMS = ['ios', 'android'];
const VALID_PROFILES = ['development', 'preview', 'simulator', 'production'];
const BUILD_ID_PATTERN = /^[0-9a-f-]{36}$/i;

// ---------------------------------------------------------------------------
// OTA Updates
// ---------------------------------------------------------------------------

const OTA_GROUP_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const VALID_OTA_CHANNELS = ['development', 'preview', 'simulator', 'production'];
const VALID_OTA_PLATFORMS = ['ios', 'android', 'all'];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  DASHBOARD_VERSION,
  PROJECT_DIR,
  PORT,
  PATHS,
  REQUIRED_ASSETS,
  CORE_PLUGINS,
  PLACEHOLDERS,
  isPlaceholder,
  VALID_PLATFORMS,
  VALID_PROFILES,
  BUILD_ID_PATTERN,
  OTA_GROUP_ID_PATTERN,
  VALID_OTA_CHANNELS,
  VALID_OTA_PLATFORMS,
};
