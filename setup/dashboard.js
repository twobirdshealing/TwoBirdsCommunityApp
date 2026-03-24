#!/usr/bin/env node
// =============================================================================
// SETUP DASHBOARD — Local web server for interactive app setup
// =============================================================================
// Zero external dependencies — uses only Node built-in modules.
//
// Usage: npm run dashboard
//        node setup/dashboard.js /path/to/project
//
// Opens a browser dashboard at http://localhost:3456 where you can:
//   - View and edit all config values (reads/writes actual files)
//   - See branding asset status with thumbnails
//   - Check Firebase configs and companion plugins
//   - Run live validation with connectivity tests
//   - View EAS builds, submit to App Store, download Android builds
// =============================================================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync, spawn } = require('child_process');

// ---------------------------------------------------------------------------
// Self-update: if a dashboard.next.js exists, swap it in and restart
// ---------------------------------------------------------------------------

const _nextDashboard = path.join(__dirname, 'dashboard.next.js');
if (fs.existsSync(_nextDashboard)) {
  try {
    fs.copyFileSync(_nextDashboard, __filename);
    fs.unlinkSync(_nextDashboard);
    console.log('Dashboard updated! Restarting...');
    spawn(process.argv[0], process.argv.slice(1), { stdio: 'inherit', detached: true }).unref();
    process.exit(0);
  } catch (err) {
    console.error('Self-update failed, continuing with current version:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Dashboard version (bumped when the update system changes)
// ---------------------------------------------------------------------------

const DASHBOARD_VERSION = 1;

// ---------------------------------------------------------------------------
// Resolve project root
// ---------------------------------------------------------------------------

const PROJECT_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..');

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
  { folder: 'tbc-multi-reactions', label: 'TBC Multi Reactions', required: false, description: 'Multi-reaction support — upload to WordPress if desired' },
  { folder: 'tbc-starter-theme', label: 'TBC Starter Theme', required: false, description: 'Custom WordPress theme — upload and activate' },
];

const ADDON_PLUGINS = [
  { folder: 'tbc-otp', label: 'TBC OTP', description: 'Phone OTP verification via Twilio (companion to otp module) — sold separately' },
  { folder: 'tbc-profile-completion', label: 'TBC Profile Completion', description: 'Profile completion gate — require bio/avatar after registration (companion to profile-completion module) — sold separately' },
  { folder: 'tbc-youtube', label: 'TBC YouTube', description: 'YouTube channel integration (companion to youtube module) — sold separately' },
  { folder: 'tbc-book-club', label: 'TBC Book Club', description: 'Book club with audiobook player (companion to bookclub module) — sold separately' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function fileSizeKB(p) {
  try { return Math.round(fs.statSync(p).size / 1024); } catch { return 0; }
}

function extractTsValue(content, pattern) {
  const m = content.match(pattern);
  return m ? m[1] : '';
}

function getSiteUrl(easJson) {
  if (!easJson) return '';
  const profiles = easJson.build || {};
  // Prefer production, then preview, then first non-development profile
  const preferred = profiles.production?.env?.EXPO_PUBLIC_SITE_URL || profiles.preview?.env?.EXPO_PUBLIC_SITE_URL;
  if (preferred) return preferred;
  for (const key of Object.keys(profiles)) {
    if (key === 'development') continue;
    if (profiles[key]?.env?.EXPO_PUBLIC_SITE_URL) return profiles[key].env.EXPO_PUBLIC_SITE_URL;
  }
  return '';
}

function getPluginVersion(pluginFolder) {
  const dir = path.join(PATHS.pluginsDir, pluginFolder);
  if (!fileExists(dir)) return null;
  // Resolve which PHP file to read: main file or first .php found
  let phpFile = path.join(dir, pluginFolder + '.php');
  if (!fileExists(phpFile)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.php'));
    if (files.length === 0) return 'unknown';
    phpFile = path.join(dir, files[0]);
  }
  const m = fs.readFileSync(phpFile, 'utf8').match(/Version:\s*(.+)/i);
  return m ? m[1].trim() : 'unknown';
}

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
// State Reader
// ---------------------------------------------------------------------------

function readProjectState() {
  const state = { config: {}, assets: [], firebase: {}, plugins: { core: [], addons: [] }, validation: { checks: [], pass: 0, fail: 0, warn: 0 } };

  // --- app.json ---
  const appJson = readJsonSafe(PATHS.appJson);
  if (appJson) {
    const expo = appJson.expo || {};
    state.config.appName = expo.name || '';
    state.config.slug = expo.slug || '';
    state.config.version = expo.version || '';
    state.config.scheme = expo.scheme || '';
    state.config.iosBundleId = expo.ios?.bundleIdentifier || '';
    state.config.androidPackage = expo.android?.package || '';
    state.config.easOwner = expo.owner || '';
    state.config.easProjectId = expo.extra?.eas?.projectId || '';
  }

  // --- eas.json ---
  const easJson = readJsonSafe(PATHS.easJson);
  if (easJson) {
    state.config.siteUrl = getSiteUrl(easJson);
    state.config.appleId = easJson.submit?.production?.ios?.appleId || '';
    state.config.ascAppId = easJson.submit?.production?.ios?.ascAppId || '';
    // Google Play submit config
    state.config.googlePlayTrack = easJson.submit?.production?.android?.track || 'production';
    state.config.googlePlayServiceAccountKeyPath = easJson.submit?.production?.android?.serviceAccountKeyPath || '';
  }

  // --- constants/config.ts ---
  if (fileExists(PATHS.configTs)) {
    const content = fs.readFileSync(PATHS.configTs, 'utf8');
    state.config.appNameConfig = extractTsValue(content, /export const APP_NAME = '([^']*)'/);
    state.config.userAgent = extractTsValue(content, /export const APP_USER_AGENT = '([^']*)'/);
  }

  // --- app.config.ts ---
  if (fileExists(PATHS.appConfigTs)) {
    const content = fs.readFileSync(PATHS.appConfigTs, 'utf8');
    state.config.productionUrl = extractTsValue(content, /const productionUrl = '([^']*)'/);
    state.config.stagingUrl = extractTsValue(content, /const stagingUrl = '([^']*)'/);
    state.config.fallbackName = extractTsValue(content, /config\.name \?\? '([^']*)'/);
    state.config.fallbackSlug = extractTsValue(content, /config\.slug \?\? '([^']*)'/);
  }

  // --- package.json ---
  const pkgJson = readJsonSafe(PATHS.packageJson);
  if (pkgJson) {
    state.config.packageName = pkgJson.name || '';
    state.config.packageVersion = pkgJson.version || '';
  }

  // --- manifest.json (core version for update system) ---
  const manifestData = readJsonSafe(PATHS.manifest);
  if (manifestData) {
    state.config.coreVersion = manifestData.version || '0.0.0';
  }

  // --- Google Play service account key ---
  state.config.googlePlayKeyExists = fileExists(PATHS.googlePlayKeyFile);

  // --- Assets ---
  for (const asset of REQUIRED_ASSETS) {
    const fullPath = path.join(PATHS.assetsDir, asset.file);
    const exists = fileExists(fullPath);
    state.assets.push({ ...asset, exists, sizeKB: exists ? fileSizeKB(fullPath) : 0 });
  }

  // --- Firebase ---
  state.firebase.android = { exists: fileExists(PATHS.googleServicesJson), file: 'google-services.json' };
  if (state.firebase.android.exists) {
    const gs = readJsonSafe(PATHS.googleServicesJson);
    if (gs) state.firebase.android.projectId = gs.project_info?.project_id || '';
  }
  state.firebase.ios = { exists: fileExists(PATHS.googleServiceInfoPlist), file: 'GoogleService-Info.plist' };

  // --- Plugins ---
  for (const plugin of CORE_PLUGINS) {
    const version = getPluginVersion(plugin.folder);
    state.plugins.core.push({ ...plugin, exists: version !== null, version: version || '' });
  }
  for (const plugin of ADDON_PLUGINS) {
    const version = getPluginVersion(plugin.folder);
    state.plugins.addons.push({ ...plugin, exists: version !== null, version: version || '' });
  }

  // --- Dependencies ---
  state.dependencies = {
    nodeModules: fileExists(path.join(PROJECT_DIR, 'node_modules')),
  };

  // --- Sanitize: replace placeholder values with '' so dashboard shows empty fields ---
  for (const key of Object.keys(state.config)) {
    if (typeof state.config[key] === 'string' && isPlaceholder(state.config[key])) {
      state.config[key] = '';
    }
  }

  // --- Validation (runs on raw values, but after sanitize placeholders read as empty = fail) ---
  runValidation(state);

  return state;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function runValidation(state) {
  const checks = [];
  const c = state.config;

  function check(pass, label, category, ref) {
    checks.push({ pass: pass ? 'pass' : 'fail', label, category, ref });
  }
  function checkWarn(warn, label, category, ref) {
    checks.push({ pass: warn ? 'warn' : 'pass', label, category, ref });
  }

  // app.json
  check(!isPlaceholder(c.appName), 'App name is set', 'app.json', 'app-identity');
  check(!isPlaceholder(c.slug), 'Slug is set', 'app.json', 'app-identity');
  check(!isPlaceholder(c.scheme), 'URL scheme is set', 'app.json', 'app-identity');
  check(!isPlaceholder(c.iosBundleId), 'iOS bundle ID is set', 'app.json', 'bundle-ids');
  check(!isPlaceholder(c.androidPackage), 'Android package is set', 'app.json', 'bundle-ids');
  check(!isPlaceholder(c.easProjectId), 'EAS project ID is set', 'app.json', 'eas-config');
  check(!isPlaceholder(c.easOwner), 'EAS owner is set', 'app.json', 'eas-config');

  // eas.json
  check(!isPlaceholder(c.siteUrl), 'EXPO_PUBLIC_SITE_URL is set', 'eas.json', 'site-url');
  checkWarn(isPlaceholder(c.appleId), 'Apple ID not set (needed for iOS submit)', 'eas.json', 'apple-submit');
  checkWarn(isPlaceholder(c.ascAppId), 'ASC App ID not set (needed for iOS submit)', 'eas.json', 'apple-submit');

  // config.ts
  check(!isPlaceholder(c.appNameConfig), 'APP_NAME is set in config.ts', 'config.ts', 'config-ts');
  check(!isPlaceholder(c.userAgent), 'APP_USER_AGENT is set', 'config.ts', 'config-ts');
  // app.config.ts
  check(!isPlaceholder(c.productionUrl), 'Production URL is set', 'app.config.ts', 'site-url');

  // Consistency
  if (c.appName && c.appNameConfig && c.appName !== c.appNameConfig) {
    checks.push({ pass: 'warn', label: `App name mismatch: app.json="${c.appName}" vs config.ts="${c.appNameConfig}"`, category: 'consistency', ref: 'config-ts' });
  }
  if (c.siteUrl && c.productionUrl && c.siteUrl !== c.productionUrl) {
    checks.push({ pass: 'warn', label: `EXPO_PUBLIC_SITE_URL mismatch: eas.json="${c.siteUrl}" vs app.config.ts="${c.productionUrl}"`, category: 'consistency', ref: 'site-url' });
  }
  if (c.version && c.packageVersion && c.version !== c.packageVersion) {
    checks.push({ pass: 'warn', label: `Version mismatch: app.json="${c.version}" vs package.json="${c.packageVersion}"`, category: 'consistency', ref: 'pre-launch' });
  }

  // Assets
  for (const asset of state.assets) {
    check(asset.exists, `${asset.label} exists`, 'assets', 'branding-assets');
  }

  // Firebase
  check(state.firebase.android.exists, 'google-services.json exists', 'firebase', 'firebase-setup');
  check(state.firebase.ios.exists, 'GoogleService-Info.plist exists', 'firebase', 'firebase-setup');

  // Dependencies
  check(state.dependencies.nodeModules, 'node_modules exists (npm install done)', 'dependencies', 'quick-start');

  // package.json
  check(!isPlaceholder(c.packageName), 'Package name is set', 'package.json', 'package-name');

  state.validation.checks = checks;
  state.validation.pass = checks.filter(c => c.pass === 'pass').length;
  state.validation.fail = checks.filter(c => c.pass === 'fail').length;
  state.validation.warn = checks.filter(c => c.pass === 'warn').length;
}

// ---------------------------------------------------------------------------
// Config Writer
// ---------------------------------------------------------------------------

function writeConfigValues(changes) {
  const results = [];

  // --- app.json ---
  if (changes.appName !== undefined || changes.slug !== undefined || changes.scheme !== undefined ||
      changes.version !== undefined || changes.iosBundleId !== undefined || changes.androidPackage !== undefined ||
      changes.easOwner !== undefined || changes.easProjectId !== undefined) {
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
      fs.writeFileSync(PATHS.appJson, JSON.stringify(appJson, null, 2) + '\n');
      results.push('app.json updated');
    }
  }

  // --- eas.json ---
  if (changes.siteUrl !== undefined || changes.stagingUrl !== undefined || changes.appleId !== undefined || changes.ascAppId !== undefined ||
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
      // Helper: ensure nested path exists in eas.json
      const ensurePath = (...keys) => {
        let obj = easJson;
        for (const k of keys) { if (!obj[k]) obj[k] = {}; obj = obj[k]; }
        return obj;
      };
      if (changes.appleId !== undefined) {
        ensurePath('submit', 'production', 'ios').appleId = changes.appleId;
      }
      if (changes.ascAppId !== undefined) {
        ensurePath('submit', 'production', 'ios').ascAppId = changes.ascAppId;
      }
      if (changes.googlePlayTrack !== undefined || changes.googlePlayServiceAccountKeyPath !== undefined) {
        const android = ensurePath('submit', 'production', 'android');
        if (changes.googlePlayTrack !== undefined) android.track = changes.googlePlayTrack;
        if (changes.googlePlayServiceAccountKeyPath !== undefined) android.serviceAccountKeyPath = changes.googlePlayServiceAccountKeyPath;
      }
      fs.writeFileSync(PATHS.easJson, JSON.stringify(easJson, null, 2) + '\n');
      results.push('eas.json updated');
    }
  }

  // --- constants/config.ts ---
  if (changes.appNameConfig !== undefined || changes.userAgent !== undefined || changes.appToken !== undefined) {
    let content = fs.readFileSync(PATHS.configTs, 'utf8');
    if (changes.appNameConfig !== undefined) {
      content = content.replace(/export const APP_NAME = '[^']*'/, `export const APP_NAME = '${changes.appNameConfig}'`);
    }
    if (changes.userAgent !== undefined) {
      content = content.replace(/export const APP_USER_AGENT = '[^']*'/, `export const APP_USER_AGENT = '${changes.userAgent}'`);
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
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Connectivity Checker
// ---------------------------------------------------------------------------

async function checkConnectivity(siteUrl) {
  if (!siteUrl) return { error: 'No EXPO_PUBLIC_SITE_URL configured' };
  const results = {};
  const endpoints = [
    { key: 'site', url: siteUrl, label: 'Site root' },
    { key: 'wpRest', url: `${siteUrl}/wp-json/`, label: 'WP REST API' },
    { key: 'fluentApi', url: `${siteUrl}/wp-json/fluent-community/v2`, label: 'Fluent Community API' },
    { key: 'tbcCa', url: `${siteUrl}/wp-json/tbc-ca/v1`, label: 'TBC Community App plugin' },
  ];
  const checks = await Promise.all(endpoints.map(async (ep) => {
    try {
      const status = await httpGet(ep.url, 5000);
      return [ep.key, { url: ep.url, label: ep.label, status, ok: status >= 200 && status < 400 }];
    } catch (err) {
      return [ep.key, { url: ep.url, label: ep.label, status: 0, ok: false, error: err.message }];
    }
  }));
  for (const [key, val] of checks) results[key] = val;
  return results;
}

function httpGet(url, timeout) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    const req = mod.get(url, { timeout }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ---------------------------------------------------------------------------
// EAS Build Integration
// ---------------------------------------------------------------------------

// Allowlists for shell command arguments (prevents injection)
const VALID_PLATFORMS = ['ios', 'android'];
const VALID_PROFILES = ['development', 'preview', 'simulator', 'production'];
const BUILD_ID_PATTERN = /^[0-9a-f-]{36}$/i;

/** Diagnose EAS CLI errors — checks if eas is installed and logged in */
async function diagnoseEasError(originalError) {
  try { await runCommand(['eas', '--version'], 5000); }
  catch { return { ok: false, error: 'EAS CLI not installed. Run: npm install -g eas-cli' }; }
  try { await runCommand(['eas', 'whoami'], 5000); }
  catch { return { ok: false, error: 'Not logged into EAS. Run: eas login' }; }
  return { ok: false, error: originalError.message };
}

/** Track npm install process state */
let installProcess = { status: 'idle', output: '', exitCode: null };

/** Run a command asynchronously (doesn't block the server) */
function runCommand(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(args.join(' '), [], {
      cwd: PROJECT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      shell: true,
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exit code ${code}`));
    });
    child.on('error', reject);
  });
}

/** Run eas build:list --json and return parsed builds */
async function getEasBuilds() {
  try {
    const output = await runCommand(['eas', 'build:list', '--json', '--limit', '50', '--non-interactive'], 30000);
    return { ok: true, builds: JSON.parse(output) };
  } catch (err) {
    return diagnoseEasError(err);
  }
}

/** Start an EAS build (non-blocking) */
async function startEasBuild(platform, profile) {
  if (!VALID_PLATFORMS.includes(platform)) return { ok: false, error: 'Invalid platform' };
  if (!VALID_PROFILES.includes(profile)) return { ok: false, error: 'Invalid profile' };
  try {
    const output = await runCommand(
      ['eas', 'build', '--platform', platform, '--profile', profile, '--non-interactive', '--json'],
      300000
    );
    return { ok: true, result: JSON.parse(output) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Submit a build to store (non-blocking) */
async function submitBuild(platform, buildId) {
  if (!VALID_PLATFORMS.includes(platform)) return { ok: false, error: 'Invalid platform' };
  if (!BUILD_ID_PATTERN.test(buildId)) return { ok: false, error: 'Invalid build ID format' };
  try {
    const output = await runCommand(
      ['eas', 'submit', '--platform', platform, '--id', buildId, '--non-interactive'],
      120000
    );
    return { ok: true, output };
  } catch (err) {
    // Extract last meaningful line from stderr for a cleaner error message
    const lines = (err.message || '').split('\n').map(l => l.trim()).filter(Boolean);
    const error = lines[lines.length - 1] || 'Unknown error';
    return { ok: false, error };
  }
}

/** Cancel an in-progress EAS build */
async function cancelBuild(buildId) {
  if (!BUILD_ID_PATTERN.test(buildId)) return { ok: false, error: 'Invalid build ID format' };
  try {
    await runCommand(['eas', 'build:cancel', buildId, '--non-interactive'], 30000);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Read build submission log from disk */
function getSubmissions() {
  return readJsonSafe(PATHS.submissionsLog) || {};
}

/** Save a build submission attempt to disk */
function saveSubmission(buildId, platform, ok, error) {
  fs.mkdirSync(PATHS.logsDir, { recursive: true });
  const subs = getSubmissions();
  subs[buildId] = { platform, date: new Date().toISOString(), ok, ...(error ? { error } : {}) };
  fs.writeFileSync(PATHS.submissionsLog, JSON.stringify(subs, null, 2));
}

// ---------------------------------------------------------------------------
// OTA Updates — check config, push updates, list history
// ---------------------------------------------------------------------------

const OTA_GROUP_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const VALID_OTA_CHANNELS = ['development', 'preview', 'simulator', 'production'];
const VALID_OTA_PLATFORMS = ['ios', 'android', 'all'];

/** Check if OTA updates are properly configured */
async function getOTAStatus() {
  const appJson = readJsonSafe(PATHS.appJson);
  const easJson = readJsonSafe(PATHS.easJson);
  const pkgJson = readJsonSafe(PATHS.packageJson);
  const expo = appJson?.expo || {};

  // Check channels in eas.json (local config)
  const channels = {};
  if (easJson?.build) {
    for (const [profile, config] of Object.entries(easJson.build)) {
      channels[profile] = config.channel || null;
    }
  }

  // Check if channels exist on EAS (created after first build)
  let liveChannels = [];
  try {
    const output = await runCommand(['eas', 'channel:list', '--json', '--non-interactive'], 15000);
    const parsed = JSON.parse(output);
    liveChannels = (parsed?.currentPage || []).map(c => c.name);
  } catch (_) {}

  return {
    channels,
    liveChannels,
    hasBuilt: liveChannels.length > 0,
    currentVersion: expo.version || '',
  };
}

/** Push an OTA update via eas update */
async function pushOTAUpdate(channel, message, platform) {
  if (!VALID_OTA_CHANNELS.includes(channel)) return { ok: false, error: 'Invalid channel' };
  if (!VALID_OTA_PLATFORMS.includes(platform)) return { ok: false, error: 'Invalid platform' };
  if (!message || typeof message !== 'string' || message.length > 500) return { ok: false, error: 'Message is required (max 500 chars)' };

  const args = ['eas', 'update', '--channel', channel, '--message', JSON.stringify(message), '--non-interactive'];
  if (platform !== 'all') {
    args.push('--platform', platform);
  }
  try {
    args.push('--json');
    const output = await runCommand(args, 300000);
    try {
      const parsed = JSON.parse(output);
      const items = Array.isArray(parsed) ? parsed : [];
      const first = items[0] || {};
      return {
        ok: true,
        runtimeVersion: first.runtimeVersion || null,
        platforms: items.map(i => i.platform).filter(Boolean),
        group: first.group || null,
        gitCommit: first.gitCommitHash || null,
      };
    } catch (_) {
      return { ok: true };
    }
  } catch (err) {
    return diagnoseEasError(err);
  }
}

/** List recent OTA updates */
async function listOTAUpdates() {
  try {
    const output = await runCommand(['eas', 'update:list', '--all', '--json', '--non-interactive'], 30000);
    return { ok: true, updates: JSON.parse(output) };
  } catch (err) {
    return diagnoseEasError(err);
  }
}

/** Delete an OTA update group */
async function deleteOTAUpdate(groupId) {
  if (!OTA_GROUP_ID_PATTERN.test(groupId)) return { ok: false, error: 'Invalid group ID' };
  try {
    await runCommand(['eas', 'update:delete', '--group', groupId, '--non-interactive'], 30000);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Module System — read, export, import, remove modules
// ---------------------------------------------------------------------------

/** Parse module.ts to extract id, name, version, companionPlugin, whether it has a tab */
function parseModuleManifest(moduleDir) {
  const moduleTs = path.join(moduleDir, 'module.ts');
  if (!fileExists(moduleTs)) return null;
  const content = fs.readFileSync(moduleTs, 'utf8');

  const id = extractTsValue(content, /id:\s*'([^']*)'/);
  const name = extractTsValue(content, /name:\s*'([^']*)'/);
  const version = extractTsValue(content, /version:\s*'([^']*)'/);
  const description = extractTsValue(content, /description:\s*'([^']*)'/);
  const author = extractTsValue(content, /author:\s*'([^']*)'/);
  const authorUrl = extractTsValue(content, /authorUrl:\s*'([^']*)'/);
  const license = extractTsValue(content, /license:\s*'([^']*)'/);
  const minAppVersion = extractTsValue(content, /minAppVersion:\s*'([^']*)'/);
  const companionPlugin = extractTsValue(content, /companionPlugin:\s*'([^']*)'/);
  const hasTab = /\btab:\s*\{/.test(content);
  const apiBase = extractTsValue(content, /apiBase:\s*'([^']*)'/);

  return { id, name, version, description, author, authorUrl, license, minAppVersion, companionPlugin, hasTab, apiBase };
}

/** Get all installed modules */
function getInstalledModules() {
  const modules = [];
  if (!fileExists(PATHS.modulesDir)) return modules;

  const dirs = fs.readdirSync(PATHS.modulesDir).filter(d => {
    if (d.startsWith('_')) return false; // skip _registry.ts, _types.ts, _shared
    const full = path.join(PATHS.modulesDir, d);
    return fs.statSync(full).isDirectory();
  });

  // Read registry to see which are active
  const registryContent = fileExists(PATHS.registryTs)
    ? fs.readFileSync(PATHS.registryTs, 'utf8') : '';

  for (const dir of dirs) {
    const moduleDir = path.join(PATHS.modulesDir, dir);
    const manifest = parseModuleManifest(moduleDir);
    if (!manifest) continue;

    // Check if module is registered (active) in _registry.ts
    const importPattern = new RegExp(`from\\s+['\\./"]+${dir}/module['\"]`);
    const isActive = importPattern.test(registryContent);

    // Check for route stub
    const routeStub = manifest.hasTab
      ? path.join(PATHS.tabsDir, dir + '.tsx')
      : null;
    const hasRouteStub = routeStub ? fileExists(routeStub) : false;

    // Check companion plugin
    const companionExists = manifest.companionPlugin
      ? fileExists(path.join(PATHS.pluginsDir, manifest.companionPlugin))
      : null;

    // Count files
    const fileCount = countFiles(moduleDir);

    modules.push({
      ...manifest,
      folder: dir,
      active: isActive,
      hasRouteStub,
      companionExists,
      fileCount,
    });
  }

  return modules;
}

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
    else count++;
  }
  return count;
}

/** Toggle a module active/inactive in _registry.ts. Pass mod to skip re-scan. */
function toggleModule(moduleId, active, mod) {
  if (!fileExists(PATHS.registryTs)) return { ok: false, error: '_registry.ts not found' };

  if (!mod) {
    const modules = getInstalledModules();
    mod = modules.find(m => m.id === moduleId);
  }
  if (!mod) return { ok: false, error: 'Module not found: ' + moduleId };

  let content = fs.readFileSync(PATHS.registryTs, 'utf8');
  const exportName = mod.folder.replace(/-/g, '') + 'Module';

  if (active && !mod.active) {
    // Add import line — insert before the blank line preceding `export const MODULES`
    const importLine = `import { ${exportName} } from './${mod.folder}/module';`;
    content = content.replace(
      /(\n)(export const MODULES)/,
      `\n${importLine}\n$2`
    );

    // Add entry to MODULES array — insert before the closing bracket
    content = content.replace(
      /(\n)(];[\s\n]*\/\/ =+[\s\n]*\/\/ END YOUR MODULES)/,
      `\n  ${exportName},\n$2`
    );

    // Clean up triple+ blank lines
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(PATHS.registryTs, content);
    return { ok: true, message: `${mod.name} activated` };

  } else if (!active && mod.active) {
    // Remove import line
    const importRegex = new RegExp(`import\\s*\\{\\s*${exportName}\\s*\\}\\s*from\\s*['\\./"]+${mod.folder}/module['\"];?\\n?`, 'g');
    content = content.replace(importRegex, '');

    // Remove from MODULES array
    const arrayRegex = new RegExp(`\\s*${exportName},?\\n`, 'g');
    content = content.replace(arrayRegex, '\n');

    // Clean up triple+ blank lines
    content = content.replace(/\n{3,}/g, '\n\n');
    fs.writeFileSync(PATHS.registryTs, content);
    return { ok: true, message: `${mod.name} deactivated` };
  }

  return { ok: true, message: 'No change needed' };
}

/** Remove a module entirely */
function removeModule(moduleId) {
  const modules = getInstalledModules();
  const mod = modules.find(m => m.id === moduleId);
  if (!mod) return { ok: false, error: 'Module not found: ' + moduleId };

  // Deactivate first (pass mod to avoid re-scanning)
  if (mod.active) toggleModule(moduleId, false, mod);

  // Remove module folder
  const moduleDir = path.join(PATHS.modulesDir, mod.folder);
  fs.rmSync(moduleDir, { recursive: true, force: true });

  // Remove route stub if exists
  if (mod.hasTab) {
    const stubPath = path.join(PATHS.tabsDir, mod.folder + '.tsx');
    if (fileExists(stubPath)) fs.unlinkSync(stubPath);
  }

  return { ok: true, message: `${mod.name} removed` };
}

// ---------------------------------------------------------------------------
// Module Export — create a zip package from a module folder
// ---------------------------------------------------------------------------

/** Recursively collect all files in a directory (relative paths) */
function collectFiles(dir, base) {
  base = base || dir;
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      results.push({ path: rel, data: fs.readFileSync(full) });
    }
  }
  return results;
}

/**
 * Create a .tar.gz package for a module.
 * Format:
 *   manifest.json           — metadata
 *   module/<files>           — the module folder contents
 *   route-stubs/<file>.tsx   — tab route stub (if module has a tab)
 *   companion-plugin/<files> — companion WordPress plugin (if exists)
 *
 * Uses tar format (built-in to Node via manual implementation) since
 * Node doesn't have built-in zip. .tar.gz is universally extractable.
 */
function exportModule(moduleId) {
  const modules = getInstalledModules();
  const mod = modules.find(m => m.id === moduleId);
  if (!mod) return { ok: false, error: 'Module not found: ' + moduleId };

  const moduleDir = path.join(PATHS.modulesDir, mod.folder);
  const files = [];

  // Manifest
  const manifest = {
    id: mod.id,
    name: mod.name,
    version: mod.version,
    description: mod.description,
    author: mod.author || null,
    authorUrl: mod.authorUrl || null,
    license: mod.license || null,
    minAppVersion: mod.minAppVersion || null,
    folder: mod.folder,
    hasTab: mod.hasTab,
    companionPlugin: mod.companionPlugin || null,
    apiBase: mod.apiBase || null,
    exportedAt: new Date().toISOString(),
    format: 1,
  };
  files.push({ path: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2)) });

  // Module files
  const moduleFiles = collectFiles(moduleDir);
  for (const f of moduleFiles) {
    files.push({ path: 'module/' + f.path, data: f.data });
  }

  // Route stub
  if (mod.hasTab) {
    const stubPath = path.join(PATHS.tabsDir, mod.folder + '.tsx');
    if (fileExists(stubPath)) {
      files.push({ path: 'route-stubs/' + mod.folder + '.tsx', data: fs.readFileSync(stubPath) });
    }
  }

  // Companion plugin
  if (mod.companionPlugin) {
    const pluginDir = path.join(PATHS.pluginsDir, mod.companionPlugin);
    if (fileExists(pluginDir)) {
      const pluginFiles = collectFiles(pluginDir);
      for (const f of pluginFiles) {
        files.push({ path: 'companion-plugin/' + f.path, data: f.data });
      }
    }
  }

  // Build tar
  const tarBuffer = createTar(files);
  const gzipped = zlib.gzipSync(tarBuffer);

  return {
    ok: true,
    filename: `${mod.id}-module-${mod.version}.tar.gz`,
    data: gzipped,
    manifest,
  };
}

/** Create a minimal tar archive from a list of {path, data} entries */
function createTar(files) {
  const blocks = [];
  for (const file of files) {
    const header = Buffer.alloc(512, 0);
    // name (100 bytes)
    const nameBytes = Buffer.from(file.path, 'utf8');
    nameBytes.copy(header, 0, 0, Math.min(nameBytes.length, 100));
    // mode (8 bytes at offset 100)
    Buffer.from('0000644\0', 'ascii').copy(header, 100);
    // uid (8 bytes at offset 108)
    Buffer.from('0001000\0', 'ascii').copy(header, 108);
    // gid (8 bytes at offset 116)
    Buffer.from('0001000\0', 'ascii').copy(header, 116);
    // size (12 bytes at offset 124, octal)
    const sizeOctal = file.data.length.toString(8).padStart(11, '0') + '\0';
    Buffer.from(sizeOctal, 'ascii').copy(header, 124);
    // mtime (12 bytes at offset 136)
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
    Buffer.from(mtime, 'ascii').copy(header, 136);
    // Initialize checksum field with spaces (8 bytes at offset 148)
    Buffer.from('        ', 'ascii').copy(header, 148);
    // typeflag (1 byte at offset 156) — '0' for regular file
    header[156] = 0x30;
    // magic (6 bytes at offset 257)
    Buffer.from('ustar\0', 'ascii').copy(header, 257);
    // version (2 bytes at offset 263)
    Buffer.from('00', 'ascii').copy(header, 263);

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
    Buffer.from(checksumStr, 'ascii').copy(header, 148);

    blocks.push(header);
    blocks.push(file.data);
    // Pad to 512-byte boundary
    const remainder = file.data.length % 512;
    if (remainder > 0) blocks.push(Buffer.alloc(512 - remainder, 0));
  }
  // End-of-archive marker (two empty blocks)
  blocks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(blocks);
}

// ---------------------------------------------------------------------------
// Module Import — extract a .tar.gz package and install
// ---------------------------------------------------------------------------

function importModule(tarGzBuffer) {
  // Decompress
  let tarBuffer;
  try {
    tarBuffer = zlib.gunzipSync(tarGzBuffer);
  } catch {
    return { ok: false, error: 'Failed to decompress — is this a valid .tar.gz file?' };
  }

  // Parse tar
  const files = parseTar(tarBuffer);
  if (files.length === 0) return { ok: false, error: 'Empty archive' };

  // Find manifest
  const manifestFile = files.find(f => f.path === 'manifest.json');
  if (!manifestFile) return { ok: false, error: 'No manifest.json found in package' };

  let manifest;
  try { manifest = JSON.parse(manifestFile.data.toString('utf8')); }
  catch { return { ok: false, error: 'Invalid manifest.json' }; }

  if (!manifest.id || !manifest.name) return { ok: false, error: 'manifest.json missing required fields (id, name)' };

  const folder = manifest.folder || manifest.id;
  const moduleDir = path.join(PATHS.modulesDir, folder);

  // Check if already exists
  if (fileExists(moduleDir)) {
    // Overwrite (update)
    fs.rmSync(moduleDir, { recursive: true, force: true });
  }

  // Extract module files
  const moduleFiles = files.filter(f => f.path.startsWith('module/'));
  if (moduleFiles.length === 0) return { ok: false, error: 'No module files found in package' };

  for (const file of moduleFiles) {
    const relPath = file.path.replace(/^module\//, '');
    const destPath = path.resolve(moduleDir, relPath);
    if (!destPath.startsWith(moduleDir + path.sep) && destPath !== moduleDir) continue;
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, file.data);
  }

  // Extract route stubs
  const routeStubs = files.filter(f => f.path.startsWith('route-stubs/'));
  for (const file of routeStubs) {
    const filename = path.basename(file.path);
    const destPath = path.join(PATHS.tabsDir, filename);
    fs.writeFileSync(destPath, file.data);
  }

  // Extract companion plugin
  const pluginFiles = files.filter(f => f.path.startsWith('companion-plugin/'));
  if (pluginFiles.length > 0 && manifest.companionPlugin) {
    const pluginDir = path.join(PATHS.pluginsDir, manifest.companionPlugin);
    fs.mkdirSync(pluginDir, { recursive: true });
    for (const file of pluginFiles) {
      const relPath = file.path.replace(/^companion-plugin\//, '');
      const destPath = path.resolve(pluginDir, relPath);
      if (!destPath.startsWith(pluginDir + path.sep) && destPath !== pluginDir) continue;
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, file.data);
    }
  }

  // Register in _registry.ts
  const result = toggleModule(manifest.id, true);

  return {
    ok: true,
    message: `${manifest.name} v${manifest.version} installed (${moduleFiles.length} files)`,
    manifest,
    registryResult: result,
  };
}

/** Parse a tar buffer into an array of {path, data} */
function parseTar(buffer) {
  const files = [];
  let offset = 0;
  while (offset < buffer.length - 512) {
    const header = buffer.subarray(offset, offset + 512);
    // Check for end-of-archive (first byte zero means null header)
    if (header[0] === 0) break;

    // Extract name (normalize: strip leading ./ and backslashes)
    let name = '';
    for (let i = 0; i < 100 && header[i] !== 0; i++) name += String.fromCharCode(header[i]);
    name = name.trim().replace(/\\/g, '/').replace(/^\.\//, '');

    // Extract size (octal, 12 bytes at offset 124)
    const sizeStr = header.subarray(124, 136).toString('ascii').trim().replace(/\0/g, '');
    const size = parseInt(sizeStr, 8) || 0;

    // Type flag
    const typeflag = header[156];

    offset += 512;

    if (size > 0 && (typeflag === 0x30 || typeflag === 0)) { // regular file
      const data = buffer.subarray(offset, offset + size);
      files.push({ path: name, data });
    }

    // Skip data blocks (padded to 512)
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

// ---------------------------------------------------------------------------
// Multipart Parser
// ---------------------------------------------------------------------------

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    if (!boundaryMatch) return reject(new Error('No boundary in content-type'));
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const parts = [];
      const boundaryBuf = Buffer.from('--' + boundary);
      const crlfcrlf = Buffer.from('\r\n\r\n');
      let start = buffer.indexOf(boundaryBuf, 0);
      if (start === -1) return resolve(parts);
      while (true) {
        const nextStart = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
        if (nextStart === -1) break;
        const partData = buffer.subarray(start + boundaryBuf.length, nextStart);
        const headerEnd = partData.indexOf(crlfcrlf, 0);
        if (headerEnd === -1) { start = nextStart; continue; }
        const headerStr = partData.subarray(0, headerEnd).toString('utf8');
        const body = partData.subarray(headerEnd + 4, partData.length - 2);
        const nameMatch = headerStr.match(/name="([^"]+)"/);
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        parts.push({ name: nameMatch ? nameMatch[1] : '', filename: filenameMatch ? filenameMatch[1] : '', data: body });
        start = nextStart;
      }
      resolve(parts);
    });
    req.on('error', reject);
  });
}

// Concurrency guard — prevent overlapping update operations
let _updateInProgress = false;

// ---------------------------------------------------------------------------
// Update System — HTTPS helper
// ---------------------------------------------------------------------------

/**
 * Make an HTTPS request. Returns { statusCode, body }.
 * Follows up to 3 redirects. Supports GET and POST.
 */
function httpsRequest(url, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const method = (options.method || 'GET').toUpperCase();
    const reqOptions = {
      method,
      timeout: options.timeout || 30000,
      headers: {
        'User-Agent': 'TBC-Dashboard/' + DASHBOARD_VERSION,
        ...(options.headers || {}),
      },
    };

    const req = mod.request(url, reqOptions, (res) => {
      // Follow redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(httpsRequest(res.headers.location, options, redirects + 1));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, body, headers: res.headers });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Update System — License
// ---------------------------------------------------------------------------

function readLicense() {
  try { return fs.readFileSync(PATHS.licenseFile, 'utf8').trim(); } catch { return ''; }
}

function writeLicense(key) {
  fs.mkdirSync(path.dirname(PATHS.licenseFile), { recursive: true });
  fs.writeFileSync(PATHS.licenseFile, key.trim());
}

function readManifest() {
  return readJsonSafe(PATHS.manifest) || { version: '0.0.0', protectedPaths: [] };
}

/**
 * Validate license key against the update server.
 * Returns the server response JSON or { valid: false, error: '...' }.
 */
async function validateLicense(key) {
  const manifest = readManifest();
  const updateUrl = manifest.updateUrl;
  if (!updateUrl) return { valid: false, error: 'No update URL configured in manifest.json' };

  try {
    const res = await httpsRequest(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: key,
        currentVersion: manifest.version,
        product: manifest.product || 'tbc-community-app',
        siteUrl: getSiteUrl(readJsonSafe(PATHS.easJson)) || '',
      }),
      timeout: 15000,
    });
    const data = JSON.parse(res.body.toString());
    return data;
  } catch (err) {
    return { valid: false, error: 'Could not reach update server: ' + err.message };
  }
}

/**
 * Deactivate license on the server (release the activation slot).
 * Best-effort — doesn't throw on failure.
 */
async function deactivateLicense(key) {
  const manifest = readManifest();
  const updateUrl = manifest.updateUrl;
  if (!updateUrl) return;

  const deactivateUrl = updateUrl.replace(/\/check\s*$/, '/deactivate');

  try {
    await httpsRequest(deactivateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: key,
        siteUrl: getSiteUrl(readJsonSafe(PATHS.easJson)) || '',
      }),
      timeout: 10000,
    });
  } catch {
    // Best-effort — don't block removal if server is unreachable
  }
}

// ---------------------------------------------------------------------------
// Update System — Backup & Restore
// ---------------------------------------------------------------------------

/** Directories and patterns to exclude from backups */
const BACKUP_EXCLUDES = ['node_modules', '.expo', '.git', 'setup/.backups', 'setup/.temp', 'ios', 'android', 'web-build', 'dist'];

/** Recursively copy a directory, skipping excluded paths */
function copyDirRecursive(src, dest, excludes, baseDir) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relPath = path.relative(baseDir, srcPath).replace(/\\/g, '/');

    // Check excludes
    if (excludes.some((ex) => relPath === ex || relPath.startsWith(ex + '/'))) continue;

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, excludes, baseDir);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createBackup(currentVersion) {
  const timestamp = Date.now();
  const label = `v${currentVersion}-${timestamp}`;
  const backupDir = path.join(PATHS.backupsDir, label);
  fs.mkdirSync(backupDir, { recursive: true });
  copyDirRecursive(PROJECT_DIR, backupDir, BACKUP_EXCLUDES, PROJECT_DIR);
  // Cache the backup size so listBackups() doesn't need to re-walk the tree
  const size = getDirSize(backupDir);
  fs.writeFileSync(path.join(backupDir, '.size'), String(size));
  return { label, path: backupDir };
}

function listBackups() {
  if (!fs.existsSync(PATHS.backupsDir)) return [];
  const dirs = fs.readdirSync(PATHS.backupsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const parts = d.name.match(/^v(.+)-(\d+)$/);
      const stat = fs.statSync(path.join(PATHS.backupsDir, d.name));
      return {
        id: d.name,
        version: parts ? parts[1] : d.name,
        timestamp: parts ? parseInt(parts[2]) : stat.mtimeMs,
        date: new Date(parts ? parseInt(parts[2]) : stat.mtimeMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        sizeMB: 0, // Calculated below
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  // Read cached sizes (written at backup creation) or fall back to walking
  for (const backup of dirs) {
    try {
      const sizeFile = path.join(PATHS.backupsDir, backup.id, '.size');
      const totalSize = fs.existsSync(sizeFile)
        ? parseInt(fs.readFileSync(sizeFile, 'utf8'), 10)
        : getDirSize(path.join(PATHS.backupsDir, backup.id));
      backup.sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    } catch { backup.sizeMB = '?'; }
  }
  return dirs;
}

function getDirSize(dirPath) {
  let total = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function restoreFromBackup(backupId) {
  const backupDir = path.join(PATHS.backupsDir, backupId);
  if (!fs.existsSync(backupDir)) throw new Error('Backup not found: ' + backupId);

  // Copy all files from backup to project root, overwriting
  copyDirRecursive(backupDir, PROJECT_DIR, [], backupDir);
  return { restored: true, backupId };
}

function deleteBackup(backupId) {
  const backupDir = path.join(PATHS.backupsDir, backupId);
  if (!fs.existsSync(backupDir)) return;
  fs.rmSync(backupDir, { recursive: true, force: true });
}

/** Keep only the N most recent backups, delete older ones */
function pruneBackups(keep = 3) {
  const backups = listBackups();
  const toDelete = backups.slice(keep);
  for (const b of toDelete) deleteBackup(b.id);
  return toDelete.length;
}

// ---------------------------------------------------------------------------
// Update System — Apply Update
// ---------------------------------------------------------------------------

/**
 * Check if a file path is protected (buyer-customized, should not be overwritten).
 * Uses the protectedPaths from manifest.json.
 */
function isProtectedPath(filePath, protectedPaths) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const p of protectedPaths) {
    if (p.endsWith('/')) {
      // Directory prefix match
      if (normalized.startsWith(p) || normalized === p.slice(0, -1)) return true;
    } else {
      // Exact file match
      if (normalized === p) return true;
    }
  }
  return false;
}

/**
 * Apply a core update from a tar.gz buffer.
 * - Extracts the tar
 * - Skips protected paths (buyer-customized files)
 * - Writes core files to the project directory
 * - Handles dashboard self-update via dashboard.next.js
 * - Merges package.json dependencies if package-deps.json is included
 * Returns { filesWritten, filesSkipped, dashboardUpdated, depsChanged }
 */
function applyUpdateFromTar(tarGzBuffer) {
  const manifest = readManifest();
  const protectedPaths = manifest.protectedPaths || [];

  // Decompress
  const tarBuffer = zlib.gunzipSync(tarGzBuffer);
  const files = parseTar(tarBuffer);

  let filesWritten = 0;
  let filesSkipped = 0;
  let dashboardUpdated = false;
  let depsChanged = false;
  let newVersion = null;

  // Check for an embedded manifest in the update (paths already normalized by parseTar)
  const updateManifest = files.find((f) => f.path === 'manifest.json');

  // Check for package-deps.json (dependency changes)
  const packageDeps = files.find((f) => f.path === 'package-deps.json');

  for (const file of files) {
    // Paths already normalized by parseTar (no ./ prefix, forward slashes)
    const relPath = file.path;

    // Skip directories (path ends with /)
    if (relPath.endsWith('/')) continue;
    // Skip the update's own manifest and deps file — processed separately
    if (relPath === 'manifest.json' || relPath === 'package-deps.json') continue;

    // Handle dashboard self-update
    if (relPath === 'setup/dashboard.js') {
      const destPath = path.join(PROJECT_DIR, 'setup', 'dashboard.next.js');
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, file.data);
      dashboardUpdated = true;
      filesWritten++;
      continue;
    }

    // Skip protected paths
    if (isProtectedPath(relPath, protectedPaths)) {
      filesSkipped++;
      continue;
    }

    // Write the file (with path traversal guard)
    const destPath = path.resolve(PROJECT_DIR, relPath);
    if (!destPath.startsWith(PROJECT_DIR + path.sep) && destPath !== PROJECT_DIR) {
      filesSkipped++;
      continue;
    }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, file.data);
    filesWritten++;
  }

  // Merge package.json dependencies if included
  if (packageDeps) {
    try {
      const depChanges = JSON.parse(packageDeps.data.toString());
      depsChanged = mergePackageDeps(depChanges);
    } catch { /* ignore malformed deps file */ }
  }

  // Update manifest.json version from the update's manifest
  if (updateManifest) {
    try {
      const um = JSON.parse(updateManifest.data.toString());
      if (um.version) {
        newVersion = um.version;
        const localManifest = readManifest();
        localManifest.version = um.version;
        if (um.dashboardVersion) localManifest.dashboardVersion = um.dashboardVersion;
        fs.writeFileSync(PATHS.manifest, JSON.stringify(localManifest, null, 2) + '\n');
      }
    } catch { /* ignore */ }
  }

  return { filesWritten, filesSkipped, dashboardUpdated, depsChanged, newVersion };
}

/**
 * Merge dependency changes into the buyer's package.json.
 * Preserves name, version, scripts, and any buyer-added deps.
 */
function mergePackageDeps(depChanges) {
  const pkgPath = PATHS.packageJson;
  const pkg = readJsonSafe(pkgPath);
  if (!pkg) return false;

  let changed = false;

  // Merge dependencies
  if (depChanges.dependencies) {
    if (!pkg.dependencies) pkg.dependencies = {};
    for (const [name, version] of Object.entries(depChanges.dependencies)) {
      if (version === null) {
        // Remove
        if (pkg.dependencies[name]) { delete pkg.dependencies[name]; changed = true; }
      } else if (pkg.dependencies[name] !== version) {
        pkg.dependencies[name] = version;
        changed = true;
      }
    }
  }

  // Merge devDependencies
  if (depChanges.devDependencies) {
    if (!pkg.devDependencies) pkg.devDependencies = {};
    for (const [name, version] of Object.entries(depChanges.devDependencies)) {
      if (version === null) {
        if (pkg.devDependencies[name]) { delete pkg.devDependencies[name]; changed = true; }
      } else if (pkg.devDependencies[name] !== version) {
        pkg.devDependencies[name] = version;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
  return changed;
}

/**
 * Download an update from a URL. Returns the raw Buffer.
 */
async function downloadUpdate(url, licenseKey) {
  const headers = {};
  if (licenseKey) headers['X-License-Key'] = licenseKey;

  const res = await httpsRequest(url, { headers, timeout: 120000 });
  if (res.statusCode !== 200) {
    throw new Error('Download failed with status ' + res.statusCode);
  }
  return res.body;
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

// Auto-shutdown: stop the server if no browser heartbeat for 2 minutes
let lastHeartbeat = Date.now();
const HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const heartbeatCheck = setInterval(() => {
  if (Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT) {
    console.log('\\n  No browser connection for 5 minutes — shutting down.');
    process.exit(0);
  }
}, 30000);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // --- API Routes ---
    if (pathname === '/api/heartbeat' && req.method === 'GET') {
      lastHeartbeat = Date.now();
      jsonResponse(res, { ok: true });
      return;
    }

    if (pathname === '/api/shutdown' && req.method === 'POST') {
      jsonResponse(res, { ok: true });
      console.log('\\n  Dashboard stopped via browser.');
      setTimeout(() => process.exit(0), 500);
      return;
    }

    if (pathname === '/api/state' && req.method === 'GET') {
      lastHeartbeat = Date.now();
      jsonResponse(res, readProjectState());
      return;
    }

    if (pathname === '/api/config' && req.method === 'POST') {
      const body = await readBody(req);
      const changes = JSON.parse(body);
      const results = writeConfigValues(changes);
      jsonResponse(res, { ok: true, results });
      return;
    }


    if (pathname === '/api/connectivity' && req.method === 'GET') {
      const siteUrl = getSiteUrl(readJsonSafe(PATHS.easJson));
      const results = await checkConnectivity(siteUrl);
      jsonResponse(res, results);
      return;
    }

    // --- Install Dependencies ---
    if (pathname === '/api/install-deps' && req.method === 'POST') {
      if (installProcess.status === 'running') {
        jsonResponse(res, { ok: false, error: 'Install already in progress' });
        return;
      }
      // Detect package manager from lockfile
      let cmd = 'npm', cmdArgs = ['install'];
      if (fileExists(path.join(PROJECT_DIR, 'yarn.lock'))) { cmd = 'yarn'; }
      else if (fileExists(path.join(PROJECT_DIR, 'pnpm-lock.yaml'))) { cmd = 'pnpm'; }

      installProcess = { status: 'running', output: '', exitCode: null };
      var child = spawn(cmd + ' ' + cmdArgs.join(' '), [], { cwd: PROJECT_DIR, shell: true, timeout: 300000 });
      child.stdout.on('data', function(d) { installProcess.output += d.toString(); });
      child.stderr.on('data', function(d) { installProcess.output += d.toString(); });
      child.on('close', function(code) {
        installProcess.status = code === 0 ? 'done' : 'error';
        installProcess.exitCode = code;
      });
      child.on('error', function(err) {
        installProcess.status = 'error';
        installProcess.output += '\n' + err.message;
      });
      jsonResponse(res, { ok: true, status: 'running' });
      return;
    }

    if (pathname === '/api/install-deps/status' && req.method === 'GET') {
      jsonResponse(res, { status: installProcess.status, output: installProcess.output, exitCode: installProcess.exitCode });
      return;
    }

    // --- EAS CLI API Routes ---
    if (pathname === '/api/eas/status' && req.method === 'GET') {
      let easVersion = '', easUser = '', easLoggedIn = false, easInstalled = false;
      try {
        easVersion = (await runCommand(['eas', '--version'], 10000)).trim();
        easInstalled = true;
      } catch (e) { /* not installed */ }
      if (easInstalled) {
        try {
          easUser = (await runCommand(['eas', 'whoami'], 10000)).trim().split('\n')[0].trim();
          easLoggedIn = true;
        } catch (e) { /* not logged in */ }
      }
      jsonResponse(res, { ok: true, installed: easInstalled, version: easVersion, loggedIn: easLoggedIn, user: easUser });
      return;
    }

    if (pathname === '/api/eas/install-cli' && req.method === 'POST') {
      try {
        await runCommand(['npm', 'install', '-g', 'eas-cli'], 120000);
        jsonResponse(res, { ok: true });
      } catch (e) {
        jsonResponse(res, { ok: false, error: e.stderr || e.message });
      }
      return;
    }

    if (pathname === '/api/eas/login' && req.method === 'POST') {
      try {
        spawn('eas login --browser', [], { cwd: PROJECT_DIR, shell: true, stdio: 'ignore', detached: true }).unref();
        jsonResponse(res, { ok: true, message: 'Login opened in your browser. Complete login there, then click Check Status.' });
      } catch (e) {
        jsonResponse(res, { ok: false, error: e.message });
      }
      return;
    }

    if (pathname === '/api/eas/logout' && req.method === 'POST') {
      try {
        await runCommand(['eas', 'logout'], 10000);
        jsonResponse(res, { ok: true });
      } catch (e) {
        jsonResponse(res, { ok: false, error: e.stderr || e.message });
      }
      return;
    }

    if (pathname === '/api/eas/init' && req.method === 'POST') {
      try {
        // Clear placeholder projectId so eas init creates a fresh project
        const appJsonPath = path.join(PROJECT_DIR, 'app.json');
        const preInit = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
        const currentPid = preInit.expo?.extra?.eas?.projectId || '';
        const currentOwner = preInit.expo?.owner || '';
        if (isPlaceholder(currentPid) || isPlaceholder(currentOwner)) {
          if (isPlaceholder(currentPid) && preInit.expo?.extra?.eas) {
            delete preInit.expo.extra.eas.projectId;
          }
          if (isPlaceholder(currentOwner) && preInit.expo) {
            delete preInit.expo.owner;
          }
          fs.writeFileSync(appJsonPath, JSON.stringify(preInit, null, 2) + '\n');
        }
        const initOutput = await runCommand(['eas', 'init', '--non-interactive', '--force'], 30000);
        // Re-read app.json to get the newly written projectId and owner
        const freshExpo = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'app.json'), 'utf8'));
        const newOwner = (freshExpo.expo && freshExpo.expo.owner) || '';
        const newProjectId = (freshExpo.expo && freshExpo.expo.extra && freshExpo.expo.extra.eas && freshExpo.expo.extra.eas.projectId) || '';
        jsonResponse(res, { ok: true, owner: newOwner, projectId: newProjectId, output: initOutput });
      } catch (e) {
        jsonResponse(res, { ok: false, error: e.stderr || e.message });
      }
      return;
    }

    // --- Module API Routes ---
    if (pathname === '/api/modules' && req.method === 'GET') {
      jsonResponse(res, { ok: true, modules: getInstalledModules() });
      return;
    }

    if (pathname === '/api/modules/toggle' && req.method === 'POST') {
      const body = await readBody(req);
      const { moduleId, active } = JSON.parse(body);
      const result = toggleModule(moduleId, active);
      jsonResponse(res, result);
      return;
    }

    if (pathname === '/api/modules/remove' && req.method === 'POST') {
      const body = await readBody(req);
      const { moduleId } = JSON.parse(body);
      const result = removeModule(moduleId);
      jsonResponse(res, result);
      return;
    }

    if (pathname.startsWith('/api/modules/export/') && req.method === 'GET') {
      const moduleId = pathname.replace('/api/modules/export/', '');
      const result = exportModule(moduleId);
      if (!result.ok) { jsonResponse(res, result, 400); return; }
      res.writeHead(200, {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': result.data.length,
      });
      res.end(result.data);
      return;
    }

    if (pathname === '/api/modules/import' && req.method === 'POST') {
      const parts = await parseMultipart(req);
      if (parts.length === 0) { jsonResponse(res, { ok: false, error: 'No file uploaded' }, 400); return; }
      const result = importModule(parts[0].data);
      jsonResponse(res, result);
      return;
    }

    // --- Build API Routes ---
    if (pathname === '/api/builds' && req.method === 'GET') {
      const result = await getEasBuilds();
      jsonResponse(res, result);
      return;
    }

    if (pathname === '/api/builds/new' && req.method === 'POST') {
      const body = await readBody(req);
      const { platform, profile } = JSON.parse(body);
      if (!platform || !profile) { jsonResponse(res, { ok: false, error: 'Missing platform or profile' }, 400); return; }
      // Validate inputs before firing
      if (!VALID_PLATFORMS.includes(platform)) { jsonResponse(res, { ok: false, error: 'Invalid platform' }, 400); return; }
      if (!VALID_PROFILES.includes(profile)) { jsonResponse(res, { ok: false, error: 'Invalid profile' }, 400); return; }
      // Fire and forget — respond immediately, build runs in background
      console.log(`  Starting EAS build: ${platform} / ${profile}...`);
      startEasBuild(platform, profile).then(r => {
        if (r.ok) console.log(`  ✓ EAS build queued: ${platform} / ${profile}`);
        else console.log(`  ✗ EAS build failed: ${r.error}`);
      });
      jsonResponse(res, { ok: true });
      return;
    }

    if (pathname === '/api/builds/cancel' && req.method === 'POST') {
      const body = await readBody(req);
      const { buildId } = JSON.parse(body);
      if (!buildId || !BUILD_ID_PATTERN.test(buildId)) { jsonResponse(res, { ok: false, error: 'Missing or invalid buildId' }, 400); return; }
      console.log(`  Cancelling build ${buildId}...`);
      const result = await cancelBuild(buildId);
      jsonResponse(res, result);
      return;
    }

    if (pathname === '/api/builds/submit' && req.method === 'POST') {
      const body = await readBody(req);
      const { platform, buildId } = JSON.parse(body);
      if (!platform || !buildId) { jsonResponse(res, { ok: false, error: 'Missing platform or buildId' }, 400); return; }
      console.log(`  Submitting build ${buildId} to ${platform === 'ios' ? 'App Store' : 'Google Play'}...`);
      const result = await submitBuild(platform, buildId);
      saveSubmission(buildId, platform, result.ok, result.error);
      jsonResponse(res, result);
      return;
    }

    if (pathname === '/api/builds/submissions' && req.method === 'GET') {
      jsonResponse(res, { ok: true, submissions: getSubmissions() });
      return;
    }

    // --- OTA Updates ---
    if (pathname === '/api/ota/status' && req.method === 'GET') {
      const otaStatus = await getOTAStatus();
      jsonResponse(res, { ok: true, ...otaStatus });
      return;
    }

    if (pathname === '/api/ota/push' && req.method === 'POST') {
      const body = await readBody(req);
      const { channel, message, platform } = body;
      console.log(`  Pushing OTA update to ${channel} (${platform || 'all'})...`);
      const result = await pushOTAUpdate(channel, message || '', platform || 'all');
      jsonResponse(res, result);
      return;
    }

    if (pathname === '/api/ota/history' && req.method === 'GET') {
      const result = await listOTAUpdates();
      jsonResponse(res, result);
      return;
    }

    if (pathname === '/api/ota/delete' && req.method === 'POST') {
      const body = await readBody(req);
      const { groupId } = body;
      console.log(`  Deleting OTA update group ${groupId}...`);
      const result = await deleteOTAUpdate(groupId || '');
      jsonResponse(res, result);
      return;
    }

    if (pathname.startsWith('/api/upload/') && req.method === 'POST') {
      const target = pathname.replace('/api/upload/', '');
      const parts = await parseMultipart(req);
      if (parts.length === 0) { jsonResponse(res, { error: 'No file uploaded' }, 400); return; }
      const file = parts[0];
      let destPath;
      if (target === 'firebase-android') {
        destPath = PATHS.googleServicesJson;
      } else if (target === 'firebase-ios') {
        destPath = PATHS.googleServiceInfoPlist;
      } else if (target === 'google-play-key') {
        destPath = PATHS.googlePlayKeyFile;
        // Also update eas.json to point to it
        const easJson = readJsonSafe(PATHS.easJson);
        if (easJson) {
          if (!easJson.submit) easJson.submit = {};
          if (!easJson.submit.production) easJson.submit.production = {};
          if (!easJson.submit.production.android) easJson.submit.production.android = {};
          easJson.submit.production.android.serviceAccountKeyPath = './google-play-service-account.json';
          fs.writeFileSync(PATHS.easJson, JSON.stringify(easJson, null, 2) + '\n');
        }
      } else if (target === 'asset') {
        const safeName = path.basename(file.filename);
        destPath = path.join(PATHS.assetsDir, safeName);
      } else {
        jsonResponse(res, { error: 'Unknown upload target' }, 400);
        return;
      }
      fs.writeFileSync(destPath, file.data);
      jsonResponse(res, { ok: true, path: destPath, size: file.data.length });
      return;
    }

    if (pathname.startsWith('/api/asset/') && req.method === 'GET') {
      const assetName = decodeURIComponent(pathname.replace('/api/asset/', ''));
      const assetPath = path.join(PATHS.assetsDir, path.basename(assetName));
      if (!fileExists(assetPath)) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(assetPath).toLowerCase();
      const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(assetPath).pipe(res);
      return;
    }

    // --- Updates: License ---
    if (pathname === '/api/updates/license' && req.method === 'GET') {
      const key = readLicense();
      const manifest = readManifest();
      if (!key) { jsonResponse(res, { hasLicense: false, currentVersion: manifest.version }); return; }
      try {
        const result = await validateLicense(key);
        jsonResponse(res, { hasLicense: true, key: key.substring(0, 4) + '...' + key.slice(-4), currentVersion: manifest.version, ...result });
      } catch (err) {
        jsonResponse(res, { hasLicense: true, key: key.substring(0, 4) + '...' + key.slice(-4), currentVersion: manifest.version, valid: false, error: err.message });
      }
      return;
    }

    if (pathname === '/api/updates/license' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const key = (body.key || '').trim();
      if (!key) { jsonResponse(res, { error: 'License key is required' }, 400); return; }
      writeLicense(key);
      try {
        const result = await validateLicense(key);
        jsonResponse(res, { saved: true, ...result });
      } catch (err) {
        jsonResponse(res, { saved: true, valid: false, error: err.message });
      }
      return;
    }

    if (pathname === '/api/updates/license' && req.method === 'DELETE') {
      const key = readLicense();
      if (key) {
        await deactivateLicense(key);
      }
      try { fs.unlinkSync(PATHS.licenseFile); } catch { /* ignore */ }
      jsonResponse(res, { removed: true });
      return;
    }

    // --- Updates: Check ---
    if (pathname === '/api/updates/check' && req.method === 'GET') {
      const key = readLicense();
      const manifest = readManifest();
      if (!key) { jsonResponse(res, { hasLicense: false, currentVersion: manifest.version }); return; }
      try {
        const result = await validateLicense(key);
        jsonResponse(res, { currentVersion: manifest.version, ...result });
      } catch (err) {
        jsonResponse(res, { currentVersion: manifest.version, valid: false, error: err.message });
      }
      return;
    }

    // --- Updates: Apply (license-based download) ---
    if (pathname === '/api/updates/apply' && req.method === 'POST') {
      if (_updateInProgress) { jsonResponse(res, { error: 'An update is already in progress' }, 409); return; }
      const body = JSON.parse(await readBody(req));
      const downloadUrl = body.downloadUrl;
      if (!downloadUrl) { jsonResponse(res, { error: 'No download URL provided' }, 400); return; }

      _updateInProgress = true;
      try {
        // 1. Backup current state
        const manifest = readManifest();
        const backup = createBackup(manifest.version);

        // 2. Download the update
        const key = readLicense();
        const tarGzBuffer = await downloadUpdate(downloadUrl, key);

        // 3. Apply the update
        const result = applyUpdateFromTar(tarGzBuffer);

        // 4. Prune old backups
        pruneBackups(3);

        jsonResponse(res, { ok: true, backup: backup.label, ...result });
      } catch (err) {
        jsonResponse(res, { error: 'Update failed: ' + err.message }, 500);
      } finally {
        _updateInProgress = false;
      }
      return;
    }

    // --- Updates: Manual upload (tar.gz or zip) ---
    if (pathname === '/api/updates/upload' && req.method === 'POST') {
      if (_updateInProgress) { jsonResponse(res, { error: 'An update is already in progress' }, 409); return; }
      _updateInProgress = true;
      try {
        const parts = await parseMultipart(req);
        const filePart = parts.find((p) => p.filename);
        if (!filePart) { jsonResponse(res, { error: 'No file uploaded' }, 400); return; }

        // 1. Backup current state
        const manifest = readManifest();
        const backup = createBackup(manifest.version);

        // 2. Apply the update from the uploaded file
        let tarGzBuffer = filePart.data;

        // If it's a .zip, we can't parse it without a zip library — but .tar.gz we can
        const filename = (filePart.filename || '').toLowerCase();
        if (filename.endsWith('.zip')) {
          jsonResponse(res, { error: 'ZIP format not supported yet. Please upload a .tar.gz file.' }, 400);
          return;
        }

        const result = applyUpdateFromTar(tarGzBuffer);

        // 3. Prune old backups
        pruneBackups(3);

        jsonResponse(res, { ok: true, backup: backup.label, ...result });
      } catch (err) {
        jsonResponse(res, { error: 'Upload update failed: ' + err.message }, 500);
      } finally {
        _updateInProgress = false;
      }
      return;
    }

    // --- Updates: Backups ---
    if (pathname === '/api/updates/backups' && req.method === 'GET') {
      jsonResponse(res, { backups: listBackups() });
      return;
    }

    if (pathname === '/api/updates/rollback' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const backupId = body.backupId;
      if (!backupId) { jsonResponse(res, { error: 'Backup ID is required' }, 400); return; }
      // Validate backup ID format to prevent path traversal
      if (!/^v[\d.]+-\d+$/.test(backupId)) { jsonResponse(res, { error: 'Invalid backup ID' }, 400); return; }
      try {
        restoreFromBackup(backupId);
        jsonResponse(res, { ok: true, restored: backupId });
      } catch (err) {
        jsonResponse(res, { error: 'Restore failed: ' + err.message }, 500);
      }
      return;
    }

    if (pathname === '/api/updates/backups/prune' && req.method === 'POST') {
      const deleted = pruneBackups(3);
      jsonResponse(res, { ok: true, deleted });
      return;
    }

    if (pathname === '/api/updates/backups/delete' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const backupId = body.backupId;
      if (!backupId || !/^v[\d.]+-\d+$/.test(backupId)) { jsonResponse(res, { error: 'Invalid backup ID' }, 400); return; }
      deleteBackup(backupId);
      jsonResponse(res, { ok: true });
      return;
    }

    // --- Dashboard HTML (cached at startup) ---
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(dashboardHTML);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

// Cache HTML once at startup (it's a constant template string)
const dashboardHTML = getDashboardHTML();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ERROR: Port ${PORT} is already in use.`);
    console.error('  Another dashboard instance may be running.');
    console.error('  Fix: close the other terminal, or run:');
    console.error('    taskkill /F /IM node.exe  (Windows)');
    console.error('    kill $(lsof -ti :' + PORT + ')   (Mac/Linux)\n');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('');
  console.log('========================================');
  console.log('  Setup Dashboard');
  console.log('========================================');
  console.log('');
  console.log(`  Project: ${PROJECT_DIR}`);
  console.log(`  Dashboard: ${url}`);
  console.log('');
  console.log('  Press Ctrl+C to stop.');
  console.log('');

  try {
    const platform = process.platform;
    if (platform === 'win32') execSync(`start ${url}`, { stdio: 'ignore' });
    else if (platform === 'darwin') execSync(`open ${url}`, { stdio: 'ignore' });
    else execSync(`xdg-open ${url}`, { stdio: 'ignore' });
  } catch { /* ignore */ }
});

process.on('SIGINT', () => { console.log('\n  Dashboard stopped.'); process.exit(0); });
process.on('SIGTERM', () => { process.exit(0); });

// ---------------------------------------------------------------------------
// Dashboard HTML
// ---------------------------------------------------------------------------

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Setup Dashboard</title>
<script>
(function(){var t=localStorage.getItem('dashboard-theme');if(!t)t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';if(t==='dark')document.documentElement.setAttribute('data-theme','dark');})();
</script>
<style>
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #f6f8fa;
    --bg-tertiary: #eaeef2;
    --bg-hover: #d0d7de;
    --border: #d0d7de;
    --border-light: #afb8c1;
    --text-primary: #1f2328;
    --text-secondary: #656d76;
    --text-muted: #8c959f;
    --accent: #0969da;
    --accent-hover: #0550ae;
    --green: #1a7f37;
    --green-bg: rgba(26, 127, 55, 0.1);
    --red: #cf222e;
    --red-bg: rgba(207, 34, 46, 0.1);
    --yellow: #9a6700;
    --yellow-bg: rgba(154, 103, 0, 0.1);
    --purple: #8250df;
    --purple-bg: rgba(130, 80, 223, 0.1);
    --font-mono: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    --radius: 6px;
  }
  [data-theme="dark"] {
    --bg-primary: #0d1117;
    --bg-secondary: #161b22;
    --bg-tertiary: #21262d;
    --bg-hover: #30363d;
    --border: #30363d;
    --border-light: #484f58;
    --text-primary: #e6edf3;
    --text-secondary: #8b949e;
    --text-muted: #6e7681;
    --accent: #58a6ff;
    --accent-hover: #79c0ff;
    --green: #3fb950;
    --green-bg: rgba(63, 185, 80, 0.1);
    --red: #f85149;
    --red-bg: rgba(248, 81, 73, 0.1);
    --yellow: #d29922;
    --yellow-bg: rgba(210, 153, 34, 0.1);
    --purple: #bc8cff;
    --purple-bg: rgba(188, 140, 255, 0.1);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--font-sans); background: var(--bg-primary); color: var(--text-primary); line-height: 1.6; min-height: 100vh; padding-bottom: 70px; }

  .header { background: var(--bg-secondary); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
  .header h1 { font-size: 20px; font-weight: 600; }
  .header .subtitle { color: var(--text-secondary); font-size: 13px; margin-left: 12px; }
  .header-right { display: flex; align-items: center; gap: 12px; }
  .server-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; color: var(--text-secondary); background: var(--bg-tertiary); border: 1px solid var(--border); }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; }
  .status-dot.connected { background: var(--green); box-shadow: 0 0 4px var(--green); }
  .status-dot.disconnected { background: var(--red, #ef4444); }
  .btn-icon { background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 20px; padding: 6px 10px; cursor: pointer; font-size: 12px; line-height: 1; transition: background 0.15s; color: var(--text-secondary); }
  .btn-icon:hover { background: var(--red-bg, #fef2f2); color: var(--red, #ef4444); border-color: var(--red, #ef4444); }
  .theme-toggle { background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 20px; padding: 6px 10px; cursor: pointer; font-size: 16px; line-height: 1; transition: background 0.15s; }
  .theme-toggle:hover { background: var(--bg-hover); }
  .progress-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; }
  .progress-badge.good { background: var(--green-bg); color: var(--green); }
  .progress-badge.partial { background: var(--yellow-bg); color: var(--yellow); }
  .progress-badge.bad { background: var(--red-bg); color: var(--red); }

  .tab-bar { background: var(--bg-secondary); border-bottom: 1px solid var(--border); display: flex; padding: 0 24px; gap: 0; overflow-x: auto; }
  .tab-btn { padding: 12px 20px; border: none; background: none; color: var(--text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; font-family: var(--font-sans); white-space: nowrap; }
  .tab-btn:hover { color: var(--text-primary); }
  .tab-btn.active { color: var(--text-primary); border-bottom-color: var(--accent); }

  .tab-content { display: none; padding: 24px; max-width: 960px; margin: 0 auto; }
  .tab-content.active { display: block; }

  .card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; }
  .card-header { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .card-header h3 { font-size: 14px; font-weight: 600; }
  .card-header .badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-family: var(--font-mono); }
  .card-body { padding: 16px; }

  .field-group { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field-group.single { grid-template-columns: 1fr; }
  .field-group.triple { grid-template-columns: 1fr 1fr 1fr; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-size: 12px; font-weight: 500; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
  .field label .file-hint { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
  .field input, .field select, .field textarea { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 12px; color: var(--text-primary); font-size: 14px; font-family: var(--font-sans); transition: border-color 0.15s; }
  .field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: var(--accent); }
  .field .derive-hint { font-size: 11px; color: var(--text-muted); font-style: italic; }
  .input-with-copy { display: flex; gap: 6px; align-items: center; }
  .input-with-copy input { flex: 1; }
  .copy-btn { padding: 6px 12px; font-size: 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-primary); color: var(--text-secondary); cursor: pointer; white-space: nowrap; }
  .copy-btn:hover { background: var(--bg-secondary); color: var(--text-primary); }
  .wp-sync-hint { display: block; font-size: 11px; color: var(--accent); margin-top: 4px; }
  .field .input-lock-wrap { position: relative; display: flex; align-items: center; }
  .field .input-lock-wrap input { flex: 1; padding-right: 36px; }
  .field .lock-btn { position: absolute; right: 8px; background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; display: flex; align-items: center; transition: color 0.15s; }
  .field .lock-btn:hover { color: var(--accent); }
  .field .lock-btn svg { width: 16px; height: 16px; }
  .field input.locked { color: var(--text-muted); background: var(--bg-tertiary); }
  .field-help { font-size: 12px; line-height: 1.5; color: var(--text-secondary); background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 12px; margin-top: 4px; overflow: hidden; transition: max-height 0.25s ease, opacity 0.2s ease, padding 0.25s ease, margin 0.25s ease; }
  .field-help.collapsed { max-height: 0; opacity: 0; padding: 0 12px; margin: 0; border-color: transparent; }
  .field-help.expanded { max-height: 200px; opacity: 1; }
  .field-help a { color: var(--accent); text-decoration: none; }
  .field-help a:hover { text-decoration: underline; }
  .field-help code { font-family: var(--font-mono); font-size: 11px; background: var(--bg-tertiary); padding: 1px 5px; border-radius: 3px; }
  .help-toggle { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-tertiary); color: var(--text-muted); font-size: 10px; font-weight: 700; cursor: pointer; margin-left: 4px; transition: all 0.15s; flex-shrink: 0; line-height: 1; }
  .help-toggle:hover { border-color: var(--accent); color: var(--accent); background: var(--bg-hover); }
  .field.has-alert input, .field.has-alert select { border-color: var(--yellow); }
  .field-alert { font-size: 11px; color: var(--yellow); margin-top: 2px; }
  .rebuild-notice { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--yellow); margin-top: 3px; }
  .rebuild-notice::before { content: '\u26A0'; font-size: 10px; }

  .cmd-toolbar { display: flex; align-items: center; gap: 6px; padding: 8px 24px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .cmd-toolbar-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px; }
  .cmd-row { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: border-color 0.15s, background 0.15s; }
  .cmd-row:hover { border-color: var(--accent); background: var(--bg-secondary); }
  .cmd-label { font-size: 12px; font-weight: 600; color: var(--text-primary); }
  .build-version-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; }
  .build-version-label { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
  .build-version-input { width: 80px; text-align: center; font-family: var(--font-mono); font-size: 13px; padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-primary); }
  .build-version-input.bumped { border-color: var(--yellow); color: var(--yellow); }
  .version-control { display: flex; gap: 8px; align-items: center; }
  .version-control input { flex: 1; }
  .version-bumps { display: flex; gap: 4px; flex-shrink: 0; }
  .version-files { font-size: 11px; color: var(--text-muted); margin-top: 2px; }


  .btn { padding: 8px 16px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-tertiary); color: var(--text-primary); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: var(--font-sans); }
  .btn:hover { background: var(--bg-hover); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
  .btn-success { background: var(--green); color: #fff; border-color: var(--green); }
  .btn-success:hover { opacity: 0.9; }
  .btn-danger { background: var(--red); color: #fff; border-color: var(--red); }
  .btn-danger:hover { opacity: 0.9; }
  .btn-danger-subtle { color: var(--red); border-color: var(--border); background: transparent; }
  .btn-danger-subtle:hover { background: rgba(248,81,73,0.1); border-color: var(--red); }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  .btn-group { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }

  /* Floating save bar */
  .save-bar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 101;
    background: var(--bg-secondary); border-top: 1px solid var(--border);
    padding: 12px 24px; display: flex; align-items: center; justify-content: flex-end; gap: 12px;
    box-shadow: 0 -2px 12px rgba(0,0,0,0.15);
  }
  .save-bar .unsaved-msg {
    font-size: 13px; color: var(--yellow); font-weight: 500;
    display: none; align-items: center; gap: 6px; margin-right: auto;
  }
  .save-bar.dirty .unsaved-msg { display: flex; }
  .save-bar .unsaved-msg svg { width: 16px; height: 16px; flex-shrink: 0; }
  .save-bar .btn-group { margin-top: 0; }

  .status-icon { font-size: 14px; }
  .status-pass { color: var(--green); }
  .status-fail { color: var(--red); }
  .status-warn { color: var(--yellow); }

  .asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .asset-card { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; text-align: center; position: relative; cursor: pointer; }
  .asset-card.missing { border-color: var(--red); border-style: dashed; }
  .asset-thumb { width: 80px; height: 80px; object-fit: contain; margin: 8px auto; display: block; border-radius: 4px; background: var(--bg-tertiary); }
  .asset-thumb-placeholder { width: 80px; height: 80px; margin: 8px auto; display: flex; align-items: center; justify-content: center; border-radius: 4px; background: var(--bg-tertiary); color: var(--text-muted); font-size: 24px; }
  .asset-name { font-size: 12px; font-weight: 600; margin-top: 4px; }
  .asset-purpose { font-size: 11px; color: var(--text-secondary); }
  .asset-size { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
  .asset-status { position: absolute; top: 8px; right: 8px; font-size: 16px; }

  .drop-zone { border: 2px dashed var(--border); border-radius: var(--radius); padding: 20px; text-align: center; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; font-size: 13px; }
  .drop-zone:hover, .drop-zone.dragover { border-color: var(--accent); background: rgba(88, 166, 255, 0.05); }
  .drop-zone input[type="file"] { display: none; }

  .check-list { list-style: none; }
  .check-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
  .check-item:last-child { border-bottom: none; }
  .check-item .ref { margin-left: auto; font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

  .plugin-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .plugin-item:last-child { border-bottom: none; }
  .plugin-info { flex: 1; }
  .plugin-name { font-weight: 600; font-size: 14px; }
  .plugin-desc { font-size: 12px; color: var(--text-secondary); }
  .plugin-version { font-family: var(--font-mono); font-size: 12px; padding: 2px 8px; border-radius: 10px; background: var(--bg-tertiary); }

  .connectivity-grid { display: grid; gap: 8px; }
  .connectivity-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-primary); border-radius: var(--radius); border: 1px solid var(--border); }
  .connectivity-label { flex: 1; font-size: 14px; }
  .connectivity-url { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
  .connectivity-status { font-family: var(--font-mono); font-size: 12px; }

  /* Build cards */
  .build-card { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
  .build-platform { font-size: 28px; width: 44px; text-align: center; }
  .build-info { flex: 1; }
  .build-info .build-version { font-weight: 600; font-size: 14px; }
  .build-info .build-meta { font-size: 12px; color: var(--text-secondary); }
  .build-info .build-id { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
  .build-log { font-size: 11px; margin-top: 3px; }
  .build-log-ok { color: var(--green); }
  .build-log-fail { color: var(--red); }
  .build-status { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
  .build-status.finished { background: var(--green-bg); color: var(--green); }
  .build-status.in-progress, .build-status.new { background: var(--purple-bg); color: var(--purple); }
  .build-status.errored { background: var(--red-bg); color: var(--red); }
  .build-status.canceled { background: var(--yellow-bg); color: var(--yellow); }
  .build-actions { display: flex; gap: 6px; flex-wrap: wrap; }

  .new-build-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .new-build-card { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
  .new-build-card h4 { font-size: 14px; margin-bottom: 4px; }
  .new-build-card p { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
  .new-build-card .btn-group { justify-content: center; margin-top: 8px; }

  .build-banner { display: none; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
  .build-banner-title { font-weight: 600; margin-bottom: 4px; }
  .build-banner-list { margin: 0; padding-left: 20px; font-size: 13px; }
  .build-banner.blocker { background: var(--error-bg, #fef2f2); border: 1px solid var(--error-border, #fca5a5); }
  .build-banner.blocker .build-banner-title,
  .build-banner.blocker .build-banner-list { color: var(--error-text, #dc2626); }
  .build-banner.warning { background: #fffbeb; border: 1px solid #fcd34d; }
  .build-banner.warning .build-banner-title,
  .build-banner.warning .build-banner-list { color: #92400e; }
  .build-banner.queued { background: #eff6ff; border: 1px solid #93c5fd; }
  .build-banner.queued .build-banner-title { color: #1d4ed8; margin-bottom: 2px; }
  .build-banner.queued .build-banner-hint { font-size: 13px; color: #1e40af; }

  .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: var(--radius); font-size: 14px; font-weight: 500; z-index: 1000; animation: slideUp 0.3s ease; max-width: 400px; }
  .toast.success { background: var(--green); color: #fff; }
  .toast.error { background: var(--red); color: #fff; }
  .toast.info { background: var(--accent); color: #fff; }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .loading { text-align: center; padding: 40px; color: var(--text-secondary); }
  .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle; }
  .deps-banner { background: var(--yellow-bg); border: 1px solid var(--yellow); border-radius: var(--radius); margin: 16px 24px 0; padding: 16px 20px; }
  .deps-banner-content { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
  .deps-banner-content p { margin: 4px 0 0; font-size: 13px; color: var(--text-secondary); }
  .deps-banner-content code { background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  .deps-output { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; margin-top: 12px; max-height: 200px; overflow-y: auto; font-size: 12px; font-family: var(--font-mono); white-space: pre-wrap; word-break: break-all; color: var(--text-secondary); }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Updates Tab */
  .license-row { display: flex; flex-direction: column; gap: 10px; }
  .license-input-group { display: flex; gap: 8px; align-items: center; }
  .license-input-group .input { flex: 1; max-width: 400px; font-family: monospace; }
  .license-status { font-size: 13px; }
  .license-status.valid { color: var(--green); }
  .license-status.invalid { color: var(--red); }
  .license-status.checking { color: var(--text-secondary); }

  .version-info-bar { display: flex; gap: 24px; align-items: center; padding: 12px 16px; background: var(--bg-tertiary); border-radius: var(--radius); margin-bottom: 4px; }
  .version-info-item { display: flex; align-items: center; gap: 8px; }
  .version-info-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
  .version-info-value { font-family: monospace; font-size: 14px; font-weight: 600; }
  .version-info-value.core { color: var(--blue); }
  .version-info-value.app { color: var(--text-primary); }
  .version-info-hint { font-size: 11px; color: var(--text-muted); margin-left: auto; }

  .update-status { padding: 4px 0; }
  .update-available { padding: 16px; background: rgba(187,128,9,0.08); border: 1px solid var(--yellow); border-radius: var(--radius); }
  .update-available h4 { margin: 0 0 8px 0; color: var(--yellow); font-size: 15px; }
  .update-up-to-date { padding: 16px; background: rgba(63,185,80,0.08); border: 1px solid var(--green); border-radius: var(--radius); color: var(--green); }
  .update-changelog { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; margin: 12px 0; font-size: 13px; line-height: 1.6; max-height: 200px; overflow-y: auto; }
  .update-changelog ul { margin: 8px 0; padding-left: 20px; }
  .update-changelog li { margin: 4px 0; }
  .update-changelog h3 { margin: 0 0 8px 0; font-size: 15px; }
  .update-meta { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
  .update-actions { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
  .update-progress { padding: 16px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); }
  .update-progress .step { padding: 4px 0; font-size: 13px; color: var(--text-secondary); }
  .update-progress .step.active { color: var(--accent); font-weight: 600; }
  .update-progress .step.done { color: var(--green); }
  .update-result { padding: 16px; border-radius: var(--radius); margin-top: 12px; }
  .update-result.success { background: rgba(63,185,80,0.08); border: 1px solid var(--green); }
  .update-result.error { background: rgba(248,81,73,0.08); border: 1px solid var(--red); }

  .upload-zone { border: 2px dashed var(--border); border-radius: var(--radius); padding: 32px 16px; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
  .upload-zone:hover, .upload-zone.dragover { border-color: var(--accent); background: rgba(88,166,255,0.05); }
  .upload-prompt { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 14px; }
  .upload-icon { font-size: 32px; }
  .hint-text { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }

  .backup-card { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 8px; }
  .backup-info { display: flex; flex-direction: column; gap: 2px; }
  .backup-version { font-weight: 600; font-size: 14px; }
  .backup-meta { font-size: 12px; color: var(--text-secondary); }
  .backup-actions { display: flex; gap: 8px; }
  .no-backups { color: var(--text-secondary); font-size: 13px; font-style: italic; }

  @media (max-width: 640px) {
    .field-group, .field-group.triple { grid-template-columns: 1fr; }
    .asset-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    .tab-btn { padding: 10px 12px; font-size: 13px; }
    .new-build-grid { grid-template-columns: 1fr; }
    .license-input-group { flex-direction: column; align-items: stretch; }
    .license-input-group .input { max-width: none; }
    .backup-card { flex-direction: column; gap: 8px; align-items: flex-start; }
  }
  .qr-modal-backdrop { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:2000; display:flex; align-items:center; justify-content:center; }
  .qr-modal { background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius); padding:24px; max-width:400px; width:90%; position:relative; text-align:center; }
  .qr-modal-close { position:absolute; top:8px; right:12px; background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-secondary); }
  .qr-modal-close:hover { color:var(--text-primary); }
  .qr-modal h3 { margin:0 0 4px; font-size:16px; }
  .qr-modal .qr-build-info { font-size:12px; color:var(--text-secondary); margin-bottom:16px; }
  .qr-modal .qr-code-container { display:flex; justify-content:center; margin:16px 0; }
  .qr-modal .qr-code-container svg { background:#fff; padding:8px; border-radius:8px; }
  .qr-modal .qr-divider { border:none; border-top:1px solid var(--border); margin:16px 0; }
  .qr-modal .qr-link-row { display:flex; gap:6px; align-items:center; }
  .qr-modal .qr-link-input { flex:1; font-family:var(--font-mono); font-size:11px; padding:6px 8px; border:1px solid var(--border); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); }
  .qr-modal .qr-hint { font-size:11px; color:var(--text-muted); margin-top:12px; }

  /* OTA banners */
  .ota-banner { border-radius: var(--radius); padding: 12px 16px; font-size: 13px; margin-bottom: 0; }
  .ota-banner.success { background: var(--green-bg); color: var(--green); border: 1px solid var(--green); }
  .ota-banner.error { background: var(--red-bg); color: var(--red); border: 1px solid var(--red); }
  .ota-banner.warning { background: var(--yellow-bg); color: var(--yellow); border: 1px solid var(--yellow); }
  .ota-banner.info { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }
</style>
<script async src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js"></script>
</head>
<body>

<div class="header">
  <div style="display:flex;align-items:center">
    <h1>Setup Dashboard</h1>
    <span class="subtitle" id="project-path"></span>
  </div>
  <div class="header-right">
    <span class="progress-badge" id="progress-badge"></span>
    <span class="server-status" id="server-status" title="Server connected">
      <span class="status-dot connected" id="status-dot"></span>
      <span class="status-label" id="status-label">Connected</span>
    </span>
    <button class="btn-icon" id="stop-server-btn" onclick="stopServer()" title="Stop dashboard server">&#9724;</button>
    <button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode">&#9790;</button>
  </div>
</div>

<div id="deps-banner" class="deps-banner" style="display:none">
  <div class="deps-banner-content">
    <div>
      <strong>Step 1: Install Dependencies</strong>
      <p>Run <code>npm install</code> to download required packages. This usually takes 1&ndash;3 minutes.</p>
    </div>
    <button class="btn btn-primary" id="deps-install-btn" onclick="installDeps()">Install Dependencies</button>
  </div>
  <div id="deps-progress" style="display:none">
    <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:var(--text-secondary)">
      <span class="spinner"></span>
      <span id="deps-status-text">Installing dependencies...</span>
    </div>
    <pre id="deps-output" class="deps-output"></pre>
  </div>
</div>

<div class="tab-bar">
  <button class="tab-btn active" data-tab="config">Config</button>
  <button class="tab-btn" data-tab="assets">Assets</button>
  <button class="tab-btn" data-tab="plugins">Plugins & Firebase</button>
  <button class="tab-btn" data-tab="modules">Modules</button>
  <button class="tab-btn" data-tab="builds">Builds</button>
  <button class="tab-btn" data-tab="ota">OTA Updates</button>
  <button class="tab-btn" data-tab="updates">Updates</button>
  <button class="tab-btn" data-tab="status">Status</button>
</div>

<div class="cmd-toolbar">
  <span class="cmd-toolbar-label">Quick Commands</span>
  <button class="help-toggle" type="button" id="cmd-help-toggle" title="Toggle help">?</button>
  <button class="btn btn-sm cmd-copy cmd-row" data-cmd="npm run dev">
    <span class="cmd-label">Dev Server</span>
  </button>
  <button class="btn btn-sm cmd-copy cmd-row" data-cmd="npm run dev:staging" id="cmd-dev-staging">
    <span class="cmd-label">Dev Server (Staging)</span>
  </button>
  <button class="btn btn-sm cmd-copy cmd-row" data-cmd="npm run dashboard">
    <span class="cmd-label">Open Dashboard</span>
  </button>
  <div id="cmd-toast" style="display:none;font-size:11px;color:var(--accent);margin-left:8px"></div>
</div>
<div class="field-help collapsed" id="cmd-help-panel" style="margin:0;border-radius:0;border-left:0;border-right:0">
  Click any command to copy it to your clipboard, then paste into your terminal to run.<br>
  <strong>Dev Server</strong> — <code>npm run dev</code> — starts Expo against your production site.<br>
  <strong>Dev Server (Staging)</strong> — <code>npm run dev:staging</code> — starts Expo against your staging site (shows red STAGING indicator).<br>
  <strong>Open Dashboard</strong> — <code>npm run dashboard</code> — launches this setup dashboard in your browser.
</div>

<!-- ============== Config Tab ============== -->
<div class="tab-content active" id="tab-config">

  <div class="card">
    <div class="card-header">
      <h3>App Identity</h3>
      <span class="badge" style="color:var(--text-muted)">app.json</span>
    </div>
    <div class="card-body">
      <div class="field-group">
        <div class="field">
          <label>App Name <span class="file-hint">app.json > expo.name</span></label>
          <div class="input-with-copy"><input type="text" id="cfg-appName" data-key="appName" placeholder="My Community"><button type="button" class="copy-btn" data-copy-from="cfg-appName" title="Copy for wp-admin Deep Linking">Copy</button></div>
          <span class="wp-sync-hint">&#x1F517; Copy this into wp-admin &rarr; TBC Community App &rarr; Deep Linking</span>
        </div>
        <div class="field">
          <label>Slug <span class="file-hint">app.json > expo.slug</span></label>
          <input type="text" id="cfg-slug" data-key="slug" placeholder="MyCommunity">
          <span class="derive-hint">Auto-derived from app name if blank</span>
        </div>
        <div class="field">
          <label>URL Scheme <span class="file-hint">app.json > expo.scheme</span></label>
          <div class="input-with-copy"><input type="text" id="cfg-scheme" data-key="scheme" placeholder="mycommunity"><button type="button" class="copy-btn" data-copy-from="cfg-scheme" title="Copy for wp-admin Deep Linking">Copy</button></div>
          <span class="derive-hint">Auto-derived from slug if blank</span>
          <span class="wp-sync-hint">&#x1F517; Copy this into wp-admin &rarr; TBC Community App &rarr; Deep Linking</span>
        </div>
        <div class="field">
          <label>App Version <span class="file-hint">app.json + package.json (4 places)</span></label>
          <div class="version-control">
            <input type="text" id="cfg-version" data-key="version" placeholder="1.0.0" pattern="[0-9]+\\.[0-9]+\\.[0-9]+">
            <div class="version-bumps">
              <button type="button" class="btn btn-sm" onclick="bumpVersion('major')" title="Major version (breaking changes)">Major</button>
              <button type="button" class="btn btn-sm" onclick="bumpVersion('minor')" title="Minor version (new features)">Minor</button>
              <button type="button" class="btn btn-sm" onclick="bumpVersion('patch')" title="Patch version (bug fixes)">Patch</button>
            </div>
          </div>
          <span class="version-files">Your App Store version. Updates: app.json (version + buildNumber + versionCode) + package.json</span>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3>Bundle IDs</h3><span class="badge" style="color:var(--text-muted)">app.json</span></div>
    <div class="card-body">
      <div class="field-group">
        <div class="field">
          <label>iOS Bundle ID <span class="file-hint">ios.bundleIdentifier</span></label>
          <div class="input-with-copy"><input type="text" id="cfg-iosBundleId" data-key="iosBundleId" placeholder="com.yourcompany.communityapp"><button type="button" class="copy-btn" data-copy-from="cfg-iosBundleId" title="Copy for wp-admin Deep Linking">Copy</button></div>
          <span class="wp-sync-hint">&#x1F517; Copy this into wp-admin &rarr; TBC Community App &rarr; Deep Linking</span>
        </div>
        <div class="field">
          <label>Android Package <span class="file-hint">android.package</span></label>
          <div class="input-with-copy"><input type="text" id="cfg-androidPackage" data-key="androidPackage" placeholder="com.yourcompany.communityapp"><button type="button" class="copy-btn" data-copy-from="cfg-androidPackage" title="Copy for wp-admin Deep Linking">Copy</button></div>
          <span class="derive-hint">Auto-derived from iOS bundle ID if blank</span>
          <span class="wp-sync-hint">&#x1F517; Copy this into wp-admin &rarr; TBC Community App &rarr; Deep Linking</span>
        </div>
      </div>
    </div>
  </div>


  <div class="card">
    <div class="card-header"><h3>Site URLs</h3><span class="badge" style="color:var(--text-muted)">eas.json + app.config.ts</span></div>
    <div class="card-body">
      <div class="field-group single">
        <div class="field">
          <label>Production URL <span class="file-hint">eas.json</span></label>
          <input type="url" id="cfg-siteUrl" data-key="siteUrl" placeholder="https://your-community-site.com">
          <span class="derive-hint">Used by preview and production builds</span>
        </div>
        <div class="field">
          <label>Staging URL <span class="file-hint">app.config.ts (optional)</span></label>
          <input type="url" id="cfg-stagingUrl" data-key="stagingUrl" placeholder="https://staging.your-site.com (optional)">
          <span class="derive-hint">Used by <code>npm run dev:staging</code> — leave empty if no staging site</span>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3>EAS (Expo) Config</h3><span class="badge" style="color:var(--text-muted)">app.json</span></div>
    <div class="card-body">
      <div id="eas-setup-panel" style="background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span id="eas-status-dot" style="width:10px;height:10px;border-radius:50%;background:var(--text-muted);display:inline-block"></span>
          <span id="eas-status-text" style="font-size:14px;color:var(--text-muted)">Checking EAS status...</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn btn-sm" id="eas-install-btn" onclick="easInstallCli()" style="display:none">Install EAS CLI</button>
          <button class="btn btn-sm" id="eas-login-btn" onclick="easLogin()" style="display:none">Log In to EAS</button>
          <button class="btn btn-sm" id="eas-logout-btn" onclick="easLogout()" style="display:none">Log Out</button>
          <button class="btn btn-sm btn-primary" id="eas-init-btn" onclick="easInit()" style="display:none">Link Project</button>
          <button class="btn btn-sm" id="eas-check-btn" onclick="easCheckStatus()">Check Status</button>
        </div>
      </div>
      <div class="field-group">
        <div class="field">
          <label>EAS Owner <span class="file-hint">expo.owner</span></label>
          <input type="text" id="cfg-easOwner" data-key="easOwner" placeholder="your-eas-owner">
        </div>
        <div class="field">
          <label>EAS Project ID <span class="file-hint">expo.extra.eas.projectId</span></label>
          <input type="text" id="cfg-easProjectId" data-key="easProjectId" placeholder="your-eas-project-id">
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3>App Branding (Code)</h3><span class="badge" style="color:var(--text-muted)">constants/config.ts</span></div>
    <div class="card-body">
      <div class="field-group">
        <div class="field">
          <label>APP_NAME <span class="file-hint">constants/config.ts</span></label>
          <input type="text" id="cfg-appNameConfig" data-key="appNameConfig" placeholder="My Community">
          <span class="derive-hint">Auto-synced with app name</span>
        </div>
        <div class="field">
          <label>APP_USER_AGENT <span class="file-hint">constants/config.ts</span></label>
          <input type="text" id="cfg-userAgent" data-key="userAgent" placeholder="CommunityApp/1.0">
          <span class="derive-hint">Auto-derived from app name</span>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3>iOS App Store Submit</h3><span class="badge" style="color:var(--text-muted)">eas.json</span></div>
    <div class="card-body">
      <div class="field-group">
        <div class="field">
          <label>Apple ID <span class="file-hint">submit.production.ios.appleId</span></label>
          <input type="email" id="cfg-appleId" data-key="appleId" placeholder="your@apple.id">
        </div>
        <div class="field">
          <label>ASC App ID <span class="file-hint">submit.production.ios.ascAppId</span></label>
          <input type="text" id="cfg-ascAppId" data-key="ascAppId" placeholder="0000000000">
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3>Google Play Submit</h3><span class="badge" style="color:var(--text-muted)">eas.json</span></div>
    <div class="card-body">
      <div class="field-group">
        <div class="field">
          <label>Track <span class="file-hint">submit.production.android.track</span></label>
          <select id="cfg-googlePlayTrack" data-key="googlePlayTrack">
            <option value="production">production</option>
            <option value="beta">beta (Open testing)</option>
            <option value="alpha">alpha (Closed testing)</option>
            <option value="internal">internal</option>
          </select>
        </div>
        <div class="field">
          <label>Service Account Key <span class="file-hint">google-play-service-account.json</span></label>
          <div id="google-play-key-status" style="font-size:13px;padding:8px 0"></div>
          <div class="drop-zone" id="drop-google-play-key" style="margin-top:4px">
            Drop Google Play service account JSON here or click to upload
            <input type="file" accept=".json" id="google-play-key-input">
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3>Package</h3><span class="badge" style="color:var(--text-muted)">package.json</span></div>
    <div class="card-body">
      <div class="field-group single">
        <div class="field">
          <label>Package Name <span class="file-hint">package.json > name</span></label>
          <input type="text" id="cfg-packageName" data-key="packageName" placeholder="my-community-app">
          <span class="derive-hint">Auto-derived from slug if blank</span>
        </div>
      </div>
    </div>
  </div>

</div>

<!-- Floating save bar -->
<div class="save-bar" id="save-bar">
  <span class="unsaved-msg">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    You have unsaved changes
  </span>
  <div class="btn-group">
    <button class="btn btn-primary" id="save-config-btn" onclick="saveConfig()">Save Changes</button>
    <button class="btn" onclick="loadState()">Reload from Files</button>
  </div>
</div>

<!-- ============== Assets Tab ============== -->
<div class="tab-content" id="tab-assets">
  <div class="card">
    <div class="card-header"><h3>Branding Assets</h3><span class="badge" style="color:var(--text-muted)">assets/images/</span></div>
    <div class="card-body">
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Replace these images with your branding. Click any asset to upload a replacement.</p>
      <div class="asset-grid" id="asset-grid"></div>
    </div>
  </div>
</div>

<!-- ============== Plugins & Firebase Tab ============== -->
<div class="tab-content" id="tab-plugins">
  <div class="card">
    <div class="card-header"><h3>Firebase Config</h3></div>
    <div class="card-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" id="firebase-section"></div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><h3>Core Companion Plugins</h3><span class="badge" style="color:var(--text-muted)">companion plugins/</span></div>
    <div class="card-body"><div id="core-plugins-list"></div></div>
  </div>
  <div class="card">
    <div class="card-header"><h3>Add-on Plugins</h3><span class="badge" style="color:var(--text-muted)">optional</span></div>
    <div class="card-body"><div id="addon-plugins-list"></div></div>
  </div>
</div>

<!-- ============== Modules Tab ============== -->
<div class="tab-content" id="tab-modules">
  <div class="card">
    <div class="card-header">
      <h3>Install Module</h3>
    </div>
    <div class="card-body">
      <div class="drop-zone" id="drop-module-import" style="padding:30px">
        <div style="font-size:16px;margin-bottom:4px">Drop a module package here (.tar.gz)</div>
        <div style="font-size:12px;color:var(--text-muted)">Or click to browse. The module will be extracted, registered, and ready after your next build.</div>
        <input type="file" accept=".tar.gz,.tgz" id="module-import-input">
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Installed Modules</h3>
      <button class="btn btn-sm" onclick="loadModules()">Refresh</button>
    </div>
    <div class="card-body">
      <div id="modules-list">
        <div class="loading"><span class="spinner"></span> Loading modules...</div>
      </div>
    </div>
  </div>
</div>

<!-- ============== Builds Tab ============== -->
<div class="tab-content" id="tab-builds">
  <div class="card">
    <div class="card-header"><h3>New Build</h3></div>
    <div class="card-body">
      <div id="build-blockers-banner" class="build-banner blocker">
        <div class="build-banner-title">Cannot build — fix these issues first:</div>
        <ul id="build-blockers-list" class="build-banner-list"></ul>
      </div>
      <div id="build-warnings-banner" class="build-banner warning">
        <div class="build-banner-title">Heads up — you can still build, but:</div>
        <ul id="build-warnings-list" class="build-banner-list"></ul>
      </div>
      <div id="build-queued-banner" class="build-banner queued">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="flex:1">
            <div class="build-banner-title" id="build-queued-text"></div>
            <div class="build-banner-hint" id="build-queued-hint"></div>
          </div>
          <button class="btn btn-sm" onclick="loadBuilds()">Refresh</button>
        </div>
      </div>
      <div class="build-version-bar">
        <span class="build-version-label">App Version</span>
        <input type="text" id="build-version" class="build-version-input" readonly>
        <button type="button" class="btn btn-sm" onclick="bumpVersion('major')">Major</button>
        <button type="button" class="btn btn-sm" onclick="bumpVersion('minor')">Minor</button>
        <button type="button" class="btn btn-sm" onclick="bumpVersion('patch')">Patch</button>
        <button type="button" class="btn btn-sm btn-primary" id="build-version-save" style="display:none" onclick="saveVersionFromBuild()">Save</button>
      </div>
      <div class="new-build-grid">
        <div class="new-build-card">
          <h4>iOS</h4>
          <p>Build for iPhone / iPad</p>
          <div class="btn-group">
            <button class="btn btn-sm" onclick="startBuild('ios','development')">Dev</button>
            <button class="btn btn-sm" onclick="startBuild('ios','preview')">Preview</button>
            <button class="btn btn-sm btn-primary" onclick="startBuild('ios','production')">Production</button>
          </div>
        </div>
        <div class="new-build-card">
          <h4>Android</h4>
          <p>Build for Android devices</p>
          <div class="btn-group">
            <button class="btn btn-sm" onclick="startBuild('android','development')">Dev</button>
            <button class="btn btn-sm" onclick="startBuild('android','preview')">Preview</button>
            <button class="btn btn-sm btn-primary" onclick="startBuild('android','production')">Production</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">
      <h3>Recent Builds</h3>
      <button class="btn btn-sm" onclick="loadBuilds()">Refresh</button>
    </div>
    <div class="card-body">
      <div id="builds-list">
        <div class="loading"><span class="spinner"></span> Loading builds...</div>
      </div>
    </div>
  </div>
</div>

<!-- ============== OTA Updates Tab ============== -->
<div class="tab-content" id="tab-ota">

  <!-- Info / Explainer Card -->
  <div class="card">
    <div class="card-header"><h3>About OTA Updates</h3></div>
    <div class="card-body">
      <p style="margin:0 0 12px">Push JavaScript-layer changes directly to your users without a store build. Updates download silently and apply on the next app launch.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="padding:12px;border-radius:8px;background:var(--bg-tertiary)">
          <strong style="color:var(--green)">Works with OTA</strong>
          <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:var(--text-secondary)">
            <li>Custom modules &amp; screens</li>
            <li>Styling &amp; theme changes</li>
            <li>Config changes</li>
            <li>Images &amp; assets</li>
            <li>Bug fixes in JS/TS code</li>
          </ul>
        </div>
        <div style="padding:12px;border-radius:8px;background:var(--bg-tertiary)">
          <strong style="color:var(--yellow)">Requires Store Build</strong>
          <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:var(--text-secondary)">
            <li>New native modules</li>
            <li>Permission changes</li>
            <li>Expo SDK upgrades</li>
            <li>Native config in app.json</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- Push Update Card -->
  <div class="card">
    <div class="card-header"><h3>Push Update</h3></div>
    <div class="card-body">
      <div id="ota-push-banner" style="display:none"></div>
      <div class="field-group" style="margin-bottom:16px">
        <div class="field">
          <label>Channel</label>
          <select id="ota-channel">
            <option value="production">Production</option>
            <option value="preview">Preview</option>
          </select>
        </div>
        <div class="field">
          <label>Platform</label>
          <select id="ota-platform">
            <option value="all">All (iOS + Android)</option>
            <option value="ios">iOS only</option>
            <option value="android">Android only</option>
          </select>
        </div>
      </div>
      <div class="field-group single" style="margin-bottom:16px">
        <div class="field">
          <label>Message <span class="file-hint">(describes what changed)</span></label>
          <textarea id="ota-message" rows="2" placeholder="e.g. Fixed login button color, updated welcome screen" style="resize:vertical"></textarea>
        </div>
      </div>
      <button class="btn btn-primary" id="ota-push-btn" onclick="pushOTA()">Push Update</button>
      <p style="margin:12px 0 0;font-size:12px;color:var(--text-muted)">This pushes your current JS code to all users on the selected channel. Changes take effect on their next app launch.</p>
    </div>
  </div>

  <!-- Update History Card -->
  <div class="card">
    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
      <h3>Update History</h3>
      <button class="btn btn-sm" onclick="loadOTAHistory()">Refresh</button>
    </div>
    <div class="card-body" id="ota-history-body">
      <div class="loading"><span class="spinner"></span> Loading updates...</div>
    </div>
  </div>
</div>

<!-- ============== Updates Tab ============== -->
<div class="tab-content" id="tab-updates">
  <!-- License Section -->
  <div class="card">
    <div class="card-header"><h3>License</h3></div>
    <div class="card-body">
      <div class="license-row" id="license-section">
        <div class="license-input-group">
          <input type="text" id="license-key" class="input" placeholder="Enter your license key (e.g. TBC-XXXX-XXXX-XXXX)" spellcheck="false">
          <button class="btn btn-primary" id="license-activate-btn" onclick="activateLicense()">Activate</button>
          <button class="btn btn-danger-subtle" id="license-remove-btn" onclick="removeLicense()" style="display:none">Remove</button>
        </div>
        <div id="license-status" class="license-status"></div>
      </div>
    </div>
  </div>

  <!-- Version Info -->
  <div class="card">
    <div class="card-body" style="padding:12px 16px">
      <div class="version-info-bar">
        <div class="version-info-item">
          <span class="version-info-label">Core</span>
          <span class="version-info-value core" id="core-version-display">—</span>
        </div>
        <div class="version-info-item">
          <span class="version-info-label">App</span>
          <span class="version-info-value app" id="app-version-display">—</span>
        </div>
        <span class="version-info-hint">Core = update engine &middot; App = your App Store version</span>
      </div>
    </div>
  </div>

  <!-- Core Updates Section -->
  <div class="card">
    <div class="card-header">
      <h3>Core Updates</h3>
      <button class="btn btn-sm" onclick="checkForUpdates()" id="check-updates-btn">Check Now</button>
    </div>
    <div class="card-body">
      <div id="update-status" class="update-status">
        <p style="color:var(--text-secondary)">Enter your license key to check for updates.</p>
      </div>
    </div>
  </div>

  <!-- Manual Update Section -->
  <div class="card">
    <div class="card-header"><h3>Manual Update</h3></div>
    <div class="card-body">
      <p class="hint-text">Upload a core update package (.tar.gz) to apply it manually. Useful for testing or offline updates.</p>
      <div class="upload-zone" id="manual-update-zone">
        <input type="file" id="manual-update-file" accept=".tar.gz,.tgz" style="display:none" onchange="handleManualUpload(this)">
        <div class="upload-prompt" onclick="document.getElementById('manual-update-file').click()">
          <span class="upload-icon">&#x1F4E6;</span>
          <span>Drop a <strong>.tar.gz</strong> update file here or <strong>click to browse</strong></span>
        </div>
      </div>
      <div id="manual-update-status" style="display:none"></div>
    </div>
  </div>

  <!-- Backups Section -->
  <div class="card">
    <div class="card-header">
      <h3>Backups</h3>
      <button class="btn btn-sm" onclick="loadBackups()">Refresh</button>
    </div>
    <div class="card-body">
      <div id="backups-list">
        <p style="color:var(--text-secondary)">Loading backups...</p>
      </div>
    </div>
  </div>
</div>

<!-- ============== Status Tab ============== -->
<div class="tab-content" id="tab-status">
  <div class="card">
    <div class="card-header"><h3>Validation Checks</h3><span id="validation-summary" class="badge" style="color:var(--text-muted)"></span></div>
    <div class="card-body"><ul class="check-list" id="check-list"></ul></div>
  </div>
  <div class="card">
    <div class="card-header"><h3>Site Connectivity</h3></div>
    <div class="card-body">
      <div class="connectivity-grid" id="connectivity-grid">
        <p style="color:var(--text-secondary);font-size:13px">Click "Check Connectivity" to test your site URL and API endpoints.</p>
      </div>
      <div class="btn-group"><button class="btn" id="connectivity-btn" onclick="checkConnectivity()">Check Connectivity</button></div>
    </div>
  </div>
  <div class="btn-group"><button class="btn" onclick="loadState()">Re-check All</button></div>
</div>

<script>
// ==========================================================================
// Dashboard JavaScript
// ==========================================================================

let state = null;
let originalValues = {};
let lastDerived = {};
let dirty = false;
const CONFIG_FIELDS = ['appName', 'slug', 'scheme', 'version', 'iosBundleId', 'androidPackage',
  'siteUrl', 'stagingUrl', 'easOwner', 'easProjectId', 'appNameConfig', 'userAgent',
  'appleId', 'ascAppId', 'packageName', 'appToken'];
const PLACEHOLDERS = ${JSON.stringify(PLACEHOLDERS)};

// ---------------------------------------------------------------------------
// Field help — shown expanded when empty, collapsed with ? when filled
// ---------------------------------------------------------------------------
const FIELD_HELP = {
  appName: {
    text: 'The display name users see on their home screen and in app stores. Keep it short (under 30 chars for app stores).',
    rebuild: true,
  },
  slug: {
    text: 'A URL-safe identifier used by Expo for your project. Auto-derived from app name — usually no need to edit manually.',
    rebuild: true,
  },
  scheme: {
    text: 'The deep link scheme (e.g. <code>mycommunity://</code>). Used for push notification taps and external links that open the app. Auto-derived from slug.',
    rebuild: true,
  },
  version: {
    text: 'App version (semver). Use the bump buttons or type directly. Saves to all 4 places: <code>app.json</code> version + buildNumber + versionCode, and <code>package.json</code> version.',
    rebuild: true,
  },
  iosBundleId: {
    text: 'Your iOS bundle identifier (e.g. <code>com.yourcompany.community</code>). Must match what you register in Apple Developer Portal. Cannot be changed after your first App Store submission.',
    link: 'https://developer.apple.com/account/resources/identifiers/list',
    linkLabel: 'Apple Developer Portal',
    rebuild: true,
  },
  androidPackage: {
    text: 'Your Android package name. Usually matches iOS bundle ID. Cannot be changed after your first Play Store upload.',
    link: 'https://play.google.com/console',
    linkLabel: 'Google Play Console',
    rebuild: true,
  },
  siteUrl: {
    text: 'Your live WordPress + Fluent Community site URL (<strong>no trailing slash</strong>). Used by all app builds and <code>npm run dev</code>. Must have the <code>tbc-community-app</code> plugin installed.',
    rebuild: true,
  },
  stagingUrl: {
    text: 'Optional staging/test site URL for local development. Run <code>npm run dev:staging</code> to use this URL instead of production. Leave empty if no staging site.',
  },
  easOwner: {
    text: 'Your Expo account username. Use the <strong>Log In to EAS</strong> button above to connect your account — the owner will auto-fill.',
    link: 'https://expo.dev/settings',
    linkLabel: 'Expo Settings',
    rebuild: true,
  },
  easProjectId: {
    text: 'Your EAS project ID (UUID format). Use the <strong>Link Project</strong> button above to create one — it will auto-fill this field.',
    link: 'https://expo.dev',
    linkLabel: 'Expo Dashboard',
    rebuild: true,
  },
  appNameConfig: {
    text: 'The app name used in code (header, notifications, etc.). Auto-synced with the App Name field above.',
  },
  userAgent: {
    text: 'Identifies your app in HTTP requests to your WordPress site. Auto-derived from app name. Format: <code>YourAppName/1.0</code>.',
  },
  appleId: {
    text: 'The Apple ID email you use for App Store Connect — the email that manages your Apple Developer account.',
    link: 'https://appstoreconnect.apple.com',
    linkLabel: 'App Store Connect',
  },
  ascAppId: {
    text: 'Your App Store Connect App ID (numeric). Find it under your app → General → App Information → Apple ID.',
    link: 'https://appstoreconnect.apple.com/apps',
    linkLabel: 'App Store Connect',
  },
  googlePlayTrack: {
    text: 'Which track to submit Android builds to. Use <strong>internal</strong> for testing, <strong>production</strong> for release.',
    link: 'https://play.google.com/console',
    linkLabel: 'Google Play Console',
  },
  packageName: {
    text: 'The npm package name in <code>package.json</code>. Not user-visible — just for repo cleanliness. Auto-derived from slug.',
  },
};

// ---------- Tab switching ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    // Lazy load builds
    if (btn.dataset.tab === 'builds' && !buildsLoaded) loadBuilds();
    if (btn.dataset.tab === 'ota' && !otaLoaded) loadOTATab();
    if (btn.dataset.tab === 'modules' && !modulesLoaded) loadModules();
    if (btn.dataset.tab === 'updates' && !updatesLoaded) loadUpdatesTab();
  });
});

// ---------- Quick Commands (click to copy) ----------
document.querySelectorAll('.cmd-copy').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    navigator.clipboard.writeText(cmd).then(() => {
      const toast = document.getElementById('cmd-toast');
      toast.textContent = 'Copied: ' + cmd;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2000);
    });
  });
});

// ---------- Quick Commands help toggle ----------
document.getElementById('cmd-help-toggle').addEventListener('click', function() {
  const panel = document.getElementById('cmd-help-panel');
  const isCollapsed = panel.classList.contains('collapsed');
  panel.classList.toggle('collapsed', !isCollapsed);
  panel.classList.toggle('expanded', isCollapsed);
});

// Hide dev:staging button if no staging URL configured
function updateStagingCmdVisibility() {
  const stagingBtn = document.getElementById('cmd-dev-staging');
  const stagingInput = document.getElementById('cfg-stagingUrl');
  if (stagingBtn && stagingInput) {
    stagingBtn.style.display = stagingInput.value ? '' : 'none';
  }
}

function initCopyButtons() {
  document.querySelectorAll('.copy-btn[data-copy-from]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var input = document.getElementById(btn.getAttribute('data-copy-from'));
      if (!input || !input.value) return;
      navigator.clipboard.writeText(input.value).then(function() {
        btn.textContent = 'Copied!';
        btn.style.color = 'var(--accent)';
        setTimeout(function() { btn.textContent = 'Copy'; btn.style.color = ''; }, 1500);
      });
    });
  });
}

// ---------- Auto-derive ----------
const deriveMap = {
  appName: (val) => {
    const slug = val.replace(/[^a-zA-Z0-9]/g, '');
    const base = val.replace(/[^a-zA-Z0-9]/g, '');
    return {
      slug,
      scheme: slug.toLowerCase(),
      appNameConfig: val,
      userAgent: base.toLowerCase().endsWith('app') ? base + '/1.0' : base + 'App/1.0',
      packageName: val.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, ''),
      fallbackName: val,
      fallbackSlug: slug.toLowerCase(),
    };
  },
  iosBundleId: (val) => ({ androidPackage: val }),
  siteUrl: (val) => ({ productionUrl: val }),
};

function checkDirty() {
  var hasChanges = false;
  for (var i = 0; i < CONFIG_FIELDS.length; i++) {
    var el = document.getElementById('cfg-' + CONFIG_FIELDS[i]);
    if (el && el.value !== (originalValues[CONFIG_FIELDS[i]] || '')) { hasChanges = true; break; }
  }
  var trackEl = document.getElementById('cfg-googlePlayTrack');
  if (trackEl && trackEl.value !== (originalValues.googlePlayTrack || 'production')) hasChanges = true;
  dirty = hasChanges;
  document.getElementById('save-bar').classList.toggle('dirty', hasChanges);
}

function clearDirty() {
  dirty = false;
  document.getElementById('save-bar').classList.remove('dirty');
}

window.addEventListener('beforeunload', function(e) {
  if (dirty) e.preventDefault();
});

document.querySelectorAll('#tab-config input[data-key]').forEach(input => {
  input.addEventListener('input', () => {
    checkDirty();
    updateFieldHelp(input);
    const key = input.dataset.key;
    if (key === 'stagingUrl') updateStagingCmdVisibility();
    if (deriveMap[key]) {
      const derived = deriveMap[key](input.value);
      for (const [dk, dv] of Object.entries(derived)) {
        const target = document.getElementById('cfg-' + dk);
        if (!target) continue;
        var origDerived = deriveMap[key] ? deriveMap[key](originalValues[key] || '') : {};
        if (!target.value || target.value === lastDerived[dk] || target.value === (origDerived[dk] || '')) {
          target.value = dv;
          lastDerived[dk] = dv;
          updateFieldHelp(target);
        }
      }
    }
  });
});

// Also track select changes
document.querySelectorAll('#tab-config select[data-key]').forEach(sel => {
  sel.addEventListener('change', checkDirty);
});

// ---------- Derived-field lock ----------
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
const UNLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
const DERIVABLE_FIELDS = ['slug', 'scheme', 'appNameConfig', 'userAgent', 'packageName', 'androidPackage'];

function setupFieldLock(input) {
  if (!input || input.closest('.input-lock-wrap')) return; // already wrapped
  const field = input.closest('.field');
  if (!field) return;
  const wrap = document.createElement('div');
  wrap.className = 'input-lock-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lock-btn';
  btn.title = 'Click to edit (auto-derived field)';
  wrap.appendChild(btn);

  function setLocked(locked) {
    input.readOnly = locked;
    if (locked) { input.classList.add('locked'); btn.innerHTML = LOCK_SVG; btn.title = 'Click to edit'; }
    else { input.classList.remove('locked'); btn.innerHTML = UNLOCK_SVG; btn.title = 'Click to lock'; input.focus(); }
  }
  btn.addEventListener('click', () => { setLocked(!input.readOnly); if (!input.readOnly) checkDirty(); });
  // Lock if field has a value
  setLocked(!!input.value);
  input._setLocked = setLocked;
}

function lockDerivedFields() {
  for (const key of DERIVABLE_FIELDS) {
    const el = document.getElementById('cfg-' + key);
    if (el && el.value) setupFieldLock(el);
  }
}

// Re-lock derived targets after auto-fill from source field typing
document.querySelectorAll('#tab-config input[data-key]').forEach(input => {
  const key = input.dataset.key;
  if (deriveMap[key]) {
    input.addEventListener('input', () => {
      // After derive fires, re-lock any derived targets that got updated
      const derived = deriveMap[key](input.value);
      for (const dk of Object.keys(derived)) {
        const target = document.getElementById('cfg-' + dk);
        if (target && target._setLocked && target.value) target._setLocked(true);
      }
    });
  }
});

// ---------- Load state ----------
async function loadState() {
  try {
    const res = await fetch('/api/state');
    state = await res.json();
    populateConfig(state.config);
    populateAssets(state.assets);
    populateFirebase(state.firebase);
    populatePlugins(state.plugins);
    populateChecks(state.validation);
    updateProgress(state.validation);
    populateGooglePlayKey(state.config);
    showDepsBanner(state.dependencies && !state.dependencies.nodeModules);
    clearDirty();
    // Personalize header with app name
    var appName = (state.config.appName || '').trim();
    var isDefault = !appName || PLACEHOLDERS.indexOf(appName) !== -1;
    var headerTitle = document.querySelector('.header h1');
    if (headerTitle) {
      headerTitle.textContent = isDefault ? 'Setup Dashboard' : appName + ' — Setup Dashboard';
    }
    document.title = isDefault ? 'Setup Dashboard' : appName + ' — Setup Dashboard';
  } catch (err) {
    showToast('Failed to load state: ' + err.message, 'error');
  }
}

function populateConfig(config) {
  for (const key of CONFIG_FIELDS) {
    const el = document.getElementById('cfg-' + key);
    if (el) {
      el.value = config[key] || '';
      originalValues[key] = config[key] || '';
      injectFieldHelp(el, key, config[key]);
    }
  }
  // Auto-derive empty fields from their source (reuses deriveMap)
  for (const [sourceKey, deriveFn] of Object.entries(deriveMap)) {
    if (!config[sourceKey]) continue;
    const derived = deriveFn(config[sourceKey]);
    for (const [dk, dv] of Object.entries(derived)) {
      const el = document.getElementById('cfg-' + dk);
      if (el && !el.value) {
        el.value = dv;
        originalValues[dk] = dv;
        injectFieldHelp(el, dk, dv);
      }
    }
  }
  // Google Play track
  const trackEl = document.getElementById('cfg-googlePlayTrack');
  if (trackEl && config.googlePlayTrack) {
    trackEl.value = config.googlePlayTrack;
    originalValues.googlePlayTrack = config.googlePlayTrack;
  }
  injectFieldHelp(trackEl, 'googlePlayTrack', config.googlePlayTrack);
  // Sync version to Builds tab
  syncBuildVersion();
  // Lock auto-derived fields
  lockDerivedFields();
  // Show/hide staging command based on whether staging URL is set
  updateStagingCmdVisibility();
  // Wire up copy buttons (idempotent — safe to call on reload)
  initCopyButtons();
}

/** Inject or update the help element for a field */
function injectFieldHelp(input, key, value) {
  if (!input || !FIELD_HELP[key]) return;
  const field = input.closest('.field');
  if (!field) return;
  const help = FIELD_HELP[key];
  // Find or create help element
  let helpEl = field.querySelector('.field-help');
  let toggleEl = field.querySelector('.help-toggle');
  if (!helpEl) {
    // Create ? toggle in the label
    const label = field.querySelector('label');
    if (label) {
      toggleEl = document.createElement('button');
      toggleEl.className = 'help-toggle';
      toggleEl.type = 'button';
      toggleEl.textContent = '?';
      toggleEl.title = 'Toggle help';
      label.appendChild(toggleEl);
    }
    // Create help div
    helpEl = document.createElement('div');
    helpEl.className = 'field-help';
    let html = help.text;
    if (help.link) html += ' <a href="' + help.link + '" target="_blank">' + (help.linkLabel || 'Open') + ' \u2192</a>';
    helpEl.innerHTML = html;
    field.appendChild(helpEl);
    // Toggle click handler
    if (toggleEl) {
      toggleEl.addEventListener('click', () => {
        const isCollapsed = helpEl.classList.contains('collapsed');
        helpEl.classList.toggle('collapsed', !isCollapsed);
        helpEl.classList.toggle('expanded', isCollapsed);
      });
    }
  }
  // Expand if empty/placeholder, collapse if filled
  const isEmpty = !value || value === '';
  helpEl.classList.toggle('collapsed', !isEmpty);
  helpEl.classList.toggle('expanded', isEmpty);
}

/** Update help visibility and rebuild notice when a field changes */
function updateFieldHelp(input) {
  if (!input) return;
  const key = input.dataset?.key || input.id?.replace('cfg-', '');
  if (!key || !FIELD_HELP[key]) return;
  const field = input.closest('.field');
  if (!field) return;
  const help = FIELD_HELP[key];
  const helpEl = field.querySelector('.field-help');
  if (!helpEl) return;
  const isEmpty = !input.value || input.value.trim() === '';
  helpEl.classList.toggle('collapsed', !isEmpty);
  helpEl.classList.toggle('expanded', isEmpty);
  // Alert for cleared fields that previously had values
  let alertEl = field.querySelector('.field-alert');
  if (isEmpty && originalValues[key]) {
    field.classList.add('has-alert');
    if (!alertEl) {
      alertEl = document.createElement('div');
      alertEl.className = 'field-alert';
      alertEl.textContent = 'This field was cleared — it needs a value before building';
      field.insertBefore(alertEl, helpEl);
    }
  } else {
    field.classList.remove('has-alert');
    if (alertEl) alertEl.remove();
  }
  // Rebuild notice for fields that require a new build
  let rebuildEl = field.querySelector('.rebuild-notice');
  const changed = input.value !== (originalValues[key] || '');
  if (help.rebuild && changed) {
    if (!rebuildEl) {
      rebuildEl = document.createElement('div');
      rebuildEl.className = 'rebuild-notice';
      rebuildEl.textContent = 'Rebuild required after save';
      field.appendChild(rebuildEl);
    }
  } else if (rebuildEl) {
    rebuildEl.remove();
  }
}

function populateGooglePlayKey(config) {
  const status = document.getElementById('google-play-key-status');
  if (config.googlePlayKeyExists) {
    status.innerHTML = '<span class="status-icon status-pass">\\u2705</span> Service account key uploaded';
  } else {
    status.innerHTML = '<span class="status-icon status-fail">\\u274C</span> No service account key — needed for Google Play submissions';
  }
}

function populateAssets(assets) {
  const grid = document.getElementById('asset-grid');
  grid.innerHTML = '';
  for (const asset of assets) {
    const showHelp = !asset.exists;
    const helpHtml = asset.help
      ? '<div class="field-help ' + (showHelp ? 'expanded' : 'collapsed') + '" style="text-align:left;margin-top:8px">' +
          asset.help +
          (asset.link ? ' <a href="' + asset.link + '" target="_blank">' + (asset.linkLabel || 'Guide') + ' \\u2192</a>' : '') +
        '</div>'
      : '';
    const card = document.createElement('div');
    card.className = 'asset-card' + (asset.exists ? '' : ' missing');
    card.innerHTML =
      '<span class="asset-status">' + (asset.exists ? '\\u2705' : '\\u274C') + '</span>' +
      (asset.help ? '<button class="help-toggle" type="button" title="Toggle help" style="position:absolute;top:8px;left:8px">?</button>' : '') +
      (asset.exists
        ? '<img class="asset-thumb" src="/api/asset/' + encodeURIComponent(asset.file) + '?' + Date.now() + '" alt="' + asset.label + '">'
        : '<div class="asset-thumb-placeholder">?</div>') +
      '<div class="asset-name">' + asset.label + '</div>' +
      '<div class="asset-purpose">' + asset.purpose + '</div>' +
      '<div class="asset-size">' + (asset.exists ? asset.sizeKB + ' KB | ' + asset.size : asset.size + ' recommended') + '</div>' +
      helpHtml;
    card.title = 'Click to replace ' + asset.file;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.help-toggle') || e.target.closest('.field-help')) return;
      uploadAsset(asset.file);
    });
    // Wire help toggle
    const toggleBtn = card.querySelector('.help-toggle');
    const helpEl = card.querySelector('.field-help');
    if (toggleBtn && helpEl) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = helpEl.classList.contains('collapsed');
        helpEl.classList.toggle('collapsed', !isCollapsed);
        helpEl.classList.toggle('expanded', isCollapsed);
      });
    }
    grid.appendChild(card);
  }
}

const FIREBASE_HELP = {
  android: {
    label: 'Android (google-services.json)',
    uploadTarget: 'firebase-android',
    accept: '.json',
    text: 'Download from your Firebase project: Project Settings → General → Your Apps → Android app → <code>google-services.json</code>',
    link: 'https://console.firebase.google.com/project/_/settings/general',
    linkLabel: 'Firebase Console',
  },
  ios: {
    label: 'iOS (GoogleService-Info.plist)',
    uploadTarget: 'firebase-ios',
    accept: '.plist',
    text: 'Download from your Firebase project: Project Settings → General → Your Apps → iOS app → <code>GoogleService-Info.plist</code>',
    link: 'https://console.firebase.google.com/project/_/settings/general',
    linkLabel: 'Firebase Console',
  },
};

function populateFirebase(firebase) {
  const section = document.getElementById('firebase-section');
  section.innerHTML = '';
  for (const [key, info] of [['android', firebase.android], ['ios', firebase.ios]]) {
    const help = FIREBASE_HELP[key];
    const div = document.createElement('div');
    const showHelp = !info.exists;
    div.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<span class="status-icon ' + (info.exists ? 'status-pass' : 'status-fail') + '">' + (info.exists ? '\\u2705' : '\\u274C') + '</span>' +
        '<strong style="font-size:14px">' + help.label + '</strong>' +
        '<button class="help-toggle" type="button" title="Toggle help">?</button>' +
      '</div>' +
      (info.exists && info.projectId ? '<div style="font-size:12px;color:var(--text-secondary)">Project: ' + info.projectId + '</div>' : '') +
      '<div class="field-help ' + (showHelp ? 'expanded' : 'collapsed') + '">' +
        help.text + ' <a href="' + help.link + '" target="_blank">' + help.linkLabel + ' \\u2192</a>' +
      '</div>' +
      '<div class="drop-zone" id="drop-' + key + '" style="margin-top:8px">' +
        (info.exists ? 'Drop to replace' : 'Drop file here or click to upload') +
        '<input type="file" accept="' + help.accept + '">' +
      '</div>';
    // Wire up help toggle
    const toggleBtn = div.querySelector('.help-toggle');
    const helpEl = div.querySelector('.field-help');
    toggleBtn.addEventListener('click', () => {
      const isCollapsed = helpEl.classList.contains('collapsed');
      helpEl.classList.toggle('collapsed', !isCollapsed);
      helpEl.classList.toggle('expanded', isCollapsed);
    });
    const dropZone = div.querySelector('.drop-zone');
    const fileInput = div.querySelector('input[type="file"]');
    setupDropZone(dropZone, fileInput, (file) => doUpload(file, help.uploadTarget));
    section.appendChild(div);
  }
}

function populatePlugins(plugins) {
  const coreList = document.getElementById('core-plugins-list');
  const addonList = document.getElementById('addon-plugins-list');
  coreList.innerHTML = '';
  addonList.innerHTML = '';
  for (const plugin of plugins.core) coreList.appendChild(createPluginItem(plugin));
  for (const plugin of plugins.addons) addonList.appendChild(createPluginItem(plugin));
}

function createPluginItem(plugin) {
  const div = document.createElement('div');
  div.className = 'plugin-item';
  div.innerHTML =
    '<span class="status-icon ' + (plugin.exists ? 'status-pass' : 'status-fail') + '">' + (plugin.exists ? '\\u2705' : '\\u274C') + '</span>' +
    '<div class="plugin-info">' +
      '<div class="plugin-name">' + plugin.label + (plugin.required ? ' <span style="color:var(--red);font-size:11px">(required)</span>' : '') + '</div>' +
      '<div class="plugin-desc">' + plugin.description + '</div>' +
    '</div>' +
    (plugin.exists ? '<span class="plugin-version">v' + plugin.version + '</span>' : '<span style="font-size:12px;color:var(--text-muted)">Not bundled</span>');
  return div;
}

function populateChecks(validation) {
  const list = document.getElementById('check-list');
  list.innerHTML = '';
  const categories = {};
  for (const check of validation.checks) {
    if (!categories[check.category]) categories[check.category] = [];
    categories[check.category].push(check);
  }
  for (const [cat, checks] of Object.entries(categories)) {
    const header = document.createElement('li');
    header.style.cssText = 'padding:8px 0 4px;font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;border-bottom:none';
    header.textContent = cat;
    list.appendChild(header);
    for (const check of checks) {
      const li = document.createElement('li');
      li.className = 'check-item';
      const icon = check.pass === 'pass' ? '\\u2705' : check.pass === 'warn' ? '\\u26A0\\uFE0F' : '\\u274C';
      const cls = check.pass === 'pass' ? 'status-pass' : check.pass === 'warn' ? 'status-warn' : 'status-fail';
      li.innerHTML = '<span class="status-icon ' + cls + '">' + icon + '</span><span>' + check.label + '</span>' +
        (check.ref ? '<span class="ref">#' + check.ref + '</span>' : '');
      list.appendChild(li);
    }
  }
  document.getElementById('validation-summary').textContent = validation.pass + ' pass / ' + validation.fail + ' fail / ' + validation.warn + ' warn';
}

function updateProgress(validation) {
  const total = validation.pass + validation.fail + validation.warn;
  const badge = document.getElementById('progress-badge');
  if (validation.fail === 0 && validation.warn === 0) {
    badge.textContent = total + '/' + total + ' checks passing';
    badge.className = 'progress-badge good';
  } else if (validation.fail === 0) {
    badge.textContent = validation.pass + ' passing, ' + validation.warn + ' warning' + (validation.warn !== 1 ? 's' : '');
    badge.className = 'progress-badge partial';
  } else {
    badge.textContent = validation.pass + '/' + total + ' checks passing';
    badge.className = 'progress-badge ' + (validation.fail <= 3 ? 'partial' : 'bad');
  }
}

// ---------- Save config ----------
async function saveConfig() {
  const changes = {};
  for (const key of CONFIG_FIELDS) {
    const el = document.getElementById('cfg-' + key);
    if (el && el.value !== originalValues[key]) changes[key] = el.value;
  }
  // Google Play track
  const trackEl = document.getElementById('cfg-googlePlayTrack');
  if (trackEl && trackEl.value !== (originalValues.googlePlayTrack || 'production')) {
    changes.googlePlayTrack = trackEl.value;
  }
  // Sync derived values
  if (changes.siteUrl !== undefined) changes.productionUrl = changes.siteUrl;
  if (changes.appName !== undefined) changes.fallbackName = changes.appName;
  if (changes.slug !== undefined) changes.fallbackSlug = changes.slug.toLowerCase();

  const hasConfigChanges = Object.keys(changes).length > 0;

  if (!hasConfigChanges) { showToast('No changes to save', 'error'); return; }
  const results = [];
  try {
    const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
    const data = await res.json();
    if (data.ok) results.push(...data.results);
    else { showToast('Save failed: ' + JSON.stringify(data), 'error'); return; }
    showToast('Saved: ' + results.join(', '), 'success');
    clearDirty();
    await loadState();
  } catch (err) { showToast('Save error: ' + err.message, 'error'); }
}

// ---------- Version bump ----------
function bumpVersion(type) {
  const el = document.getElementById('cfg-version');
  if (!el) return;
  const current = el.value || '1.0.0';
  const parts = current.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    showToast('Invalid version format. Use semver (e.g. 1.0.0)', 'error');
    return;
  }
  if (type === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
  else if (type === 'minor') { parts[1]++; parts[2] = 0; }
  else { parts[2]++; }
  el.value = parts.join('.');
  checkDirty();
  syncBuildVersion();
}

function syncBuildVersion() {
  const configEl = document.getElementById('cfg-version');
  const buildEl = document.getElementById('build-version');
  const saveBtn = document.getElementById('build-version-save');
  if (configEl && buildEl) {
    buildEl.value = configEl.value;
    const changed = configEl.value !== originalValues.version;
    buildEl.classList.toggle('bumped', changed);
    if (saveBtn) saveBtn.style.display = changed ? 'inline-flex' : 'none';
  }
  // Update build banners
  var blockers = getChecksByStatus('fail');
  updateBannerList('build-blockers-banner', 'build-blockers-list', blockers);
  updateBannerList('build-warnings-banner', 'build-warnings-list', getChecksByStatus('warn'));
  // Disable/enable build buttons based on blockers
  var buildBtns = document.querySelectorAll('.new-build-card .btn');
  var hasBlockers = blockers.length > 0;
  for (var i = 0; i < buildBtns.length; i++) {
    buildBtns[i].disabled = hasBlockers;
    buildBtns[i].style.opacity = hasBlockers ? '0.5' : '';
    buildBtns[i].style.pointerEvents = hasBlockers ? 'none' : '';
  }
}

async function saveVersionFromBuild() {
  const el = document.getElementById('cfg-version');
  if (!el || el.value === originalValues.version) return;
  const changes = { version: el.value };
  try {
    const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
    const data = await res.json();
    if (data.ok) {
      showToast('Version bumped to ' + el.value, 'success');
      await loadState();
    } else showToast('Save failed', 'error');
  } catch (err) { showToast('Save error: ' + err.message, 'error'); }
}

// ---------- File uploads ----------
function uploadAsset(filename) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.addEventListener('change', async () => {
    if (!input.files.length) return;
    const formData = new FormData();
    formData.append('file', input.files[0], filename);
    try {
      const res = await fetch('/api/upload/asset', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) { showToast(filename + ' replaced', 'success'); loadState(); }
      else showToast('Upload failed: ' + data.error, 'error');
    } catch (err) { showToast('Upload error: ' + err.message, 'error'); }
  });
  input.click();
}

function setupDropZone(dropZone, fileInput, onFile) {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) await onFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length) await onFile(fileInput.files[0]);
  });
}

async function doUpload(file, uploadTarget) {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/upload/' + uploadTarget, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.ok) { showToast(file.name + ' uploaded', 'success'); loadState(); }
    else showToast('Upload failed: ' + data.error, 'error');
  } catch (err) { showToast('Upload error: ' + err.message, 'error'); }
}

// Setup Google Play key drop zone
(function() {
  const dropZone = document.getElementById('drop-google-play-key');
  const fileInput = document.getElementById('google-play-key-input');
  setupDropZone(dropZone, fileInput, (file) => doUpload(file, 'google-play-key'));
})();

// ---------- Connectivity ----------
async function checkConnectivity() {
  const grid = document.getElementById('connectivity-grid');
  const btn = document.getElementById('connectivity-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Testing...';
  grid.innerHTML = '<p style="color:var(--text-secondary)"><span class="spinner"></span> Checking endpoints...</p>';
  try {
    const res = await fetch('/api/connectivity');
    const data = await res.json();
    if (data.error) { grid.innerHTML = '<p style="color:var(--red)">' + data.error + '</p>'; return; }
    grid.innerHTML = '';
    for (const [key, info] of Object.entries(data)) {
      const row = document.createElement('div');
      row.className = 'connectivity-row';
      row.innerHTML =
        '<span class="status-icon ' + (info.ok ? 'status-pass' : 'status-fail') + '">' + (info.ok ? '\\u2705' : '\\u274C') + '</span>' +
        '<span class="connectivity-label">' + info.label + '</span>' +
        '<span class="connectivity-url">' + info.url + '</span>' +
        '<span class="connectivity-status ' + (info.ok ? 'status-pass' : 'status-fail') + '">' + (info.ok ? info.status : (info.error || 'Failed')) + '</span>';
      grid.appendChild(row);
    }
  } catch (err) {
    grid.innerHTML = '<p style="color:var(--red)">Error: ' + err.message + '</p>';
  } finally {
    btn.disabled = false; btn.textContent = 'Check Connectivity';
  }
}

// ---------- Builds ----------
let buildsLoaded = false;
let allBuilds = [];
let buildSubmissions = {};
const BUILDS_PAGE_SIZE = 10;
let buildsShown = 0;

function normStatus(build) {
  return (build.status || '').toLowerCase().replace(/_/g, '-');
}

function isIosBuild(build) {
  return (build.platform || '').toUpperCase() === 'IOS';
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getBuildPageUrl(build) {
  if (build.buildDetailsPageUrl) return build.buildDetailsPageUrl;
  if (build.project && build.project.ownerAccount && build.project.slug && build.id) {
    return 'https://expo.dev/accounts/' + build.project.ownerAccount.name + '/projects/' + build.project.slug + '/builds/' + build.id;
  }
  return '';
}

function getSubmitButton(buildId, isIos) {
  var submission = buildSubmissions[buildId];
  if (submission && submission.ok) return '';
  var configured, store, configHint;
  if (isIos) {
    configured = state && state.config.appleId && state.config.ascAppId;
    store = 'App Store';
    configHint = 'Set Apple ID and ASC App ID in Config tab first';
  } else {
    configured = state && state.config.googlePlayKeyExists;
    store = 'Google Play';
    configHint = 'Upload Google Play service account key in Config tab first';
  }
  return configured
    ? '<button class="btn btn-sm btn-success" onclick="submitToStore(\\x27' + (isIos ? 'ios' : 'android') + '\\x27,\\x27' + buildId + '\\x27)">Submit to ' + store + '</button>'
    : '<button class="btn btn-sm" disabled title="' + configHint + '">Submit (not configured)</button>';
}

function getBuildActions(build) {
  var buildId = build.id || '';
  var isIos = isIosBuild(build);
  var version = build.appVersion || build.version || '?';
  var profile = build.buildProfile || build.profile || '';
  var isInternal = (build.distribution || '').toUpperCase() === 'INTERNAL' || profile === 'development' || profile === 'preview';
  var status = normStatus(build);
  var buildPageUrl = getBuildPageUrl(build);
  var btns = [];

  if (status === 'new' || status === 'in-progress') {
    btns.push('<button class="btn btn-sm btn-danger-subtle" onclick="cancelEasBuild(\\x27' + buildId + '\\x27)">Cancel</button>');
  }
  if (status === 'finished') {
    if (isInternal && buildPageUrl) {
      var platformLabel = isIos ? 'iOS' : 'Android';
      btns.push('<button class="btn btn-sm btn-primary" onclick="showInstallQR(\\x27' + buildPageUrl + '\\x27,\\x27' + platformLabel + '\\x27,\\x27' + version + '\\x27,\\x27' + profile + '\\x27)">\\uD83D\\uDCF2 Install</button>');
    }
    if (build.artifacts && build.artifacts.buildUrl) {
      btns.push('<a class="btn btn-sm" href="' + build.artifacts.buildUrl + '" target="_blank" rel="noopener">' + (isIos ? 'Download .ipa' : 'Download .aab') + '</a>');
    }
    if (!isInternal) btns.push(getSubmitButton(buildId, isIos));
  }
  if (buildPageUrl) {
    btns.push('<a class="btn btn-sm" href="' + buildPageUrl + '" target="_blank" rel="noopener">View on EAS</a>');
  }
  return btns.join('');
}

function getBuildLog(build) {
  var buildId = build.id || '';
  var isIos = isIosBuild(build);
  var status = normStatus(build);
  var lines = [];

  if (status === 'new') {
    lines.push('<div class="build-log">Queued · ' + formatDate(build.createdAt) + '</div>');
  } else if (status === 'in-progress') {
    lines.push('<div class="build-log">Building · started ' + formatDate(build.createdAt) + '</div>');
  } else if (status === 'finished') {
    var duration = '';
    if (build.createdAt && build.updatedAt) {
      var mins = Math.round((new Date(build.updatedAt) - new Date(build.createdAt)) / 60000);
      if (mins > 0 && mins < 120) duration = ' · ' + mins + ' min';
    }
    lines.push('<div class="build-log build-log-ok">Built · ' + formatDate(build.createdAt) + duration + '</div>');
  } else if (status === 'errored') {
    lines.push('<div class="build-log build-log-fail">Build failed · ' + formatDate(build.createdAt) + '</div>');
  } else if (status === 'canceled') {
    lines.push('<div class="build-log">Cancelled · ' + formatDate(build.createdAt) + '</div>');
  }

  var submission = buildSubmissions[buildId];
  if (submission) {
    var store = isIos ? 'App Store' : 'Google Play';
    if (submission.ok) {
      lines.push('<div class="build-log build-log-ok">Sent to ' + store + ' · ' + formatDate(submission.date) + '</div>');
    } else {
      var errorText = submission.error && submission.error !== 'Exit code 1' ? ' — ' + submission.error : '';
      lines.push('<div class="build-log build-log-fail">' + store + ' failed · ' + formatDate(submission.date) + errorText + '</div>');
    }
  }

  return lines.join('');
}

function renderBuildCard(build) {
  var card = document.createElement('div');
  card.className = 'build-card';
  var buildId = build.id || '';
  card.setAttribute('data-build-id', buildId);
  var isIos = isIosBuild(build);
  var platformIcon = isIos ? '\\uD83C\\uDF4F' : '\\uD83E\\uDD16';
  var platformLabel = isIos ? 'iOS' : 'Android';
  var status = normStatus(build);
  var version = build.appVersion || build.version || '?';
  var profile = build.buildProfile || build.profile || '';

  card.innerHTML =
    '<div class="build-platform">' + platformIcon + '</div>' +
    '<div class="build-info">' +
      '<div class="build-version">' + platformLabel + ' v' + version + (profile ? ' (' + profile + ')' : '') + '</div>' +
      '<div class="build-id">' + buildId.substring(0, 12) + '</div>' +
      getBuildLog(build) +
    '</div>' +
    '<span class="build-status ' + status + '">' + status.replace(/-/g, ' ') + '</span>' +
    '<div class="build-actions">' + getBuildActions(build) + '</div>';
  return card;
}

function showMoreBuilds() {
  const list = document.getElementById('builds-list');
  const showMoreBtn = document.getElementById('builds-show-more');
  const end = Math.min(buildsShown + BUILDS_PAGE_SIZE, allBuilds.length);
  for (let i = buildsShown; i < end; i++) {
    list.insertBefore(renderBuildCard(allBuilds[i]), showMoreBtn);
  }
  buildsShown = end;
  if (buildsShown >= allBuilds.length) {
    showMoreBtn.style.display = 'none';
  } else {
    showMoreBtn.style.display = 'block';
    showMoreBtn.querySelector('span').textContent = 'Show More (' + (allBuilds.length - buildsShown) + ' older)';
  }
}

async function loadBuilds() {
  const list = document.getElementById('builds-list');
  list.innerHTML = '<div class="loading"><span class="spinner"></span> Loading builds from EAS...</div>';
  try {
    const [res, subRes] = await Promise.all([fetch('/api/builds'), fetch('/api/builds/submissions')]);
    const data = await res.json();
    try { const subData = await subRes.json(); buildSubmissions = subData.submissions || {}; } catch { buildSubmissions = {}; }
    buildsLoaded = true;
    if (!data.ok) {
      list.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">' +
        '<p style="color:var(--yellow);margin-bottom:8px">' + data.error + '</p>' +
        '<p style="font-size:13px">Make sure EAS CLI is installed and you are logged in:</p>' +
        '<pre style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius);margin-top:8px;font-size:13px">' +
        'npm install -g eas-cli\\neas login\\neas init</pre></div>';
      return;
    }
    if (!data.builds || data.builds.length === 0) {
      list.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">No builds yet. Use the buttons above to start your first build.</div>';
      return;
    }
    allBuilds = data.builds;
    buildsShown = 0;
    list.innerHTML = '';

    // "Show More" button placeholder (inserted at end, cards go before it)
    const showMoreBtn = document.createElement('div');
    showMoreBtn.id = 'builds-show-more';
    showMoreBtn.style.cssText = 'text-align:center;padding:12px;display:none';
    showMoreBtn.innerHTML = '<button class="btn btn-sm" onclick="showMoreBuilds()"><span></span></button>';
    list.appendChild(showMoreBtn);

    // Render first page
    showMoreBuilds();

    // Update queued banner based on active build status
    var queuedBanner = document.getElementById('build-queued-banner');
    if (queuedBanner.style.display === 'block') {
      var hasActive = allBuilds.some(function(b) {
        var s = normStatus(b);
        return s === 'new' || s === 'in-progress';
      });
      if (hasActive) {
        // Build appeared — switch to queued state with average wait time
        var avg = getAverageWaitTime();
        var waitText = avg ? 'Average build time: ~' + avg + ' min.' : 'Builds typically take 10–20 minutes.';
        document.getElementById('build-queued-text').textContent = '\u23F3 Build is queued';
        document.getElementById('build-queued-hint').textContent = waitText + ' Check back and hit Refresh.';
      } else {
        // No active builds — dismiss banner
        queuedBanner.style.display = 'none';
      }
    }
  } catch (err) {
    list.innerHTML = '<div style="padding:16px;color:var(--red)">Error loading builds: ' + err.message + '</div>';
  }
}

function getChecksByStatus(status) {
  if (!state || !state.validation) return [];
  return state.validation.checks
    .filter(function(c) { return c.pass === status; })
    .map(function(c) { return c.label; });
}

function updateBannerList(bannerId, listId, items) {
  var banner = document.getElementById(bannerId);
  var list = document.getElementById(listId);
  if (banner && list) {
    if (items.length > 0) {
      list.innerHTML = items.map(function(i) { return '<li>' + i + '</li>'; }).join('');
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }
}

function getAverageWaitTime() {
  var durations = allBuilds.filter(function(b) {
    return normStatus(b) === 'finished' && b.createdAt && b.updatedAt;
  }).map(function(b) {
    return (new Date(b.updatedAt) - new Date(b.createdAt)) / 60000;
  }).filter(function(d) { return d > 0 && d < 120; });
  if (durations.length === 0) return null;
  var avg = Math.round(durations.reduce(function(a, b) { return a + b; }, 0) / durations.length);
  return avg;
}

async function startBuild(platform, profile) {
  var blockers = getChecksByStatus('fail');
  if (blockers.length > 0) {
    alert('Cannot build — fix these issues first:\\n\\n' + blockers.map(function(b) { return '  ✗ ' + b; }).join('\\n') + '\\n\\nGo to the Config tab to resolve them.');
    return;
  }
  if (!confirm('Start a ' + profile + ' build for ' + platform + '?\\n\\nThis will queue a build on EAS servers.')) return;
  showToast('Starting ' + platform + ' ' + profile + ' build...', 'info');
  try {
    const res = await fetch('/api/builds/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, profile }),
    });
    const data = await res.json();
    if (data.ok) {
      var platformLabel = platform === 'ios' ? 'iOS' : 'Android';
      document.getElementById('build-queued-text').textContent = '\u2713 ' + platformLabel + ' ' + profile + ' build started';
      document.getElementById('build-queued-hint').textContent = 'It may take a minute to appear. Hit Refresh to check.';
      document.getElementById('build-queued-banner').style.display = 'block';
    } else {
      showToast('Build failed: ' + data.error, 'error');
    }
  } catch (err) { showToast('Build error: ' + err.message, 'error'); }
}

async function submitToStore(platform, buildId) {
  const storeName = platform === 'ios' ? 'App Store' : 'Google Play';
  if (!confirm('Submit build to ' + storeName + '?\\n\\nBuild ID: ' + buildId)) return;
  showToast('Submitting to ' + storeName + '...', 'info');
  try {
    const res = await fetch('/api/builds/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, buildId }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('Submitted to ' + storeName + ' successfully!', 'success');
      buildSubmissions[buildId] = { platform, date: new Date().toISOString(), ok: true };
    } else {
      showToast('Submit failed: ' + data.error, 'error');
      buildSubmissions[buildId] = { platform, date: new Date().toISOString(), ok: false, error: data.error };
    }
    // Re-render just the affected card
    var oldCard = document.querySelector('[data-build-id="' + buildId + '"]');
    if (oldCard) {
      var build = allBuilds.find(function(b) { return b.id === buildId; });
      if (build) oldCard.replaceWith(renderBuildCard(build));
    }
  } catch (err) { showToast('Submit error: ' + err.message, 'error'); }
}

async function cancelEasBuild(buildId) {
  if (!confirm('Cancel this build?')) return;
  showToast('Cancelling build...', 'info');
  try {
    const res = await fetch('/api/builds/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildId }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('Build cancelled', 'success');
      loadBuilds();
    } else {
      showToast('Cancel failed: ' + data.error, 'error');
    }
  } catch (err) { showToast('Cancel error: ' + err.message, 'error'); }
}

// ---------- Modules ----------
let modulesLoaded = false;

async function loadModules() {
  const list = document.getElementById('modules-list');
  list.innerHTML = '<div class="loading"><span class="spinner"></span> Loading modules...</div>';
  try {
    const res = await fetch('/api/modules');
    const data = await res.json();
    modulesLoaded = true;
    if (!data.ok || !data.modules || data.modules.length === 0) {
      list.innerHTML = '<div style="padding:16px;color:var(--text-secondary)">No modules installed. Drop a module package above to install one.</div>';
      return;
    }
    list.innerHTML = '';
    for (const mod of data.modules) {
      const card = document.createElement('div');
      card.className = 'build-card';
      card.style.flexWrap = 'wrap';

      const statusColor = mod.active ? 'status-pass' : 'status-warn';
      const statusIcon = mod.active ? '\\u2705' : '\\u26D4';
      const statusLabel = mod.active ? 'Active' : 'Inactive';

      let companionHtml = '';
      if (mod.companionPlugin) {
        const cpIcon = mod.companionExists ? '\\u2705' : '\\u274C';
        companionHtml = '<div style="font-size:11px;color:var(--text-muted)">Plugin: ' + mod.companionPlugin + ' ' + cpIcon + '</div>';
      }

      let actionsHtml = '';
      if (mod.active) {
        actionsHtml += '<button class="btn btn-sm" onclick="toggleMod(\\'' + mod.id + '\\', false)">Deactivate</button>';
      } else {
        actionsHtml += '<button class="btn btn-sm btn-primary" onclick="toggleMod(\\'' + mod.id + '\\', true)">Activate</button>';
      }
      actionsHtml += '<a class="btn btn-sm" href="/api/modules/export/' + mod.id + '" download>Export</a>';
      actionsHtml += '<button class="btn btn-sm btn-danger-subtle" onclick="removeMod(\\'' + mod.id + '\\', \\'' + mod.name + '\\')">Remove</button>';

      const authorHtml = mod.author
        ? '<span style="font-size:11px;color:var(--text-muted)">' +
            (mod.authorUrl ? '<a href="' + mod.authorUrl + '" target="_blank" style="color:var(--accent);text-decoration:none">' + mod.author + '</a>' : mod.author) +
          '</span>'
        : '';
      const licenseHtml = mod.license ? '<span style="font-size:11px;color:var(--text-muted)">' + mod.license + '</span>' : '';

      card.innerHTML =
        '<div class="build-platform" style="font-size:22px">\\uD83E\\uDDE9</div>' +
        '<div class="build-info">' +
          '<div class="build-version">' + mod.name + ' <span style="font-size:12px;color:var(--text-muted)">v' + (mod.version || '?') + '</span></div>' +
          '<div class="build-meta">' + (mod.description || mod.folder) + '</div>' +
          '<div style="display:flex;gap:12px;align-items:center;margin-top:2px;flex-wrap:wrap">' +
            authorHtml +
            licenseHtml +
            '<div class="build-id">' + mod.fileCount + ' files</div>' +
            (mod.hasTab ? '<div style="font-size:11px;color:var(--text-muted)">Has tab</div>' : '') +
            companionHtml +
          '</div>' +
        '</div>' +
        '<span class="build-status ' + (mod.active ? 'finished' : 'canceled') + '">' + statusLabel + '</span>' +
        '<div class="build-actions">' + actionsHtml + '</div>';
      list.appendChild(card);
    }
  } catch (err) {
    list.innerHTML = '<div style="padding:16px;color:var(--red)">Error loading modules: ' + err.message + '</div>';
  }
}

async function toggleMod(moduleId, active) {
  try {
    const res = await fetch('/api/modules/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId, active }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(data.message, 'success');
      loadModules();
    } else {
      showToast('Failed: ' + data.error, 'error');
    }
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function removeMod(moduleId, moduleName) {
  if (!confirm('Remove ' + moduleName + '?\\n\\nThis will delete the module folder and remove it from the registry. This cannot be undone.')) return;
  try {
    const res = await fetch('/api/modules/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(data.message, 'success');
      loadModules();
    } else {
      showToast('Failed: ' + data.error, 'error');
    }
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

async function importModuleFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  showToast('Installing module...', 'info');
  try {
    const res = await fetch('/api/modules/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.ok) {
      showToast(data.message, 'success');
      loadModules();
    } else {
      showToast('Import failed: ' + data.error, 'error');
    }
  } catch (err) { showToast('Import error: ' + err.message, 'error'); }
}

// Setup module import drop zone
setupDropZone(
  document.getElementById('drop-module-import'),
  document.getElementById('module-import-input'),
  importModuleFile
);

// ---------- HTML Escape ----------
function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

// ---------- Toast ----------
function showToast(msg, type) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ---------- Install QR Modal ----------
function showInstallQR(url, platform, version, profile) {
  var existing = document.querySelector('.qr-modal-backdrop');
  if (existing) existing.remove();

  var qrHtml = '';
  try {
    if (typeof qrcode === 'function') {
      var qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      qrHtml = qr.createSvgTag(5, 0);
    } else {
      qrHtml = '<div style="padding:16px;color:var(--text-muted);font-size:12px">QR code unavailable (library not loaded)</div>';
    }
  } catch (e) {
    qrHtml = '<div style="padding:16px;color:var(--text-muted);font-size:12px">QR code unavailable</div>';
  }

  var backdrop = document.createElement('div');
  backdrop.className = 'qr-modal-backdrop';
  backdrop.onclick = function(e) { if (e.target === backdrop) backdrop.remove(); };

  var modal = document.createElement('div');
  modal.className = 'qr-modal';
  var safeUrl = url.replace(/'/g, "\\'");
  modal.innerHTML =
    '<button class="qr-modal-close" onclick="this.closest(\\x27.qr-modal-backdrop\\x27).remove()">&times;</button>' +
    '<h3>' + platform + ' Install</h3>' +
    '<div class="qr-build-info">v' + version + (profile ? ' (' + profile + ')' : '') + '</div>' +
    '<div class="qr-code-container">' + qrHtml + '</div>' +
    '<hr class="qr-divider">' +
    '<div class="qr-link-row">' +
      '<input class="qr-link-input" type="text" value="' + url + '" readonly onclick="this.select()">' +
      '<button class="btn btn-sm" onclick="copyInstallLink(this, \\x27' + safeUrl + '\\x27)">Copy</button>' +
    '</div>' +
    '<div class="qr-hint">Scan with your device camera or copy the link and open it on a mobile device.</div>';

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

function copyInstallLink(btn, url) {
  navigator.clipboard.writeText(url).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  }).catch(function() {
    var input = btn.parentElement.querySelector('.qr-link-input');
    input.select();
    document.execCommand('copy');
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  });
}

// ---------- EAS Setup ----------
async function easCheckStatus() {
  var dot = document.getElementById('eas-status-dot');
  var text = document.getElementById('eas-status-text');
  var installBtn = document.getElementById('eas-install-btn');
  var loginBtn = document.getElementById('eas-login-btn');
  var logoutBtn = document.getElementById('eas-logout-btn');
  var initBtn = document.getElementById('eas-init-btn');
  text.textContent = 'Checking EAS status...';
  dot.style.background = 'var(--text-muted)';
  try {
    var res = await fetch('/api/eas/status');
    var data = await res.json();
    var installedTag = '<span style="display:inline-block;background:rgba(63,185,80,0.15);color:var(--green);font-size:11px;font-weight:600;padding:1px 8px;border-radius:10px;margin-left:6px">Installed</span>';
    if (!data.installed) {
      dot.style.background = 'var(--red)';
      text.innerHTML = 'EAS CLI not installed';
      installBtn.style.display = '';
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'none';
      initBtn.style.display = 'none';
    } else if (!data.loggedIn) {
      dot.style.background = 'var(--yellow)';
      text.innerHTML = 'EAS CLI v' + data.version + installedTag + ' — not logged in';
      installBtn.style.display = 'none';
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
      initBtn.style.display = 'none';
    } else {
      dot.style.background = 'var(--green)';
      text.innerHTML = 'EAS CLI v' + data.version + installedTag + ' — logged in as ' + data.user;
      installBtn.style.display = 'none';
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
      // Show Link Project button if owner/projectId not set
      var ownerField = document.getElementById('cfg-easOwner');
      var pidField = document.getElementById('cfg-easProjectId');
      var needsInit = PLACEHOLDERS.indexOf(ownerField.value) !== -1 || !ownerField.value || PLACEHOLDERS.indexOf(pidField.value) !== -1 || !pidField.value;
      initBtn.style.display = needsInit ? '' : 'none';
      // Auto-fill owner from EAS user if still placeholder
      if (!ownerField.value || PLACEHOLDERS.indexOf(ownerField.value) !== -1) {
        ownerField.value = data.user;
        ownerField.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  } catch (err) {
    dot.style.background = 'var(--red)';
    text.textContent = 'Could not check EAS status';
  }
}

async function easInstallCli() {
  var btn = document.getElementById('eas-install-btn');
  btn.disabled = true;
  btn.textContent = 'Installing...';
  try {
    var res = await fetch('/api/eas/install-cli', { method: 'POST' });
    var data = await res.json();
    if (data.ok) {
      showToast('EAS CLI installed successfully', 'success');
      easCheckStatus();
    } else {
      showToast('Install failed: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Install error: ' + err.message, 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Install EAS CLI';
}

var _easLoginPoll = null; // guard against stacking intervals
async function easLogin() {
  if (_easLoginPoll) { clearInterval(_easLoginPoll); _easLoginPoll = null; }
  var btn = document.getElementById('eas-login-btn');
  btn.disabled = true;
  btn.textContent = 'Opening browser...';
  try {
    var res = await fetch('/api/eas/login', { method: 'POST' });
    var data = await res.json();
    if (data.ok) {
      showToast(data.message, 'success');
      btn.textContent = 'Waiting for login...';
      // Poll for login completion every 3s for up to 2 minutes
      var attempts = 0;
      _easLoginPoll = setInterval(async function() {
        var poll = _easLoginPoll;
        attempts++;
        try {
          var check = await fetch('/api/eas/status');
          var status = await check.json();
          if (status.loggedIn) {
            clearInterval(poll);
            showToast('Logged in as ' + status.user, 'success');
            easCheckStatus();
          } else if (attempts >= 40) {
            clearInterval(poll);
            btn.disabled = false;
            btn.textContent = 'Log In to EAS';
          }
        } catch (e) {
          clearInterval(poll);
          btn.disabled = false;
          btn.textContent = 'Log In to EAS';
        }
      }, 3000);
    } else {
      showToast('Login failed: ' + data.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Log In to EAS';
    }
  } catch (err) {
    showToast('Login error: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Log In to EAS';
  }
}

async function easLogout() {
  var btn = document.getElementById('eas-logout-btn');
  btn.disabled = true;
  btn.textContent = 'Logging out...';
  try {
    var res = await fetch('/api/eas/logout', { method: 'POST' });
    var data = await res.json();
    if (data.ok) {
      showToast('Logged out of EAS', 'success');
      easCheckStatus();
    } else {
      showToast('Logout failed: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Logout error: ' + err.message, 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Log Out';
}

async function easInit() {
  var btn = document.getElementById('eas-init-btn');
  btn.disabled = true;
  btn.textContent = 'Linking...';
  try {
    var res = await fetch('/api/eas/init', { method: 'POST' });
    var data = await res.json();
    if (data.ok) {
      showToast('Project linked to EAS!', 'success');
      // Auto-fill the fields
      var ownerField = document.getElementById('cfg-easOwner');
      var pidField = document.getElementById('cfg-easProjectId');
      if (data.owner) {
        ownerField.value = data.owner;
        ownerField.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (data.projectId) {
        pidField.value = data.projectId;
        pidField.dispatchEvent(new Event('input', { bubbles: true }));
      }
      easCheckStatus();
    } else {
      showToast('Link failed: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Link error: ' + err.message, 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Link Project';
}

// ---------- Install Dependencies ----------
var depsPolling = null;

function showDepsBanner(show) {
  var banner = document.getElementById('deps-banner');
  if (banner) banner.style.display = show ? 'block' : 'none';
}

async function installDeps() {
  var btn = document.getElementById('deps-install-btn');
  var progress = document.getElementById('deps-progress');
  var statusText = document.getElementById('deps-status-text');
  var output = document.getElementById('deps-output');

  btn.disabled = true;
  btn.textContent = 'Installing...';
  progress.style.display = 'block';
  output.textContent = '';
  statusText.textContent = 'Installing dependencies... this may take a few minutes';

  try {
    var res = await fetch('/api/install-deps', { method: 'POST' });
    var data = await res.json();
    if (!data.ok) {
      showToast('Install failed: ' + data.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Install Dependencies';
      progress.style.display = 'none';
      return;
    }
    depsPolling = setInterval(pollInstallStatus, 2000);
  } catch (err) {
    showToast('Install error: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Install Dependencies';
    progress.style.display = 'none';
  }
}

async function pollInstallStatus() {
  try {
    var res = await fetch('/api/install-deps/status');
    var data = await res.json();
    var output = document.getElementById('deps-output');
    var statusText = document.getElementById('deps-status-text');

    // Show last 80 lines of output
    var lines = data.output.split('\\n');
    output.textContent = lines.slice(-80).join('\\n');
    output.scrollTop = output.scrollHeight;

    if (data.status === 'done') {
      clearInterval(depsPolling);
      depsPolling = null;
      statusText.textContent = 'Dependencies installed successfully!';
      showToast('Dependencies installed successfully!', 'success');
      await loadState();
    } else if (data.status === 'error') {
      clearInterval(depsPolling);
      depsPolling = null;
      statusText.textContent = 'Installation failed (exit code ' + data.exitCode + ')';
      showToast('npm install failed — check output below', 'error');
      var btn = document.getElementById('deps-install-btn');
      btn.disabled = false;
      btn.textContent = 'Retry Install';
    }
  } catch (err) {
    clearInterval(depsPolling);
    depsPolling = null;
    showToast('Lost connection to dashboard', 'error');
  }
}

// ---------- OTA Updates ----------
let otaLoaded = false;

async function loadOTATab() {
  otaLoaded = true;
  await Promise.all([loadOTAChannels(), loadOTAHistory()]);
}

async function loadOTAChannels() {
  try {
    const res = await fetch('/api/ota/status');
    const data = await res.json();
    if (!data.ok || !data.channels) return;

    // Show warning if no builds have been made yet (channels not on EAS)
    var banner = document.getElementById('ota-push-banner');
    if (!data.hasBuilt) {
      banner.style.display = 'block';
      banner.className = 'ota-banner warning';
      banner.innerHTML = '<strong>No store builds yet.</strong> OTA updates require at least one build with channels configured. Push a build from the Builds tab first, then you can push OTA updates here.';
      document.getElementById('ota-push-btn').disabled = true;
    }

    // Populate channel dropdown from eas.json config
    var sel = document.getElementById('ota-channel');
    sel.innerHTML = '';
    Object.entries(data.channels).forEach(function(entry) {
      var profile = entry[0], channel = entry[1];
      if (channel && profile !== 'simulator') {
        var opt = document.createElement('option');
        opt.value = channel;
        opt.textContent = channel.charAt(0).toUpperCase() + channel.slice(1);
        if (channel === 'production') opt.selected = true;
        sel.appendChild(opt);
      }
    });
  } catch (_) {}
}

async function loadOTAHistory() {
  const el = document.getElementById('ota-history-body');
  el.innerHTML = '<div class="loading"><span class="spinner"></span> Loading updates...</div>';
  try {
    const res = await fetch('/api/ota/history');
    const data = await res.json();
    if (!data.ok) {
      // "Branch name may not be empty" means no updates have been pushed yet
      var errMsg = data.error || '';
      if (errMsg.toLowerCase().includes('branch') || errMsg.toLowerCase().includes('update:list')) {
        el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px 0">No OTA updates yet. Push your first update above.</p>';
      } else {
        el.innerHTML = '<div class="ota-banner error">' + esc(errMsg || 'Failed to load history') + '</div>';
      }
      return;
    }

    const raw = data.updates?.currentPage || data.updates;
    const items = Array.isArray(raw) ? raw : [];
    if (items.length === 0) {
      el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px 0">No OTA updates yet. Push your first update above.</p>';
      return;
    }

    let html = '<div style="display:grid;gap:8px">';
    items.forEach(group => {
      const id = group.group || group.id || '?';
      const rawMsg = group.message || '(no message)';
      // eas update:list pre-formats message as: "msg" (age by actor) — extract just the message
      const msgMatch = rawMsg.match(/^"(.+?)"\\s*\\(/);
      const msg = msgMatch ? msgMatch[1] : rawMsg.replace(/^"|"$/g, '');
      const branch = group.branch || group.channel || '?';
      const runtime = group.runtimeVersion || '';
      const platforms = typeof group.platforms === 'string' ? group.platforms : (Array.isArray(group.platforms) ? group.platforms.join(', ') : group.platform || '?');
      const date = group.createdAt || group.updatedAt || '';
      const dateStr = date ? formatDate(date) : '?';

      html += '<div style="padding:12px;border-radius:8px;background:var(--bg-tertiary);display:flex;justify-content:space-between;align-items:flex-start;gap:12px">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:600;margin-bottom:4px">' + esc(msg) + '</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:var(--text-muted)">';
      html += '<span style="background:var(--accent);color:#fff;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:500">' + esc(branch) + '</span>';
      if (runtime) html += '<span style="background:var(--bg-primary);padding:1px 8px;border-radius:10px;font-size:11px;border:1px solid var(--border)">v' + esc(runtime) + '</span>';
      html += '<span>' + esc(platforms) + '</span>';
      html += '<span>' + esc(dateStr) + '</span>';
      html += '</div>';
      html += '</div>';
      html += '<button class="btn btn-sm btn-danger-subtle" onclick="deleteOTA(&quot;' + esc(id) + '&quot;)">Delete</button>';
      html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = '<div class="ota-banner error">Failed to load history: ' + esc(err.message) + '</div>';
  }
}

async function pushOTA() {
  const channel = document.getElementById('ota-channel').value;
  const platform = document.getElementById('ota-platform').value;
  const message = document.getElementById('ota-message').value.trim();
  const banner = document.getElementById('ota-push-banner');
  const btn = document.getElementById('ota-push-btn');

  if (!message) { showToast('Please enter a message describing what changed', 'error'); return; }
  if (!confirm('Push an OTA update to the "' + channel + '" channel (' + platform + ')?\\n\\nThis will immediately push your current code to all users on this channel.')) return;

  btn.disabled = true;
  btn.textContent = 'Pushing...';
  banner.style.display = 'block';
  banner.className = 'ota-banner info';
  banner.innerHTML = '<span class="spinner"></span> Pushing OTA update... This may take 30-60 seconds.';

  try {
    const res = await fetch('/api/ota/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, message, platform }),
    });
    const data = await res.json();
    if (data.ok) {
      banner.className = 'ota-banner success';
      var detail = '';
      if (data.runtimeVersion) detail += ' targeting v' + esc(data.runtimeVersion);
      if (data.platforms && data.platforms.length) detail += ' on ' + esc(data.platforms.join(' + '));
      banner.innerHTML = '<strong>OTA update pushed!</strong>' + detail + '. Users will receive it on their next app launch.';
      document.getElementById('ota-message').value = '';
      loadOTAHistory();
    } else {
      banner.className = 'ota-banner error';
      banner.textContent = 'Push failed: ' + (data.error || 'Unknown error');
    }
  } catch (err) {
    banner.className = 'ota-banner error';
    banner.textContent = 'Push failed: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Push Update';
  }
}

async function deleteOTA(groupId) {
  if (!confirm('Delete this OTA update group?\\n\\nUsers who already downloaded it will not be affected, but new users will not receive it.')) return;
  try {
    const res = await fetch('/api/ota/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('Update deleted', 'success');
      loadOTAHistory();
    } else {
      showToast('Delete failed: ' + (data.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// ---------- Updates Tab ----------
let updatesLoaded = false;

async function loadUpdatesTab() {
  updatesLoaded = true;
  // Show versions from the last loaded state
  var coreEl = document.getElementById('core-version-display');
  var appEl = document.getElementById('app-version-display');
  if (state && state.config) {
    if (coreEl) coreEl.textContent = 'v' + (state.config.coreVersion || '?');
    if (appEl) appEl.textContent = 'v' + (state.config.version || '?');
  }
  const [licenseData] = await Promise.all([loadLicenseStatus(), loadBackups()]);
  // Auto-show update status from license check (avoids second API call)
  if (licenseData && licenseData.valid && licenseData.latest) {
    showUpdateStatus(licenseData);
  }
}

async function loadLicenseStatus() {
  const statusEl = document.getElementById('license-status');
  const keyInput = document.getElementById('license-key');
  const activateBtn = document.getElementById('license-activate-btn');
  const removeBtn = document.getElementById('license-remove-btn');

  statusEl.className = 'license-status checking';
  statusEl.textContent = 'Checking license...';

  try {
    const res = await fetch('/api/updates/license');
    const data = await res.json();

    if (!data.hasLicense) {
      statusEl.className = 'license-status';
      statusEl.textContent = '';
      keyInput.value = '';
      keyInput.style.display = '';
      activateBtn.style.display = '';
      removeBtn.style.display = 'none';
      return data;
    }

    keyInput.value = data.key || '';
    keyInput.style.display = 'none';
    activateBtn.style.display = 'none';
    removeBtn.style.display = '';

    if (data.valid) {
      const expiry = data.expiresAt ? ' · Expires ' + data.expiresAt : '';
      const plan = data.plan ? ' · ' + data.plan + ' plan' : '';
      statusEl.className = 'license-status valid';
      statusEl.innerHTML = '&#10003; Licensed' + plan + expiry;
    } else {
      statusEl.className = 'license-status invalid';
      statusEl.textContent = data.error || 'License is not valid';
    }
    return data;
  } catch (err) {
    statusEl.className = 'license-status invalid';
    statusEl.textContent = 'Could not check license: ' + err.message;
    return null;
  }
}

async function activateLicense() {
  const keyInput = document.getElementById('license-key');
  const key = keyInput.value.trim();
  if (!key) { showToast('Enter a license key', 'error'); return; }

  const statusEl = document.getElementById('license-status');
  statusEl.className = 'license-status checking';
  statusEl.textContent = 'Activating...';

  try {
    const res = await fetch('/api/updates/license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();

    if (data.valid) {
      showToast('License activated!', 'success');
      await loadLicenseStatus();
      checkForUpdates();
    } else {
      statusEl.className = 'license-status invalid';
      statusEl.textContent = data.error || 'Invalid license key';
    }
  } catch (err) {
    statusEl.className = 'license-status invalid';
    statusEl.textContent = 'Activation failed: ' + err.message;
  }
}

async function removeLicense() {
  if (!confirm('Remove your license key? You can re-enter it later.')) return;
  try {
    await fetch('/api/updates/license', { method: 'DELETE' });
    showToast('License removed', 'success');
    document.getElementById('update-status').innerHTML = '<p style="color:var(--text-secondary)">Enter your license key to check for updates.</p>';
    await loadLicenseStatus();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

function showUpdateStatus(data) {
  const statusEl = document.getElementById('update-status');
  if (!data.valid) {
    statusEl.innerHTML = '<div class="update-result error"><strong>License Error:</strong> ' + (data.error || 'Invalid license') + '</div>';
    return;
  }
  if (!data.latest) {
    statusEl.innerHTML = '<div class="update-up-to-date">&#10003; You are on the latest version (v' + (data.currentVersion || '?') + ')</div>';
    return;
  }
  const latest = data.latest;
  let html = '<div class="update-available">';
  html += '<h4>Update Available: v' + latest.version + '</h4>';
  html += '<div class="update-meta">Released ' + (latest.date || 'recently');
  if (latest.size) html += ' · ' + (latest.size / 1024 / 1024).toFixed(1) + ' MB';
  html += ' · Current: v' + (data.currentVersion || '?') + '</div>';
  if (latest.changelog) {
    html += '<div class="update-changelog">' + sanitizeHtml(latest.changelog) + '</div>';
  }
  html += '<div class="update-actions">';
  html += '<button class="btn btn-primary" onclick="applyLicenseUpdate(\\'' + escapeHtml(latest.downloadUrl) + '\\', \\'' + escapeHtml(latest.version) + '\\')">Backup &amp; Update to v' + escapeHtml(latest.version) + '</button>';
  html += '</div></div>';
  statusEl.innerHTML = html;
}

async function checkForUpdates() {
  const statusEl = document.getElementById('update-status');
  const checkBtn = document.getElementById('check-updates-btn');
  checkBtn.disabled = true;
  checkBtn.textContent = 'Checking...';
  statusEl.innerHTML = '<p style="color:var(--text-secondary)">Checking for updates...</p>';

  try {
    const res = await fetch('/api/updates/check');
    const data = await res.json();

    if (!data.hasLicense && data.hasLicense !== undefined) {
      statusEl.innerHTML = '<p style="color:var(--text-secondary)">Enter your license key to check for updates.</p>';
    } else {
      showUpdateStatus(data);
    }
  } catch (err) {
    statusEl.innerHTML = '<div class="update-result error">Error checking for updates: ' + err.message + '</div>';
  }

  checkBtn.disabled = false;
  checkBtn.textContent = 'Check Now';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizeHtml(str) {
  if (!str) return '';
  return String(str).replace(/<\\/?([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>/g, function(tag, name) {
    var allowed = ['h3','h4','ul','ol','li','p','strong','em','code','br'];
    return allowed.indexOf(name.toLowerCase()) !== -1 ? tag : escapeHtml(tag);
  });
}

async function applyLicenseUpdate(downloadUrl, version) {
  if (!confirm('This will:\\n\\n1. Backup your current project\\n2. Download v' + version + '\\n3. Apply the update\\n\\nProtected (NOT overwritten):\\n  • Config (config.ts, app.json, eas.json, package.json)\\n  • Assets (icons, splash screens)\\n  • Modules\\n  • Firebase configs\\n\\nOverwritten:\\n  • All other source files (components, screens, services, etc.)\\n\\nIf you\\'ve edited core source files, those changes will be lost.\\nA full backup is created first — you can restore if needed.\\n\\nProceed?')) return;

  const statusEl = document.getElementById('update-status');
  statusEl.innerHTML = '<div class="update-progress">' +
    '<div class="step active" id="update-step-backup">Backing up current project...</div>' +
    '<div class="step" id="update-step-download">Downloading update...</div>' +
    '<div class="step" id="update-step-apply">Applying update...</div>' +
    '</div>';

  try {
    // The server handles backup + download + apply in one call
    document.getElementById('update-step-backup').className = 'step active';
    const res = await fetch('/api/updates/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadUrl })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    document.getElementById('update-step-backup').className = 'step done';
    document.getElementById('update-step-backup').textContent = '\\u2713 Backed up (saved as ' + data.backup + ')';
    document.getElementById('update-step-download').className = 'step done';
    document.getElementById('update-step-download').textContent = '\\u2713 Downloaded';
    document.getElementById('update-step-apply').className = 'step done';
    document.getElementById('update-step-apply').textContent = '\\u2713 Applied (' + data.filesWritten + ' files updated, config preserved)';

    let resultHtml = '<div class="update-result success">';
    resultHtml += '<strong>Update applied successfully!</strong>';
    if (data.depsChanged) resultHtml += '<br><br>&#x26A0; Dependencies changed. Run <code>npm install</code> to update them.';
    resultHtml += '</div>';
    statusEl.innerHTML += resultHtml;

    await loadBackups();

    if (data.dashboardUpdated) {
      showDashboardRestartNotice(statusEl);
    }
  } catch (err) {
    statusEl.innerHTML += '<div class="update-result error"><strong>Update failed:</strong> ' + err.message + '<br><br>Your backup is safe. Use the Backups section below to restore if needed.</div>';
  }
}

// Manual upload
function setupManualUploadZone() {
  const zone = document.getElementById('manual-update-zone');
  if (!zone) return;
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) uploadManualUpdate(file);
  });
}

function handleManualUpload(input) {
  if (input.files[0]) uploadManualUpdate(input.files[0]);
  input.value = '';
}

async function uploadManualUpdate(file) {
  const statusEl = document.getElementById('manual-update-status');
  const zone = document.getElementById('manual-update-zone');

  if (!file.name.endsWith('.tar.gz') && !file.name.endsWith('.tgz')) {
    showToast('Please upload a .tar.gz file', 'error');
    return;
  }

  if (!confirm('Apply update from "' + file.name + '"?\\n\\nCore source files will be overwritten. Config, assets, and modules are preserved.\\nIf you\\'ve edited core files, those changes will be lost.\\nA backup is created first — you can restore if needed.')) return;

  zone.style.display = 'none';
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div class="update-progress">' +
    '<div class="step active">Uploading and applying ' + escapeHtml(file.name) + '...</div>' +
    '</div>';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/updates/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    let html = '<div class="update-result success">';
    html += '<strong>Update applied successfully!</strong><br>';
    html += data.filesWritten + ' files updated, config preserved.<br>';
    html += 'Backup saved as: ' + data.backup;
    if (data.newVersion) html += '<br>Updated to version ' + data.newVersion;
    if (data.depsChanged) html += '<br><br>&#x26A0; Dependencies changed. Run <code>npm install</code> to update them.';
    html += '</div>';

    statusEl.innerHTML = html;
    showToast('Update applied!', 'success');
    await loadBackups();

    if (data.dashboardUpdated) {
      showDashboardRestartNotice(statusEl);
    }
  } catch (err) {
    statusEl.innerHTML = '<div class="update-result error"><strong>Upload failed:</strong> ' + err.message + '</div>';
    zone.style.display = '';
  }
}

// Prompt user to restart dashboard after self-update
function showDashboardRestartNotice(statusEl) {
  statusEl.innerHTML += '<div class="update-result" style="margin-top:12px;">' +
    '<strong>&#x26A0; Dashboard updated.</strong><br>' +
    'Stop the server, close this tab, then run <code>npm run dashboard</code> again.<br><br>' +
    '<button onclick="fetch(\\'/api/shutdown\\',{method:\\'POST\\'}).then(function(){document.title=\\'Stopped — safe to close\\';})' +
    '.catch(function(){})" style="padding:6px 16px;border-radius:6px;border:1px solid var(--border-color,#e2e8f0);' +
    'background:var(--card-bg,#fff);cursor:pointer;font-size:13px;">Stop Server</button>' +
    '</div>';
}

// Backups
async function loadBackups() {
  const listEl = document.getElementById('backups-list');
  try {
    const res = await fetch('/api/updates/backups');
    const data = await res.json();
    const backups = data.backups || [];

    if (backups.length === 0) {
      listEl.innerHTML = '<p class="no-backups">No backups yet. A backup is created automatically before each update.</p>';
      return;
    }

    let html = '';
    for (const b of backups) {
      html += '<div class="backup-card">';
      html += '<div class="backup-info">';
      html += '<div class="backup-version">v' + escapeHtml(b.version) + '</div>';
      html += '<div class="backup-meta">' + escapeHtml(b.date) + ' · ' + b.sizeMB + ' MB</div>';
      html += '</div>';
      html += '<div class="backup-actions">';
      html += '<button class="btn btn-sm" onclick="restoreBackup(\\'' + escapeHtml(b.id) + '\\', \\'' + escapeHtml(b.version) + '\\')">Restore</button>';
      html += '<button class="btn btn-sm btn-danger-subtle" onclick="deleteOneBackup(\\'' + escapeHtml(b.id) + '\\')">Delete</button>';
      html += '</div></div>';
    }
    listEl.innerHTML = html;
  } catch (err) {
    listEl.innerHTML = '<p style="color:var(--red)">Error loading backups: ' + err.message + '</p>';
  }
}

async function restoreBackup(backupId, version) {
  if (!confirm('Restore your project to v' + version + '?\\n\\nThis will overwrite current files with the backup. Your current state is NOT backed up first — if you want to save it, create a backup manually before restoring.')) return;

  try {
    const res = await fetch('/api/updates/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast('Restored to v' + version, 'success');
    await loadState();
  } catch (err) {
    showToast('Restore failed: ' + err.message, 'error');
  }
}

async function deleteOneBackup(backupId) {
  if (!confirm('Delete this backup? This cannot be undone.')) return;
  try {
    await fetch('/api/updates/backups/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId })
    });
    showToast('Backup deleted', 'success');
    await loadBackups();
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ---------- Theme Toggle ----------
function toggleTheme() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  if (next === 'dark') html.setAttribute('data-theme', 'dark');
  else html.removeAttribute('data-theme');
  localStorage.setItem('dashboard-theme', next);
  document.getElementById('theme-toggle').innerHTML = next === 'dark' ? '\\u263E' : '\\u2600';
}
// Set initial icon
(function(){ var t = document.documentElement.getAttribute('data-theme'); document.getElementById('theme-toggle').innerHTML = t === 'dark' ? '\\u263E' : '\\u2600'; })();

// ---------- Init ----------
setupManualUploadZone();
loadState().then(function() { easCheckStatus(); });

// Heartbeat — connection status + auto-shutdown when browser closes
function updateStatus(connected) {
  var dot = document.getElementById('status-dot');
  var label = document.getElementById('status-label');
  var status = document.getElementById('server-status');
  if (!dot) return;
  if (connected) {
    dot.className = 'status-dot connected';
    label.textContent = 'Connected';
    status.title = 'Server connected';
    document.getElementById('stop-server-btn').style.display = '';
  } else {
    dot.className = 'status-dot disconnected';
    label.textContent = 'Server stopped — run: npm run dashboard';
    status.title = 'Server stopped — restart with: npm run dashboard';
    document.getElementById('stop-server-btn').style.display = 'none';
  }
}

setInterval(function() {
  fetch('/api/heartbeat').then(function(r) {
    updateStatus(r.ok);
  }).catch(function() {
    updateStatus(false);
  });
}, 10000);

function stopServer() {
  if (!confirm('Stop the dashboard server?')) return;
  fetch('/api/shutdown', { method: 'POST' }).catch(function() {});
  updateStatus(false);
  document.getElementById('stop-server-btn').disabled = true;
}
</script>
</body>
</html>`;
}
