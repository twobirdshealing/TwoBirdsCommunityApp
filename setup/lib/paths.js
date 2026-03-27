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
  assetsDir: path.join(PROJECT_DIR, 'assets', 'images'),
  pluginsDir: path.join(PROJECT_DIR, 'companion plugins'),
  modulesDir: path.join(PROJECT_DIR, 'modules'),
  registryTs: path.join(PROJECT_DIR, 'modules', '_registry.ts'),
  tabsDir: path.join(PROJECT_DIR, 'app', '(tabs)'),
  googleServicesJson: path.join(PROJECT_DIR, 'google-services.json'),
  googleServiceInfoPlist: path.join(PROJECT_DIR, 'GoogleService-Info.plist'),
  googlePlayKeyFile: path.join(PROJECT_DIR, 'google-play-service-account.json'),
  manifest: path.join(PROJECT_DIR, 'manifest.json'),
  licenseFile: path.join(PROJECT_DIR, 'setup', '.license'),
  backupsDir: path.join(PROJECT_DIR, 'setup', '.backups'),
  tempDir: path.join(PROJECT_DIR, 'setup', '.temp'),
  logsDir: path.join(PROJECT_DIR, 'setup', 'logs'),
  submissionsLog: path.join(PROJECT_DIR, 'setup', 'logs', 'build-submissions.json'),
};

// ---------------------------------------------------------------------------
// Required branding assets
// ---------------------------------------------------------------------------

const REQUIRED_ASSETS = [
  { file: 'app_icon_ios.png', label: 'iOS App Icon', size: '1024x1024', purpose: 'App Store & home screen icon',
    help: 'Must be exactly 1024x1024px PNG with no transparency and no rounded corners — Apple applies the mask automatically. Use a tool like Figma or icon generators to create this.' },
  { file: 'app_icon_android_adaptive_fg.png', label: 'Android Adaptive Foreground', size: '1024x1024', purpose: 'Adaptive icon foreground layer',
    help: 'The foreground layer of Android adaptive icons. Keep your logo centered in the inner 66% safe zone — the outer area may be cropped into circles, squircles, etc. by different Android launchers. Transparent background required. Tip: The Play Store also needs a standalone icon — you can upload one separately in the Play Console store listing.',
    link: 'https://developer.android.com/develop/ui/views/launch/icon_design_adaptive',
    linkLabel: 'Android Adaptive Icons Guide' },
  { file: 'app_icon_android_adaptive_bg.png', label: 'Android Adaptive Background', size: '1024x1024', purpose: 'Adaptive icon background layer',
    help: 'The background layer behind your foreground icon. Usually a solid color or simple gradient. This layer can shift slightly with parallax effects on some launchers.' },
  { file: 'app_icon_android_notification.png', label: 'Android Notification Icon', size: '96x96', purpose: 'Push notification small icon (white silhouette)',
    help: 'Must be a white silhouette on transparent background — Android tints this with your notification color. No color or detail — just a simple recognizable shape of your logo. 96x96px PNG.' },
  { file: 'splash_screen_img.png', label: 'Splash Screen Image', size: '200px wide', purpose: 'Shown during app load',
    help: 'The image shown on the splash screen while the app loads. Keep it around 200px wide — it is centered on screen. Usually your logo mark without text. PNG with transparent background works best.' },
  { file: 'login_logo.png', label: 'Login Logo', size: 'Any', purpose: 'Logo on login/register screens',
    help: 'Displayed on the login and registration screens. Can be any size — it scales to fit. Use your full logo with text. PNG with transparent background recommended.' },
  { file: 'login_background_img.png', label: 'Login Background', size: '1284x2778', purpose: 'Background image on auth screens',
    help: 'Full-screen background behind the login/register forms. Use 1284x2778px for best quality on modern phones. A dark or blurred image works well so text remains readable.' },
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
// Update System — Backup & Restore
// ---------------------------------------------------------------------------

/** Directories and patterns to exclude from backups */
const BACKUP_EXCLUDES = ['node_modules', '.expo', '.git', 'setup/.backups', 'setup/.temp', 'ios', 'android', 'web-build', 'dist'];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

const BACKUP_ID_PATTERN = /^v[\d.]+-\d+$/;

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
  BACKUP_EXCLUDES,
  BACKUP_ID_PATTERN,
};
