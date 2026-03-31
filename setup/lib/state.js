'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, REQUIRED_ASSETS, CORE_PLUGINS, PROJECT_DIR, isPlaceholder } = require('./paths');
const { fileExists, readJsonSafe, fileSizeKB, extractTsValue, getSiteUrl, getPluginVersion, findPluginConfig } = require('./file-utils');

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

  // --- Adaptive icon background mode ---
  const adaptiveIcon = appJson?.expo?.android?.adaptiveIcon || {};
  state.adaptiveIconBg = {
    mode: adaptiveIcon.backgroundImage ? 'image' : 'color',
    color: adaptiveIcon.backgroundColor || '#FFFFFF',
  };

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

  // --- Plugins ---
  for (const plugin of CORE_PLUGINS) {
    const version = getPluginVersion(plugin.folder);
    state.plugins.core.push({ ...plugin, exists: version !== null, version: version || '' });
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
  check(!isPlaceholder(c.iosBundleId), 'iOS bundle ID is set', 'app.json', 'app-identity');
  check(!isPlaceholder(c.androidPackage), 'Android package is set', 'app.json', 'app-identity');
  check(!isPlaceholder(c.easProjectId), 'EAS project ID is set', 'app.json', 'eas-config');
  check(!isPlaceholder(c.easOwner), 'EAS owner is set', 'app.json', 'eas-config');

  // eas.json
  check(!isPlaceholder(c.siteUrl), 'EXPO_PUBLIC_SITE_URL is set', 'eas.json', 'site-url');
  checkWarn(isPlaceholder(c.appleId), 'Apple Account email not set (needed for iOS submit)', 'eas.json', 'app-store-submission');
  checkWarn(isPlaceholder(c.ascAppId), 'App Store Connect ID not set (needed for iOS submit)', 'eas.json', 'app-store-submission');

  // config.ts
  check(!isPlaceholder(c.appNameConfig), 'APP_NAME is set in config.ts', 'config.ts', 'auto-generated');
  check(!isPlaceholder(c.userAgent), 'APP_USER_AGENT is set', 'config.ts', 'auto-generated');
  // app.config.ts
  check(!isPlaceholder(c.productionUrl), 'Production URL is set', 'app.config.ts', 'site-url');

  // Consistency
  if (c.appName && c.appNameConfig && c.appName !== c.appNameConfig) {
    checks.push({ pass: 'warn', label: `App name mismatch: app.json="${c.appName}" vs config.ts="${c.appNameConfig}"`, category: 'consistency', ref: 'auto-generated' });
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

  // Core companion plugins
  for (const plugin of state.plugins.core) {
    check(plugin.exists, plugin.label + ' plugin is bundled', 'companion plugins', 'core-plugins');
  }

  // Dependencies
  check(state.dependencies.nodeModules, 'node_modules exists (npm install done)', 'dependencies', 'quick-start');

  // package.json
  check(!isPlaceholder(c.packageName), 'Package name is set', 'package.json', 'auto-generated');

  state.validation.checks = checks;
  state.validation.pass = checks.filter(c => c.pass === 'pass').length;
  state.validation.fail = checks.filter(c => c.pass === 'fail').length;
  state.validation.warn = checks.filter(c => c.pass === 'warn').length;
}

module.exports = { readProjectState, runValidation };
