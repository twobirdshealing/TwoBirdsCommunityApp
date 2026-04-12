'use strict';

const fs = require('fs');
const path = require('path');
const { PATHS, REQUIRED_ASSETS } = require('./paths');
const { fileExists, readJsonSafe, findPluginConfig } = require('./file-utils');
const { writeConfigValues } = require('./config-writer');
const { createZip, parseZip } = require('./http-helpers');
const { readProjectState } = require('./state');
const { getInstalledModules } = require('./modules');

// ---------------------------------------------------------------------------
// Marker boundaries in _registry.ts for buyer's module imports
// ---------------------------------------------------------------------------

const MODULES_START_MARKER = '// YOUR MODULES';
const MODULES_END_MARKER = '// END YOUR MODULES';

// ---------------------------------------------------------------------------
// Credential files (basename → PATHS key)
// ---------------------------------------------------------------------------

const CREDENTIAL_FILES = {
  'google-services.json': 'googleServicesJson',
  'GoogleService-Info.plist': 'googleServiceInfoPlist',
  'asc-api-key.p8': 'ascApiKeyFile',
  'google-play-service-account.json': 'googlePlayKeyFile',
};

// ---------------------------------------------------------------------------
// Extract — read all buyer identity from hybrid files
// ---------------------------------------------------------------------------

const DERIVED_STATE_KEYS = ['googlePlayKeyExists', 'ascApiKeyExists', 'coreVersion'];

function extractIdentity() {
  const state = readProjectState();
  const coreVersion = state.config.coreVersion || '0.0.0';
  const config = { ...state.config };
  for (const key of DERIVED_STATE_KEYS) delete config[key];

  config.adaptiveIconBgMode = state.adaptiveIconBg?.mode || 'color';
  config.adaptiveIconBgColor = state.adaptiveIconBg?.color || '#FFFFFF';

  // Splash + notification colors live in app.json plugin configs, not state.config
  const appJson = readJsonSafe(PATHS.appJson);
  if (appJson?.expo?.plugins) {
    const splashCfg = findPluginConfig(appJson.expo.plugins, 'expo-splash-screen');
    config.splashColorLight = splashCfg?.backgroundColor || '';
    config.splashColorDark = splashCfg?.dark?.backgroundColor || '';
    const notifCfg = findPluginConfig(appJson.expo.plugins, 'expo-notifications');
    config.notificationColor = notifCfg?.color || '';
  }

  let moduleImportBlock = '';
  try {
    const content = fs.readFileSync(PATHS.registryTs, 'utf8');
    const startIdx = content.indexOf(MODULES_START_MARKER);
    const endIdx = content.indexOf(MODULES_END_MARKER);
    if (startIdx !== -1 && endIdx !== -1) {
      const afterStart = content.indexOf('\n', startIdx);
      moduleImportBlock = content.substring(afterStart + 1, endIdx).trimEnd();
    }
  } catch { /* registry not found */ }

  const activeModuleIds = getInstalledModules()
    .filter(m => m.active)
    .map(m => m.id);

  // Licenses
  let coreLicense = '';
  try { coreLicense = fs.readFileSync(PATHS.licenseFile, 'utf8').trim(); } catch {}
  const moduleLicenses = readJsonSafe(path.join(path.dirname(PATHS.licenseFile), '.module-licenses.json')) || {};

  const credentials = {
    hasAscApiKey: fileExists(PATHS.ascApiKeyFile),
    hasGoogleServicesAndroid: fileExists(PATHS.googleServicesJson),
    hasGoogleServicesIos: fileExists(PATHS.googleServiceInfoPlist),
    hasGooglePlayKey: fileExists(PATHS.googlePlayKeyFile),
  };

  // --- Assets ---
  const assets = REQUIRED_ASSETS
    .map(a => a.file)
    .filter(f => fileExists(path.join(PATHS.assetsDir, f)));

  return {
    exportedAt: new Date().toISOString(),
    coreVersion,
    config,
    moduleImportBlock,
    activeModuleIds,
    coreLicense,
    moduleLicenses,
    credentials,
    assets,
  };
}

// ---------------------------------------------------------------------------
// Create ZIP — package identity into a downloadable backup
// ---------------------------------------------------------------------------

function createIdentityZip() {
  const identity = extractIdentity();
  const files = [];

  files.push({
    path: 'identity.json',
    data: Buffer.from(JSON.stringify(identity, null, 2)),
  });

  for (const assetFile of identity.assets) {
    const fullPath = path.join(PATHS.assetsDir, assetFile);
    if (fileExists(fullPath)) {
      files.push({ path: 'assets/' + assetFile, data: fs.readFileSync(fullPath) });
    }
  }

  for (const [filename, pathKey] of Object.entries(CREDENTIAL_FILES)) {
    const fullPath = PATHS[pathKey];
    if (fileExists(fullPath)) {
      files.push({ path: 'credentials/' + filename, data: fs.readFileSync(fullPath) });
    }
  }

  return createZip(files);
}

// ---------------------------------------------------------------------------
// Apply ZIP — restore identity from a backup
// ---------------------------------------------------------------------------

function applyIdentityZip(zipBuffer) {
  let files;
  try {
    files = parseZip(zipBuffer);
  } catch (err) {
    return { ok: false, error: 'Invalid zip: ' + err.message };
  }

  const identityEntry = files.find(f => f.path === 'identity.json');
  if (!identityEntry) return { ok: false, error: 'No identity.json in zip' };

  let identity;
  try {
    identity = JSON.parse(identityEntry.data.toString());
  } catch (err) {
    return { ok: false, error: 'Invalid identity.json: ' + err.message };
  }

  const writeResults = writeConfigValues(identity.config || {});

  // Restore licenses
  if (identity.coreLicense) {
    fs.mkdirSync(path.dirname(PATHS.licenseFile), { recursive: true });
    fs.writeFileSync(PATHS.licenseFile, identity.coreLicense);
  }
  if (identity.moduleLicenses && Object.keys(identity.moduleLicenses).length > 0) {
    const mlPath = path.join(path.dirname(PATHS.licenseFile), '.module-licenses.json');
    fs.writeFileSync(mlPath, JSON.stringify(identity.moduleLicenses, null, 2) + '\n');
  }

  // Restore module import block into _registry.ts
  let registryRestored = false;
  if (identity.moduleImportBlock && fileExists(PATHS.registryTs)) {
    const content = fs.readFileSync(PATHS.registryTs, 'utf8');
    const startIdx = content.indexOf(MODULES_START_MARKER);
    const endIdx = content.indexOf(MODULES_END_MARKER);
    if (startIdx !== -1 && endIdx !== -1) {
      const afterStart = content.indexOf('\n', startIdx);
      const restored = content.substring(0, afterStart + 1) +
        identity.moduleImportBlock + '\n\n' +
        content.substring(endIdx);
      fs.writeFileSync(PATHS.registryTs, restored);
      registryRestored = true;
    }
  }

  // Restore branding assets
  let assetsRestored = 0;
  for (const file of files) {
    if (!file.path.startsWith('assets/')) continue;
    const basename = path.basename(file.path);
    if (basename !== file.path.replace('assets/', '')) continue; // path traversal guard
    const dest = path.join(PATHS.assetsDir, basename);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.data);
    assetsRestored++;
  }

  // Restore credential files
  let credentialsRestored = 0;
  for (const file of files) {
    if (!file.path.startsWith('credentials/')) continue;
    const basename = path.basename(file.path);
    const pathKey = CREDENTIAL_FILES[basename];
    if (!pathKey) continue;
    fs.writeFileSync(PATHS[pathKey], file.data);
    credentialsRestored++;
  }

  return {
    ok: true,
    configResults: writeResults,
    registryRestored,
    assetsRestored,
    credentialsRestored,
  };
}

// ---------------------------------------------------------------------------
// Temp file management (for atomic update flow)
// ---------------------------------------------------------------------------

function saveIdentityTemp(zipBuffer) {
  fs.mkdirSync(PATHS.tempDir, { recursive: true });
  const filename = 'identity-' + Date.now() + '.zip';
  const filePath = path.join(PATHS.tempDir, filename);
  fs.writeFileSync(filePath, zipBuffer);
  return filePath;
}

function loadIdentityTemp(filePath) {
  return fs.readFileSync(filePath);
}

function cleanupIdentityTemp(filePath) {
  try { fs.unlinkSync(filePath); } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  extractIdentity,
  createIdentityZip,
  applyIdentityZip,
  saveIdentityTemp,
  loadIdentityTemp,
  cleanupIdentityTemp,
};
