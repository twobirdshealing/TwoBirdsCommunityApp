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
  { folder: 'tbc-community-app', label: 'TBC Community App', required: true, description: 'Main bridge plugin — REST endpoints, auth, push notifications' },
  { folder: 'tbc-fluent-profiles', label: 'TBC Fluent Profiles', required: true, description: 'Custom profile fields, OTP verification, registration' },
  { folder: 'tbc-multi-reactions', label: 'TBC Multi Reactions', required: false, description: 'Multi-reaction support for Fluent Community' },
  { folder: 'tbc-starter-theme', label: 'TBC Starter Theme', required: false, description: 'Custom WordPress theme' },
];

const ADDON_PLUGINS = [
  { folder: 'tbc-youtube', label: 'TBC YouTube', description: 'YouTube channel integration (companion to youtube module)' },
  { folder: 'tbc-book-club', label: 'TBC Book Club', description: 'Book club with audiobook player (companion to bookclub module)' },
];

// ---------------------------------------------------------------------------
// Feature flag keys (single source of truth — used by reader + writer)
// ---------------------------------------------------------------------------

const BOOL_FLAGS = ['DARK_MODE', 'PUSH_NOTIFICATIONS', 'MESSAGING', 'COURSES', 'CART', 'MULTI_REACTIONS'];
const PROFILE_TAB_KEYS = ['POSTS', 'SPACES', 'COMMENTS'];

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
  for (const key of Object.keys(profiles)) {
    if (profiles[key].env?.SITE_URL) return profiles[key].env.SITE_URL;
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
    // Feature flags
    state.features = {};
    for (const flag of BOOL_FLAGS) {
      const m = content.match(new RegExp(flag + ':\\s*(true|false)'));
      if (m) state.features[flag] = m[1] === 'true';
    }
    // Nested PROFILE_TABS
    state.features.PROFILE_TABS = {};
    for (const sub of PROFILE_TAB_KEYS) {
      const m = content.match(new RegExp('PROFILE_TABS:[\\s\\S]*?' + sub + ':\\s*(true|false)'));
      if (m) state.features.PROFILE_TABS[sub] = m[1] === 'true';
    }
  }

  // --- app.config.ts ---
  if (fileExists(PATHS.appConfigTs)) {
    const content = fs.readFileSync(PATHS.appConfigTs, 'utf8');
    state.config.fallbackSiteUrl = extractTsValue(content, /process\.env\.SITE_URL \|\| '([^']*)'/);
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
    lockfile: fileExists(path.join(PROJECT_DIR, 'package-lock.json')) ? 'package-lock.json'
      : fileExists(path.join(PROJECT_DIR, 'yarn.lock')) ? 'yarn.lock'
      : fileExists(path.join(PROJECT_DIR, 'pnpm-lock.yaml')) ? 'pnpm-lock.yaml'
      : null,
  };

  // --- Validation ---
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

  const PLACEHOLDERS = ['MyCommunityApp', 'mycommunityapp', 'My Community', 'com.yourcompany.communityapp',
    'CommunityApp/1.0', 'your-eas-owner', 'your-eas-project-id', 'your@apple.id', '0000000000',
    'your-community-site.com', 'https://your-community-site.com', 'my-community-app'];

  function isPlaceholder(val) {
    if (!val) return true;
    return PLACEHOLDERS.some(p => val === p);
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
  check(!isPlaceholder(c.siteUrl), 'SITE_URL is set', 'eas.json', 'site-url');
  checkWarn(isPlaceholder(c.appleId), 'Apple ID not set (needed for iOS submit)', 'eas.json', 'apple-submit');
  checkWarn(isPlaceholder(c.ascAppId), 'ASC App ID not set (needed for iOS submit)', 'eas.json', 'apple-submit');

  // config.ts
  check(!isPlaceholder(c.appNameConfig), 'APP_NAME is set in config.ts', 'config.ts', 'config-ts');
  check(!isPlaceholder(c.userAgent), 'APP_USER_AGENT is set', 'config.ts', 'config-ts');

  // app.config.ts
  check(!isPlaceholder(c.fallbackSiteUrl), 'Fallback SITE_URL is set', 'app.config.ts', 'site-url');

  // Consistency
  if (c.appName && c.appNameConfig && c.appName !== c.appNameConfig) {
    checks.push({ pass: 'warn', label: `App name mismatch: app.json="${c.appName}" vs config.ts="${c.appNameConfig}"`, category: 'consistency', ref: 'config-ts' });
  }
  if (c.siteUrl && c.fallbackSiteUrl && c.siteUrl !== c.fallbackSiteUrl) {
    checks.push({ pass: 'warn', label: `SITE_URL mismatch: eas.json="${c.siteUrl}" vs app.config.ts="${c.fallbackSiteUrl}"`, category: 'consistency', ref: 'site-url' });
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

  // Plugins
  for (const plugin of state.plugins.core) {
    if (plugin.required) {
      check(plugin.exists, `${plugin.label} plugin installed`, 'plugins', 'plugins');
    }
  }

  // Dependencies
  check(state.dependencies.nodeModules, 'node_modules exists (npm install done)', 'dependencies', 'quick-start');
  checkWarn(!state.dependencies.lockfile, 'No lockfile found', 'dependencies', 'quick-start');

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
  if (changes.siteUrl !== undefined || changes.appleId !== undefined || changes.ascAppId !== undefined ||
      changes.googlePlayTrack !== undefined || changes.googlePlayServiceAccountKeyPath !== undefined) {
    const easJson = readJsonSafe(PATHS.easJson);
    if (easJson) {
      if (changes.siteUrl !== undefined) {
        const profiles = easJson.build || {};
        for (const key of Object.keys(profiles)) {
          if (!profiles[key].env) profiles[key].env = {};
          profiles[key].env.SITE_URL = changes.siteUrl;
        }
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
  if (changes.appNameConfig !== undefined || changes.userAgent !== undefined) {
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
  if (changes.fallbackSiteUrl !== undefined || changes.fallbackName !== undefined || changes.fallbackSlug !== undefined) {
    let content = fs.readFileSync(PATHS.appConfigTs, 'utf8');
    if (changes.fallbackSiteUrl !== undefined) {
      content = content.replace(/process\.env\.SITE_URL \|\| '[^']*'/, `process.env.SITE_URL || '${changes.fallbackSiteUrl}'`);
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
  if (changes.packageName !== undefined || changes.version !== undefined) {
    const pkgJson = readJsonSafe(PATHS.packageJson);
    if (pkgJson) {
      if (changes.packageName !== undefined) pkgJson.name = changes.packageName;
      if (changes.version !== undefined) pkgJson.version = changes.version;
      fs.writeFileSync(PATHS.packageJson, JSON.stringify(pkgJson, null, 2) + '\n');
      results.push('package.json updated');
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Feature Flag Writer
// ---------------------------------------------------------------------------

function writeFeatureFlags(changes) {
  if (!fileExists(PATHS.configTs)) return ['constants/config.ts not found'];
  let content = fs.readFileSync(PATHS.configTs, 'utf8');
  let changed = false;

  // Top-level boolean flags
  for (const flag of BOOL_FLAGS) {
    if (changes[flag] !== undefined) {
      const val = changes[flag] === true || changes[flag] === 'true' ? 'true' : 'false';
      content = content.replace(new RegExp('(' + flag + ':\\s*)(true|false)'), '$1' + val);
      changed = true;
    }
  }

  // Nested PROFILE_TABS flags
  if (changes.PROFILE_TABS) {
    for (const sub of PROFILE_TAB_KEYS) {
      if (changes.PROFILE_TABS[sub] !== undefined) {
        const val = changes.PROFILE_TABS[sub] === true || changes.PROFILE_TABS[sub] === 'true' ? 'true' : 'false';
        // Match within the PROFILE_TABS block
        content = content.replace(
          new RegExp('(PROFILE_TABS:\\s*\\{[\\s\\S]*?' + sub + ':\\s*)(true|false)'),
          '$1' + val
        );
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(PATHS.configTs, content);
    return ['Feature flags updated in constants/config.ts'];
  }
  return ['No feature flag changes'];
}

// ---------------------------------------------------------------------------
// Connectivity Checker
// ---------------------------------------------------------------------------

async function checkConnectivity(siteUrl) {
  if (!siteUrl) return { error: 'No SITE_URL configured' };
  const results = {};
  const endpoints = [
    { key: 'site', url: siteUrl, label: 'Site root' },
    { key: 'wpRest', url: `${siteUrl}/wp-json/`, label: 'WP REST API' },
    { key: 'fluentApi', url: `${siteUrl}/wp-json/fluent-community/v2`, label: 'Fluent Community API' },
    { key: 'tbcCa', url: `${siteUrl}/wp-json/tbc-ca/v1`, label: 'TBC Community App plugin' },
    { key: 'tbcFp', url: `${siteUrl}/wp-json/tbc-fp/v1`, label: 'TBC Fluent Profiles plugin' },
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

/** Run a command asynchronously (doesn't block the server) */
function runCommand(args, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
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
    const output = await runCommand(['eas', 'build:list', '--json', '--limit', '20', '--non-interactive'], 30000);
    return { ok: true, builds: JSON.parse(output) };
  } catch (err) {
    // Quick diagnostics (short timeouts)
    try { await runCommand(['eas', '--version'], 5000); }
    catch { return { ok: false, error: 'EAS CLI not installed. Run: npm install -g eas-cli' }; }
    try { await runCommand(['eas', 'whoami'], 5000); }
    catch { return { ok: false, error: 'Not logged into EAS. Run: eas login' }; }
    return { ok: false, error: 'Failed to list builds: ' + err.message };
  }
}

/** Start an EAS build (non-blocking) */
async function startEasBuild(platform, profile) {
  if (!VALID_PLATFORMS.includes(platform)) return { ok: false, error: 'Invalid platform' };
  if (!VALID_PROFILES.includes(profile)) return { ok: false, error: 'Invalid profile' };
  try {
    const output = await runCommand(
      ['eas', 'build', '--platform', platform, '--profile', profile, '--non-interactive', '--json'],
      60000
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
    const header = buffer.slice(offset, offset + 512);
    // Check for end-of-archive (first byte zero means null header)
    if (header[0] === 0) break;

    // Extract name (normalize: strip leading ./ and backslashes)
    let name = '';
    for (let i = 0; i < 100 && header[i] !== 0; i++) name += String.fromCharCode(header[i]);
    name = name.trim().replace(/\\/g, '/').replace(/^\.\//, '');

    // Extract size (octal, 12 bytes at offset 124)
    const sizeStr = header.slice(124, 136).toString('ascii').trim().replace(/\0/g, '');
    const size = parseInt(sizeStr, 8) || 0;

    // Type flag
    const typeflag = header[156];

    offset += 512;

    if (size > 0 && (typeflag === 0x30 || typeflag === 0)) { // regular file
      const data = buffer.slice(offset, offset + size);
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
        const partData = buffer.slice(start + boundaryBuf.length, nextStart);
        const headerEnd = partData.indexOf(crlfcrlf, 0);
        if (headerEnd === -1) { start = nextStart; continue; }
        const headerStr = partData.slice(0, headerEnd).toString('utf8');
        const body = partData.slice(headerEnd + 4, partData.length - 2);
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
      }),
      timeout: 15000,
    });
    const data = JSON.parse(res.body.toString());
    return data;
  } catch (err) {
    return { valid: false, error: 'Could not reach update server: ' + err.message };
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // --- API Routes ---
    if (pathname === '/api/state' && req.method === 'GET') {
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

    if (pathname === '/api/features' && req.method === 'POST') {
      const body = await readBody(req);
      const changes = JSON.parse(body);
      const results = writeFeatureFlags(changes);
      jsonResponse(res, { ok: true, results });
      return;
    }

    if (pathname === '/api/connectivity' && req.method === 'GET') {
      const siteUrl = getSiteUrl(readJsonSafe(PATHS.easJson));
      const results = await checkConnectivity(siteUrl);
      jsonResponse(res, results);
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
      // Run build async — respond immediately, build starts in background
      console.log(`  Starting EAS build: ${platform} / ${profile}...`);
      const result = await startEasBuild(platform, profile);
      jsonResponse(res, result);
      return;
    }

    if (pathname === '/api/builds/submit' && req.method === 'POST') {
      const body = await readBody(req);
      const { platform, buildId } = JSON.parse(body);
      if (!platform || !buildId) { jsonResponse(res, { ok: false, error: 'Missing platform or buildId' }, 400); return; }
      console.log(`  Submitting build ${buildId} to ${platform === 'ios' ? 'App Store' : 'Google Play'}...`);
      const result = await submitBuild(platform, buildId);
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
      if (!key) { jsonResponse(res, { hasLicense: false }); return; }
      try {
        const result = await validateLicense(key);
        jsonResponse(res, { hasLicense: true, key: key.substring(0, 4) + '...' + key.slice(-4), ...result });
      } catch (err) {
        jsonResponse(res, { hasLicense: true, key: key.substring(0, 4) + '...' + key.slice(-4), valid: false, error: err.message });
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
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Setup Dashboard</title>
<style>
  :root {
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
    --font-mono: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    --radius: 6px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: var(--font-sans); background: var(--bg-primary); color: var(--text-primary); line-height: 1.6; min-height: 100vh; }

  .header { background: var(--bg-secondary); border-bottom: 1px solid var(--border); padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
  .header h1 { font-size: 20px; font-weight: 600; }
  .header .subtitle { color: var(--text-secondary); font-size: 13px; margin-left: 12px; }
  .header-right { display: flex; align-items: center; gap: 12px; }
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
  .field input, .field select { background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 12px; color: var(--text-primary); font-size: 14px; font-family: var(--font-sans); transition: border-color 0.15s; }
  .field input:focus, .field select:focus { outline: none; border-color: var(--accent); }
  .field .derive-hint { font-size: 11px; color: var(--text-muted); font-style: italic; }
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

  .build-version-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 16px; }
  .build-version-label { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
  .build-version-input { width: 80px; text-align: center; font-family: var(--font-mono); font-size: 13px; padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text-primary); }
  .build-version-input.bumped { border-color: var(--yellow); color: var(--yellow); }
  .version-control { display: flex; gap: 8px; align-items: center; }
  .version-control input { flex: 1; }
  .version-bumps { display: flex; gap: 4px; flex-shrink: 0; }
  .version-files { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

  .feature-flags { display: flex; flex-direction: column; gap: 6px; }
  .feature-flag { display: flex; align-items: flex-start; gap: 12px; padding: 8px 0; }
  .toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; white-space: nowrap; flex-shrink: 0; min-width: 180px; }
  .toggle-label input[type="checkbox"] { display: none; }
  .toggle-switch { position: relative; width: 36px; height: 20px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 10px; transition: all 0.2s; flex-shrink: 0; }
  .toggle-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: var(--text-muted); border-radius: 50%; transition: all 0.2s; }
  .toggle-label input:checked + .toggle-switch { background: var(--green); border-color: var(--green); }
  .toggle-label input:checked + .toggle-switch::after { left: 18px; background: #fff; }
  .toggle-text { font-size: 13px; font-weight: 500; }
  .flag-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.4; padding-top: 2px; }
  .flag-desc code { font-family: var(--font-mono); font-size: 11px; background: var(--bg-tertiary); padding: 1px 5px; border-radius: 3px; }
  .features-notice { margin-top: 12px; padding: 10px 14px; background: rgba(210,153,34,0.1); border: 1px solid var(--yellow); border-radius: var(--radius); font-size: 12px; color: var(--yellow); line-height: 1.5; }
  .features-notice code { font-family: var(--font-mono); font-size: 11px; background: var(--bg-tertiary); padding: 1px 5px; border-radius: 3px; }
  .features-notice strong { color: var(--text-primary); }
  .feature-flag.changed .toggle-switch { box-shadow: 0 0 0 2px var(--yellow); }

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

  .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: var(--radius); font-size: 14px; font-weight: 500; z-index: 1000; animation: slideUp 0.3s ease; max-width: 400px; }
  .toast.success { background: var(--green); color: #fff; }
  .toast.error { background: var(--red); color: #fff; }
  .toast.info { background: var(--accent); color: #fff; }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .loading { text-align: center; padding: 40px; color: var(--text-secondary); }
  .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle; }
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
</style>
</head>
<body>

<div class="header">
  <div style="display:flex;align-items:center">
    <h1>Setup Dashboard</h1>
    <span class="subtitle" id="project-path"></span>
  </div>
  <div class="header-right">
    <span class="progress-badge" id="progress-badge"></span>
  </div>
</div>

<div class="tab-bar">
  <button class="tab-btn active" data-tab="config">Config</button>
  <button class="tab-btn" data-tab="assets">Assets</button>
  <button class="tab-btn" data-tab="plugins">Plugins & Firebase</button>
  <button class="tab-btn" data-tab="modules">Modules</button>
  <button class="tab-btn" data-tab="builds">Builds</button>
  <button class="tab-btn" data-tab="updates">Updates</button>
  <button class="tab-btn" data-tab="status">Status</button>
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
          <input type="text" id="cfg-appName" data-key="appName" placeholder="My Community">
        </div>
        <div class="field">
          <label>Slug <span class="file-hint">app.json > expo.slug</span></label>
          <input type="text" id="cfg-slug" data-key="slug" placeholder="MyCommunity">
          <span class="derive-hint">Auto-derived from app name if blank</span>
        </div>
        <div class="field">
          <label>URL Scheme <span class="file-hint">app.json > expo.scheme</span></label>
          <input type="text" id="cfg-scheme" data-key="scheme" placeholder="mycommunity">
          <span class="derive-hint">Auto-derived from slug if blank</span>
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
          <input type="text" id="cfg-iosBundleId" data-key="iosBundleId" placeholder="com.yourcompany.communityapp">
        </div>
        <div class="field">
          <label>Android Package <span class="file-hint">android.package</span></label>
          <input type="text" id="cfg-androidPackage" data-key="androidPackage" placeholder="com.yourcompany.communityapp">
          <span class="derive-hint">Auto-derived from iOS bundle ID if blank</span>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3>Site URL</h3><span class="badge" style="color:var(--text-muted)">eas.json + app.config.ts</span></div>
    <div class="card-body">
      <div class="field-group single">
        <div class="field">
          <label>Site URL <span class="file-hint">eas.json > build.*.env.SITE_URL</span></label>
          <input type="url" id="cfg-siteUrl" data-key="siteUrl" placeholder="https://your-community-site.com">
          <span class="derive-hint">Also updates app.config.ts fallback URL</span>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3>EAS (Expo) Config</h3><span class="badge" style="color:var(--text-muted)">app.json</span></div>
    <div class="card-body">
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
    <div class="card-header"><h3>Feature Flags</h3><span class="badge" style="color:var(--text-muted)">constants/config.ts</span></div>
    <div class="card-body">
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">Toggle app features on or off. Disabled features are hidden from users. Changes are saved to <code>constants/config.ts</code>.</p>
      <div class="feature-flags" id="feature-flags">
        <div class="feature-flag">
          <label class="toggle-label">
            <input type="checkbox" id="flag-DARK_MODE" data-flag="DARK_MODE">
            <span class="toggle-switch"></span>
            <span class="toggle-text">Dark Mode</span>
          </label>
          <span class="flag-desc">Dark mode synced from Fluent Community theme</span>
        </div>
        <div class="feature-flag">
          <label class="toggle-label">
            <input type="checkbox" id="flag-PUSH_NOTIFICATIONS" data-flag="PUSH_NOTIFICATIONS">
            <span class="toggle-switch"></span>
            <span class="toggle-text">Push Notifications</span>
          </label>
          <span class="flag-desc">Push notifications via Firebase + TBC-CA plugin. Requires <code>google-services.json</code> and <code>GoogleService-Info.plist</code>.</span>
        </div>
        <div class="feature-flag">
          <label class="toggle-label">
            <input type="checkbox" id="flag-MESSAGING" data-flag="MESSAGING">
            <span class="toggle-switch"></span>
            <span class="toggle-text">Messaging</span>
          </label>
          <span class="flag-desc">Direct messaging via Fluent Community Pro + Fluent Messaging add-on</span>
        </div>
        <div class="feature-flag">
          <label class="toggle-label">
            <input type="checkbox" id="flag-COURSES" data-flag="COURSES">
            <span class="toggle-switch"></span>
            <span class="toggle-text">Courses</span>
          </label>
          <span class="flag-desc">Course enrollment via Fluent Community Pro + LMS add-on</span>
        </div>
        <div class="feature-flag">
          <label class="toggle-label">
            <input type="checkbox" id="flag-CART" data-flag="CART">
            <span class="toggle-switch"></span>
            <span class="toggle-text">Cart</span>
          </label>
          <span class="flag-desc">WooCommerce cart icon in header. Disable if you do not use WooCommerce.</span>
        </div>
        <div class="feature-flag">
          <label class="toggle-label">
            <input type="checkbox" id="flag-MULTI_REACTIONS" data-flag="MULTI_REACTIONS">
            <span class="toggle-switch"></span>
            <span class="toggle-text">Multi-Reactions</span>
          </label>
          <span class="flag-desc">Emoji reactions on posts and comments via TBC Multi-Reactions plugin. Disable if plugin is not installed.</span>
        </div>
        <div class="feature-flag-group">
          <h4 style="font-size:13px;color:var(--text-secondary);margin:16px 0 8px;border-top:1px solid var(--border);padding-top:12px">Profile Tabs</h4>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Extra tabs shown on user profile pages. The About tab is always visible.</p>
          <div class="feature-flag">
            <label class="toggle-label">
              <input type="checkbox" id="flag-PROFILE_POSTS" data-flag="PROFILE_TABS.POSTS">
              <span class="toggle-switch"></span>
              <span class="toggle-text">Posts</span>
            </label>
            <span class="flag-desc">Show user posts feed on their profile</span>
          </div>
          <div class="feature-flag">
            <label class="toggle-label">
              <input type="checkbox" id="flag-PROFILE_SPACES" data-flag="PROFILE_TABS.SPACES">
              <span class="toggle-switch"></span>
              <span class="toggle-text">Spaces</span>
            </label>
            <span class="flag-desc">Show user joined spaces on their profile</span>
          </div>
          <div class="feature-flag">
            <label class="toggle-label">
              <input type="checkbox" id="flag-PROFILE_COMMENTS" data-flag="PROFILE_TABS.COMMENTS">
              <span class="toggle-switch"></span>
              <span class="toggle-text">Comments</span>
            </label>
            <span class="flag-desc">Show user comments on their profile</span>
          </div>
        </div>
      </div>
      <div id="features-changed-notice" class="features-notice" style="display:none">
        <span>\u26A0</span> Feature flag changes require a <strong>dev server restart</strong> (<code>npx expo start</code>) or a <strong>new build</strong> to take effect.
      </div>
      <div style="margin-top:16px">
        <button class="btn btn-primary" id="save-features-btn" onclick="saveFeatures()">Save Feature Flags</button>
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
  'siteUrl', 'easOwner', 'easProjectId', 'appNameConfig', 'userAgent',
  'appleId', 'ascAppId', 'packageName'];
const BOOL_FLAGS = ${JSON.stringify(BOOL_FLAGS)};
const PROFILE_TAB_KEYS = ${JSON.stringify(PROFILE_TAB_KEYS)};

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
    text: 'Your WordPress + Fluent Community site URL (<strong>no trailing slash</strong>). The app connects to this URL for all API calls. Must have the <code>tbc-community-app</code> plugin installed.',
    rebuild: true,
  },
  easOwner: {
    text: 'Your Expo account username. Run <code>eas login</code> in terminal if you have not already.',
    link: 'https://expo.dev/settings',
    linkLabel: 'Expo Settings',
    rebuild: true,
  },
  easProjectId: {
    text: 'Your EAS project ID (UUID format). Run <code>eas init</code> in your project to create one, or find it under your project settings.',
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
    if (btn.dataset.tab === 'modules' && !modulesLoaded) loadModules();
    if (btn.dataset.tab === 'updates' && !updatesLoaded) loadUpdatesTab();
  });
});

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
  siteUrl: (val) => ({ fallbackSiteUrl: val }),
};

function markDirty() {
  dirty = true;
  document.getElementById('save-config-btn').textContent = 'Save Changes *';
}

document.querySelectorAll('#tab-config input[data-key]').forEach(input => {
  input.addEventListener('input', () => {
    markDirty();
    updateFieldHelp(input);
    const key = input.dataset.key;
    if (deriveMap[key]) {
      const derived = deriveMap[key](input.value);
      for (const [dk, dv] of Object.entries(derived)) {
        const target = document.getElementById('cfg-' + dk);
        if (!target) continue;
        if (!target.value || target.value === lastDerived[dk] || target.value === deriveField(dk, originalValues[key])) {
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
  sel.addEventListener('change', markDirty);
});

function deriveField(targetKey, sourceVal) {
  if (!sourceVal) return '';
  if (targetKey === 'slug') return sourceVal.replace(/[^a-zA-Z0-9]/g, '');
  if (targetKey === 'scheme') return sourceVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (targetKey === 'appNameConfig') return sourceVal;
  if (targetKey === 'userAgent') { const b = sourceVal.replace(/[^a-zA-Z0-9]/g, ''); return b.toLowerCase().endsWith('app') ? b + '/1.0' : b + 'App/1.0'; }
  if (targetKey === 'packageName') return sourceVal.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '');
  if (targetKey === 'fallbackName') return sourceVal;
  if (targetKey === 'fallbackSlug') return sourceVal.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (targetKey === 'androidPackage') return sourceVal;
  if (targetKey === 'fallbackSiteUrl') return sourceVal;
  return '';
}

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
    populateFeatures(state.features);
    dirty = false;
    document.getElementById('save-config-btn').textContent = 'Save Changes';
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
  // Google Play track
  const trackEl = document.getElementById('cfg-googlePlayTrack');
  if (trackEl && config.googlePlayTrack) {
    trackEl.value = config.googlePlayTrack;
    originalValues.googlePlayTrack = config.googlePlayTrack;
  }
  injectFieldHelp(trackEl, 'googlePlayTrack', config.googlePlayTrack);
  // Sync version to Builds tab
  syncBuildVersion();
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
    (plugin.exists ? '<span class="plugin-version">v' + plugin.version + '</span>' : '<span style="font-size:12px;color:var(--text-muted)">Not installed</span>');
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
  badge.textContent = validation.pass + '/' + total + ' checks passing';
  badge.className = 'progress-badge ' + (validation.fail === 0 ? 'good' : validation.fail <= 3 ? 'partial' : 'bad');
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
  if (changes.siteUrl !== undefined) changes.fallbackSiteUrl = changes.siteUrl;
  if (changes.appName !== undefined) changes.fallbackName = changes.appName;
  if (changes.slug !== undefined) changes.fallbackSlug = changes.slug.toLowerCase();

  if (Object.keys(changes).length === 0) { showToast('No changes to save', 'error'); return; }
  try {
    const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
    const data = await res.json();
    if (data.ok) { showToast('Saved: ' + data.results.join(', '), 'success'); await loadState(); }
    else showToast('Save failed: ' + JSON.stringify(data), 'error');
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
  markDirty();
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

// ---------- Feature flags ----------
let originalFeatures = {};

function populateFeatures(features) {
  if (!features) return;
  originalFeatures = JSON.parse(JSON.stringify(features));
  for (const flag of BOOL_FLAGS) {
    const el = document.getElementById('flag-' + flag);
    if (el) {
      el.checked = features[flag] === true;
      el.removeEventListener('change', checkFeatureChanges);
      el.addEventListener('change', checkFeatureChanges);
    }
  }
  if (features.PROFILE_TABS) {
    for (const sub of PROFILE_TAB_KEYS) {
      const el = document.getElementById('flag-PROFILE_' + sub);
      if (el) {
        el.checked = features.PROFILE_TABS[sub] === true;
        el.removeEventListener('change', checkFeatureChanges);
        el.addEventListener('change', checkFeatureChanges);
      }
    }
  }
  // Reset notice and changed indicators
  document.getElementById('features-changed-notice').style.display = 'none';
  document.querySelectorAll('.feature-flag.changed').forEach(el => el.classList.remove('changed'));
}

function checkFeatureChanges() {
  let anyChanged = false;
  for (const flag of BOOL_FLAGS) {
    const el = document.getElementById('flag-' + flag);
    if (!el) continue;
    const orig = originalFeatures[flag] === true;
    const changed = el.checked !== orig;
    el.closest('.feature-flag').classList.toggle('changed', changed);
    if (changed) anyChanged = true;
  }
  for (const sub of PROFILE_TAB_KEYS) {
    const el = document.getElementById('flag-PROFILE_' + sub);
    if (!el) continue;
    const orig = originalFeatures.PROFILE_TABS && originalFeatures.PROFILE_TABS[sub] === true;
    const changed = el.checked !== orig;
    el.closest('.feature-flag').classList.toggle('changed', changed);
    if (changed) anyChanged = true;
  }
  document.getElementById('features-changed-notice').style.display = anyChanged ? 'block' : 'none';
}

async function saveFeatures() {
  const changes = {};
  for (const flag of BOOL_FLAGS) {
    const el = document.getElementById('flag-' + flag);
    if (el && el.checked !== (originalFeatures[flag] === true)) {
      changes[flag] = el.checked;
    }
  }
  const profileChanges = {};
  let hasProfileChanges = false;
  for (const sub of PROFILE_TAB_KEYS) {
    const el = document.getElementById('flag-PROFILE_' + sub);
    const orig = originalFeatures.PROFILE_TABS && originalFeatures.PROFILE_TABS[sub] === true;
    if (el && el.checked !== orig) {
      profileChanges[sub] = el.checked;
      hasProfileChanges = true;
    }
  }
  if (hasProfileChanges) changes.PROFILE_TABS = profileChanges;

  if (Object.keys(changes).length === 0) { showToast('No feature flag changes', 'error'); return; }
  try {
    const res = await fetch('/api/features', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) });
    const data = await res.json();
    if (data.ok) { showToast(data.results.join(', '), 'success'); await loadState(); }
    else showToast('Save failed: ' + JSON.stringify(data), 'error');
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

async function loadBuilds() {
  const list = document.getElementById('builds-list');
  list.innerHTML = '<div class="loading"><span class="spinner"></span> Loading builds from EAS...</div>';
  try {
    const res = await fetch('/api/builds');
    const data = await res.json();
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
    list.innerHTML = '';
    // Read state for submit config
    const googlePlayConfigured = state && state.config.googlePlayKeyExists;
    const iosSubmitConfigured = state && state.config.appleId && state.config.ascAppId;

    for (const build of data.builds) {
      const card = document.createElement('div');
      card.className = 'build-card';
      const isIos = build.platform === 'IOS' || build.platform === 'ios';
      const isAndroid = build.platform === 'ANDROID' || build.platform === 'android';
      const platformIcon = isIos ? '\\uD83C\\uDF4F' : '\\uD83E\\uDD16';
      const platformLabel = isIos ? 'iOS' : 'Android';
      const statusClass = (build.status || '').toLowerCase().replace(/_/g, '-');
      const statusLabel = (build.status || 'unknown').toLowerCase().replace(/_/g, ' ');
      const version = build.appVersion || build.version || '?';
      const profile = build.buildProfile || build.profile || '';
      const createdAt = build.createdAt ? new Date(build.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const buildId = build.id || '';
      const isFinished = statusClass === 'finished';

      let actionsHtml = '';
      if (isFinished) {
        // Download link (both platforms get one when artifacts exist)
        if (build.artifacts && build.artifacts.buildUrl) {
          const dlLabel = isIos ? 'Download .ipa' : 'Download .aab';
          actionsHtml += '<a class="btn btn-sm btn-primary" href="' + build.artifacts.buildUrl + '" target="_blank" rel="noopener">' + dlLabel + '</a>';
        }
        // Submit buttons
        if (isIos) {
          if (iosSubmitConfigured) {
            actionsHtml += '<button class="btn btn-sm btn-success" onclick="submitToStore(\\'ios\\',\\'' + buildId + '\\')">Submit to App Store</button>';
          } else {
            actionsHtml += '<button class="btn btn-sm" disabled title="Set Apple ID and ASC App ID in Config tab first">Submit (not configured)</button>';
          }
        }
        if (isAndroid) {
          if (googlePlayConfigured) {
            actionsHtml += '<button class="btn btn-sm btn-success" onclick="submitToStore(\\'android\\',\\'' + buildId + '\\')">Submit to Google Play</button>';
          } else {
            actionsHtml += '<button class="btn btn-sm" disabled title="Upload Google Play service account key in Config tab first">Submit (not configured)</button>';
          }
        }
        // EAS build page link
        if (build.buildDetailsPageUrl) {
          actionsHtml += '<a class="btn btn-sm" href="' + build.buildDetailsPageUrl + '" target="_blank" rel="noopener">View on EAS</a>';
        }
      } else if (build.buildDetailsPageUrl) {
        actionsHtml += '<a class="btn btn-sm" href="' + build.buildDetailsPageUrl + '" target="_blank" rel="noopener">View on EAS</a>';
      }

      card.innerHTML =
        '<div class="build-platform">' + platformIcon + '</div>' +
        '<div class="build-info">' +
          '<div class="build-version">' + platformLabel + ' v' + version + (profile ? ' (' + profile + ')' : '') + '</div>' +
          '<div class="build-meta">' + createdAt + '</div>' +
          '<div class="build-id">' + buildId.substring(0, 12) + '</div>' +
        '</div>' +
        '<span class="build-status ' + statusClass + '">' + statusLabel + '</span>' +
        '<div class="build-actions">' + actionsHtml + '</div>';
      list.appendChild(card);
    }
  } catch (err) {
    list.innerHTML = '<div style="padding:16px;color:var(--red)">Error loading builds: ' + err.message + '</div>';
  }
}

async function startBuild(platform, profile) {
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
      showToast('Build started! Check the Builds tab for progress.', 'success');
      setTimeout(loadBuilds, 2000);
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
    } else {
      showToast('Submit failed: ' + data.error, 'error');
    }
  } catch (err) { showToast('Submit error: ' + err.message, 'error'); }
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

// ---------- Updates Tab ----------
let updatesLoaded = false;

async function loadUpdatesTab() {
  updatesLoaded = true;
  // Show versions from the last loaded state
  try {
    const stateRes = await fetch('/api/state');
    const state = await stateRes.json();
    const coreEl = document.getElementById('core-version-display');
    const appEl = document.getElementById('app-version-display');
    if (coreEl) coreEl.textContent = 'v' + (state.config.coreVersion || '?');
    if (appEl) appEl.textContent = 'v' + (state.config.version || '?');
  } catch {}
  const [licenseData] = await Promise.all([loadLicenseStatus(), loadBackups()]);
  // Auto-check for updates if a valid license exists
  if (licenseData && licenseData.valid) {
    checkForUpdates();
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
      checkBtn.disabled = false;
      checkBtn.textContent = 'Check Now';
      return;
    }

    if (!data.valid) {
      statusEl.innerHTML = '<div class="update-result error"><strong>License Error:</strong> ' + (data.error || 'Invalid license') + '</div>';
      checkBtn.disabled = false;
      checkBtn.textContent = 'Check Now';
      return;
    }

    if (!data.latest) {
      statusEl.innerHTML = '<div class="update-up-to-date">&#10003; You are on the latest version (v' + (data.currentVersion || '?') + ')</div>';
      checkBtn.disabled = false;
      checkBtn.textContent = 'Check Now';
      return;
    }

    // Update available!
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
  if (!confirm('This will:\\n\\n1. Backup your current project\\n2. Download v' + version + '\\n3. Apply the update (your config, assets, and modules are preserved)\\n\\nProceed?')) return;

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
    resultHtml += '<strong>Update applied successfully!</strong><br>';
    if (data.depsChanged) resultHtml += '<br>&#x26A0; Dependencies changed. Run <code>npm install</code> to update them.';
    if (data.dashboardUpdated) resultHtml += '<br>&#x26A0; Dashboard updated. Restart the dashboard to use the new version.';
    resultHtml += '<br><br>Run <code>npm install</code> then rebuild your app.';
    resultHtml += '</div>';
    statusEl.innerHTML += resultHtml;

    await loadBackups();
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

  if (!confirm('Apply update from "' + file.name + '"?\\n\\nYour current project will be backed up first. Config, assets, and modules are preserved.')) return;

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
    if (data.dashboardUpdated) html += '<br>&#x26A0; Dashboard updated. Restart the dashboard to use the new version.';
    html += '<br><br>Run <code>npm install</code> then rebuild your app.';
    html += '</div>';

    statusEl.innerHTML = html;
    showToast('Update applied!', 'success');
    await loadBackups();
  } catch (err) {
    statusEl.innerHTML = '<div class="update-result error"><strong>Upload failed:</strong> ' + err.message + '</div>';
    zone.style.display = '';
  }
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

// ---------- Init ----------
setupManualUploadZone();
loadState();
</script>
</body>
</html>`;
}
