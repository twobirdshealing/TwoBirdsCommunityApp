'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, REQUIRED_ASSETS, PROJECT_DIR, isPlaceholder } = require('./paths');
const { fileExists, readJsonSafe, fileSizeKB, extractTsValue, getSiteUrl, findPluginConfig } = require('./file-utils');

// ---------------------------------------------------------------------------
// State Reader
// ---------------------------------------------------------------------------

function readProjectState() {
  const state = { config: {}, assets: [], firebase: {}, validation: { checks: [], pass: 0, fail: 0, warn: 0 } };

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
    state.config.ascApiKeyId = easJson.submit?.production?.ios?.ascApiKeyId || '';
    state.config.ascApiKeyIssuerId = easJson.submit?.production?.ios?.ascApiKeyIssuerId || '';
    state.config.ascApiKeyPath = easJson.submit?.production?.ios?.ascApiKeyPath || '';
    // Google Play submit config
    state.config.googlePlayTrack = easJson.submit?.production?.android?.track || 'production';
    state.config.googlePlayServiceAccountKeyPath = easJson.submit?.production?.android?.serviceAccountKeyPath || '';
  }

  // --- constants/config.ts ---
  if (fileExists(PATHS.configTs)) {
    const content = fs.readFileSync(PATHS.configTs, 'utf8');
    state.config.appNameConfig = extractTsValue(content, /export const APP_NAME = '([^']*)'/);
    state.config.userAgent = extractTsValue(content, /export const APP_USER_AGENT = '([^']*)'/);
    state.config.loginLogoMode = extractTsValue(content, /const LOGIN_LOGO_MODE = '([^']*)'/);
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

  // --- App Store Connect API key (.p8) ---
  state.config.ascApiKeyExists = fileExists(PATHS.ascApiKeyFile);

  // --- Assets ---
  for (const asset of REQUIRED_ASSETS) {
    const fullPath = path.join(PATHS.assetsDir, asset.file);
    const exists = fileExists(fullPath);
    state.assets.push({ ...asset, exists, sizeKB: exists ? fileSizeKB(fullPath) : 0 });
  }

  // --- Adaptive icon background mode ---
  const adaptiveIcon = appJson?.expo?.android?.adaptiveIcon || {};
  state.adaptiveIconBg = {
    mode: adaptiveIcon.backgroundImage ? 'image' : 'color',
    color: adaptiveIcon.backgroundColor || '#FFFFFF',
  };

  // --- Login logo mode ---
  state.loginLogoMode = state.config.loginLogoMode || 'dynamic';

  // --- Mark skipped assets (alternative mode active, no file needed) ---
  for (const asset of state.assets) {
    asset.skipped = (asset.file === 'login_logo.png' && state.loginLogoMode === 'dynamic')
      || (asset.file === 'app_icon_android_adaptive_bg.png' && state.adaptiveIconBg.mode === 'color');
  }

  // --- Branding colors ---
  const splashCfg = findPluginConfig(appJson?.expo?.plugins, 'expo-splash-screen');
  const notifCfg = findPluginConfig(appJson?.expo?.plugins, 'expo-notifications');
  state.brandingColors = {
    splashColorLight: splashCfg?.backgroundColor || '#ffffff',
    splashColorDark: splashCfg?.dark?.backgroundColor || '#1a1a1a',
    notificationColor: notifCfg?.color || '#6366F1',
  };

  // --- Firebase ---
  state.firebase.android = { exists: fileExists(PATHS.googleServicesJson), file: 'google-services.json' };
  if (state.firebase.android.exists) {
    const gs = readJsonSafe(PATHS.googleServicesJson);
    if (gs) state.firebase.android.projectId = gs.project_info?.project_id || '';
  }
  state.firebase.ios = { exists: fileExists(PATHS.googleServiceInfoPlist), file: 'GoogleService-Info.plist' };
  if (state.firebase.ios.exists) {
    try {
      const plist = fs.readFileSync(PATHS.googleServiceInfoPlist, 'utf8');
      const m = plist.match(/<key>PROJECT_ID<\/key>\s*<string>([^<]*)<\/string>/);
      if (m) state.firebase.ios.projectId = m[1];
    } catch (_) { /* ignore read errors */ }
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

  // --- Project directory (for app switcher) ---
  state.projectDir = PROJECT_DIR;

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

  // Refs point to tab + section so the frontend can navigate on click
  const REF = {
    appIdentity:      { tab: 'config', section: 'app-identity' },
    wordpressSite:    { tab: 'config', section: 'wordpress-site' },
    buildService:     { tab: 'config', section: 'build-service' },
    storeSubmission:  { tab: 'config', section: 'app-store-submission' },
    pushNotifications:{ tab: 'config', section: 'push-notifications' },
    brandingAssets:   { tab: 'assets', section: 'branding-assets' },
  };

  function check(pass, label, category, ref) {
    checks.push({ pass: pass ? 'pass' : 'fail', label, category, ref });
  }
  function checkWarn(warn, label, category, ref) {
    checks.push({ pass: warn ? 'warn' : 'pass', label, category, ref });
  }

  // --- App Identity ---
  check(!isPlaceholder(c.appName), 'App name is set', 'App Identity', REF.appIdentity);
  check(!isPlaceholder(c.slug), 'Slug is set', 'App Identity', REF.appIdentity);
  check(!isPlaceholder(c.scheme), 'URL scheme is set', 'App Identity', REF.appIdentity);
  check(!isPlaceholder(c.iosBundleId), 'iOS bundle ID is set', 'App Identity', REF.appIdentity);
  check(!isPlaceholder(c.androidPackage), 'Android package is set', 'App Identity', REF.appIdentity);
  if (c.appName && c.appNameConfig && c.appName !== c.appNameConfig) {
    checks.push({ pass: 'warn', label: `App name out of sync: app.json="${c.appName}" vs config.ts="${c.appNameConfig}"`, category: 'App Identity', ref: REF.appIdentity });
  }

  // --- Your WordPress Site ---
  check(!isPlaceholder(c.siteUrl), 'Site URL is set', 'Your WordPress Site', REF.wordpressSite);
  if (c.siteUrl && c.productionUrl && c.siteUrl !== c.productionUrl) {
    checks.push({ pass: 'warn', label: `Site URL out of sync: eas.json vs app.config.ts`, category: 'Your WordPress Site', ref: REF.wordpressSite });
  }

  // --- Build Service ---
  check(!isPlaceholder(c.easOwner), 'EAS owner is set', 'Build Service', REF.buildService);
  check(!isPlaceholder(c.easProjectId), 'EAS project ID is set', 'Build Service', REF.buildService);

  // --- App Store Submission ---
  checkWarn(isPlaceholder(c.appleId), 'Apple ID not set (needed for iOS submission)', 'App Store Submission', REF.storeSubmission);
  checkWarn(isPlaceholder(c.ascAppId), 'App Store Connect ID not set (needed for iOS submission)', 'App Store Submission', REF.storeSubmission);
  checkWarn(!c.ascApiKeyExists, 'App Store Connect API key not uploaded (needed for iOS submission)', 'App Store Submission', REF.storeSubmission);
  checkWarn(!c.googlePlayKeyExists, 'Google Play service account key not uploaded', 'App Store Submission', REF.storeSubmission);
  if (c.version && c.packageVersion && c.version !== c.packageVersion) {
    checks.push({ pass: 'warn', label: `Version mismatch: app.json="${c.version}" vs package.json="${c.packageVersion}"`, category: 'App Store Submission', ref: REF.storeSubmission });
  }

  // --- Push Notifications ---
  check(state.firebase.android.exists, 'Android Firebase config uploaded', 'Push Notifications', REF.pushNotifications);
  check(state.firebase.ios.exists, 'iOS Firebase config uploaded', 'Push Notifications', REF.pushNotifications);

  // --- Branding Assets ---
  for (const asset of state.assets) {
    if (asset.skipped) {
      // Alternative mode active (e.g., dynamic logo, solid color bg) — auto-pass with descriptive label
      const modeLabel = asset.file === 'login_logo.png' ? 'synced from site' : 'using solid color';
      check(true, `${asset.label} (${modeLabel})`, 'Branding Assets', REF.brandingAssets);
    } else {
      check(asset.exists, `${asset.label} exists`, 'Branding Assets', REF.brandingAssets);
    }
  }

  state.validation.checks = checks;
  state.validation.pass = checks.filter(c => c.pass === 'pass').length;
  state.validation.fail = checks.filter(c => c.pass === 'fail').length;
  state.validation.warn = checks.filter(c => c.pass === 'warn').length;
}

module.exports = { readProjectState, runValidation };
