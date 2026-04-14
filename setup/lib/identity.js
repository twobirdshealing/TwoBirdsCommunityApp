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

  // --- package.json deps (buyer-added only — diff vs setup/.core-package.json baseline) ---
  // The baseline is written by applyUpdateFromZip after every core install. On bootstrap
  // (no baseline yet), fall back to capturing the full deps so nothing is lost.
  const pkgJson = readJsonSafe(PATHS.packageJson) || {};
  const corePkgJson = readJsonSafe(PATHS.corePackageJson);
  const diffDeps = (current, base) => {
    const out = {};
    for (const [k, v] of Object.entries(current || {})) {
      if (!base || base[k] !== v) out[k] = v;
    }
    return out;
  };
  const dependencies = corePkgJson
    ? diffDeps(pkgJson.dependencies, corePkgJson.dependencies)
    : (pkgJson.dependencies || {});
  const devDependencies = corePkgJson
    ? diffDeps(pkgJson.devDependencies, corePkgJson.devDependencies)
    : (pkgJson.devDependencies || {});

  // --- eas.json credentials (Apple ID, ASC API key path, Google Play key path) ---
  const easJson = readJsonSafe(PATHS.easJson) || {};
  const easCredentials = {
    appleId: easJson?.submit?.production?.ios?.appleId || '',
    ascApiKeyPath: easJson?.submit?.production?.ios?.ascApiKeyPath || '',
    ascAppId: easJson?.submit?.production?.ios?.ascAppId || '',
    ascApiKeyId: easJson?.submit?.production?.ios?.ascApiKeyId || '',
    ascApiKeyIssuerId: easJson?.submit?.production?.ios?.ascApiKeyIssuerId || '',
    googlePlayServiceAccountKeyPath: easJson?.submit?.production?.android?.serviceAccountKeyPath || '',
    googlePlayTrack: easJson?.submit?.production?.android?.track || '',
  };

  // --- NOTES.md (optional buyer notes file at project root) ---
  let notesMd = null;
  try {
    if (fileExists(PATHS.notesMd)) notesMd = fs.readFileSync(PATHS.notesMd, 'utf8');
  } catch {}

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
    dependencies,
    devDependencies,
    easCredentials,
    notesMd,
  };
}

/**
 * Walk modules/ and return [{rel, data}] for every buyer file.
 * Skips _*.ts core files (registry, types). Single walk used by createIdentityZip.
 */
function readModuleFiles() {
  const out = [];
  if (!fileExists(PATHS.modulesDir)) return out;
  const walk = (dir, relBase) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('_')) continue;
      const full = path.join(dir, entry.name);
      const rel = relBase ? relBase + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile()) out.push({ rel, data: fs.readFileSync(full) });
    }
  };
  walk(PATHS.modulesDir, '');
  return out;
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

  // Bundle every file under modules/ (single walk, no double-traverse)
  for (const { rel, data } of readModuleFiles()) {
    files.push({ path: 'modules/' + rel, data });
  }

  // Bundle NOTES.md if present
  if (identity.notesMd !== null && identity.notesMd !== undefined) {
    files.push({ path: 'NOTES.md', data: Buffer.from(identity.notesMd) });
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

  // Merge buyer's package.json deps into the (presumably fresh) project package.json.
  // On parse failure, surface a warning in the result so the buyer knows their extras may be lost.
  let depsMerged = 0;
  let depsMergeWarning = null;
  if (identity.dependencies || identity.devDependencies) {
    try {
      const pkgJson = readJsonSafe(PATHS.packageJson) || {};
      for (const section of ['dependencies', 'devDependencies']) {
        const incoming = identity[section];
        if (!incoming) continue;
        pkgJson[section] = pkgJson[section] || {};
        for (const [k, v] of Object.entries(incoming)) {
          if (pkgJson[section][k] !== v) { pkgJson[section][k] = v; depsMerged++; }
        }
      }
      if (depsMerged > 0) {
        fs.writeFileSync(PATHS.packageJson, JSON.stringify(pkgJson, null, 2) + '\n');
      }
    } catch (err) {
      depsMergeWarning = 'Could not merge package.json deps: ' + err.message;
    }
  }

  // Restore EAS credentials into eas.json
  let easRestored = false;
  if (identity.easCredentials) {
    try {
      const easJson = readJsonSafe(PATHS.easJson);
      if (easJson) {
        const c = identity.easCredentials;
        if (!easJson.submit) easJson.submit = {};
        if (!easJson.submit.production) easJson.submit.production = {};
        const ios = easJson.submit.production.ios = easJson.submit.production.ios || {};
        if (c.appleId) ios.appleId = c.appleId;
        if (c.ascAppId) ios.ascAppId = c.ascAppId;
        if (c.ascApiKeyPath) ios.ascApiKeyPath = c.ascApiKeyPath;
        if (c.ascApiKeyId) ios.ascApiKeyId = c.ascApiKeyId;
        if (c.ascApiKeyIssuerId) ios.ascApiKeyIssuerId = c.ascApiKeyIssuerId;
        const android = easJson.submit.production.android = easJson.submit.production.android || {};
        if (c.googlePlayServiceAccountKeyPath) android.serviceAccountKeyPath = c.googlePlayServiceAccountKeyPath;
        if (c.googlePlayTrack) android.track = c.googlePlayTrack;
        fs.writeFileSync(PATHS.easJson, JSON.stringify(easJson, null, 2) + '\n');
        easRestored = true;
      }
    } catch { /* eas.json missing or invalid */ }
  }

  // Restore modules/ folder files (path-traversal guarded)
  let modulesRestored = 0;
  for (const file of files) {
    if (!file.path.startsWith('modules/')) continue;
    const rel = file.path.slice('modules/'.length);
    if (!rel || rel.includes('..')) continue;
    const dest = path.resolve(PATHS.modulesDir, rel);
    if (dest !== PATHS.modulesDir && !dest.startsWith(PATHS.modulesDir + path.sep)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.data);
    modulesRestored++;
  }

  // Restore NOTES.md if present in zip
  let notesRestored = false;
  const notesEntry = files.find(f => f.path === 'NOTES.md');
  if (notesEntry) {
    fs.writeFileSync(PATHS.notesMd, notesEntry.data);
    notesRestored = true;
  }

  return {
    ok: true,
    configResults: writeResults,
    registryRestored,
    assetsRestored,
    credentialsRestored,
    depsMerged,
    depsMergeWarning,
    easRestored,
    modulesRestored,
    notesRestored,
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
