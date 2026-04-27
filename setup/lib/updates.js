'use strict';

const fs = require('fs');
const path = require('path');
const { PROJECT_DIR, PATHS } = require('./paths');
const { readJsonSafe, getSiteUrl } = require('./file-utils');
const { httpsRequest, parseZip } = require('./http-helpers');
const identity = require('./identity');

// ---------------------------------------------------------------------------
// Concurrency guard — prevent overlapping update operations
// ---------------------------------------------------------------------------

let _updateInProgress = false;

function isUpdateInProgress() { return _updateInProgress; }
function setUpdateInProgress(v) { _updateInProgress = v; }

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
  return readJsonSafe(PATHS.manifest) || { version: '0.0.0' };
}

// ---------------------------------------------------------------------------
// Module Licenses
// ---------------------------------------------------------------------------

const MODULE_LICENSES_PATH = path.join(PROJECT_DIR, 'setup', '.module-licenses.json');

function readModuleLicenses() {
  return readJsonSafe(MODULE_LICENSES_PATH) || {};
}

function writeModuleLicense(moduleId, key) {
  const licenses = readModuleLicenses();
  licenses[moduleId] = key.trim();
  fs.mkdirSync(path.dirname(MODULE_LICENSES_PATH), { recursive: true });
  fs.writeFileSync(MODULE_LICENSES_PATH, JSON.stringify(licenses, null, 2) + '\n');
}

function removeModuleLicense(moduleId) {
  const licenses = readModuleLicenses();
  delete licenses[moduleId];
  fs.writeFileSync(MODULE_LICENSES_PATH, JSON.stringify(licenses, null, 2) + '\n');
}

/**
 * Validate license key against the update server.
 * Returns the server response JSON or { valid: false, error: '...' }.
 */
async function validateLicense(key) {
  const manifest = readManifest();
  const updateUrl = manifest.updateUrl;
  if (!updateUrl) return { valid: false, error: 'No update URL configured in manifest.json' };

  // Build installed modules list with their license keys
  const moduleLicenses = readModuleLicenses();
  const { getInstalledModules } = require('./modules');
  const installedModules = getInstalledModules()
    .filter(m => moduleLicenses[m.id])
    .map(m => ({ id: m.id, version: m.version || '0.0.0', licenseKey: moduleLicenses[m.id] }));

  try {
    const res = await httpsRequest(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey: key,
        currentVersion: manifest.version,
        product: manifest.product || 'tbc-community-app',
        siteUrl: getSiteUrl(readJsonSafe(PATHS.easJson)) || '',
        installedModules,
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
// Update System — Apply Update (manifest-driven clean install)
// ---------------------------------------------------------------------------
//
// Flow:
//   1. Capture identity to OS temp dir (outside project, untouchable)
//   2. Read setup/.core-files.json — the list of files the current core shipped.
//      Delete each one. Then walk affected parent dirs and remove any that
//      are now empty. (Bootstrap path: if the manifest is missing on first
//      update from this system, skip step 2 and just extract over.)
//   3. Extract the new core zip wholesale into the project. Every file lands
//      fresh, including the new setup/.core-files.json baked into the zip.
//   4. Apply identity from the temp zip — writes user files (assets,
//      credentials, modules, NOTES.md) and injects hybrid file values
//      (28 config values, deps merge, eas credentials).
//
// Files the buyer owns (.git, node_modules, NOTES.md, custom modules,
// reference docs, .env, anything they put at the project root) are never
// touched because they're not in setup/.core-files.json.
// ---------------------------------------------------------------------------

/** Path-traversal guard: returns true if abs resolves inside PROJECT_DIR. */
function isUnderProjectDir(abs) {
  return abs === PROJECT_DIR || abs.startsWith(PROJECT_DIR + path.sep);
}

/** Delete files listed in the previous core's manifest, then prune empty parent dirs. */
function deletePreviousCoreFiles(manifestList) {
  if (!Array.isArray(manifestList)) return { deleted: 0, dirsRemoved: 0 };
  let deleted = 0;
  const affectedDirs = new Set();
  for (const rel of manifestList) {
    if (typeof rel !== 'string' || !rel || rel.includes('..')) continue;
    const abs = path.resolve(PROJECT_DIR, rel);
    if (!isUnderProjectDir(abs)) continue;
    try {
      fs.rmSync(abs, { force: true });
      deleted++;
      let parent = path.dirname(abs);
      while (parent !== PROJECT_DIR && isUnderProjectDir(parent)) {
        affectedDirs.add(parent);
        parent = path.dirname(parent);
      }
    } catch { /* skip files we can't delete (open handles, permission) */ }
  }
  // Sort by true depth (segment count) so deepest dirs collapse first
  const sortedDirs = Array.from(affectedDirs)
    .sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
  let dirsRemoved = 0;
  for (const dir of sortedDirs) {
    try { fs.rmdirSync(dir); dirsRemoved++; } catch { /* not empty or already gone */ }
  }
  return { deleted, dirsRemoved };
}

function applyUpdateFromZip(zipBuffer) {
  const files = parseZip(zipBuffer);

  // --- Step 1: Capture identity to temp BEFORE any project mutation ---
  let identityTempPath;
  try {
    identityTempPath = identity.saveIdentityTemp(identity.createIdentityZip());
  } catch (err) {
    throw new Error('Failed to capture identity before update: ' + err.message);
  }

  const recoveryHint = ' — your identity snapshot is at ' + identityTempPath +
    ' (import it manually from the Snapshot tab to recover)';

  // --- Step 2: Manifest-driven cleanup of previous core files ---
  // Bootstrap path: no manifest yet (first update from this system), skip cleanup
  // — the new zip's manifest becomes the baseline for next update.
  let cleanupStats = { deleted: 0, dirsRemoved: 0 };
  try {
    const prevManifest = readJsonSafe(PATHS.coreFilesManifest);
    if (prevManifest) cleanupStats = deletePreviousCoreFiles(prevManifest);
  } catch (err) {
    throw new Error('Cleanup failed: ' + err.message + recoveryHint);
  }

  // --- Step 3: Extract new core zip wholesale ---
  let filesWritten = 0;
  let filesSkipped = 0;
  let newVersion = null;

  try {
    for (const file of files) {
      const relPath = file.path;
      if (relPath.endsWith('/')) continue;

      const destPath = path.resolve(PROJECT_DIR, relPath);
      if (!isUnderProjectDir(destPath)) { filesSkipped++; continue; }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, file.data);
      filesWritten++;

      // Read the new version directly from the manifest entry (avoids a re-read from disk)
      if (relPath === 'manifest.json') {
        try { newVersion = JSON.parse(file.data.toString()).version || null; } catch {}
      }
    }
  } catch (err) {
    throw new Error('Extract failed: ' + err.message + recoveryHint);
  }

  // --- Step 4: Snapshot the new core's package.json as the baseline for next snapshot's deps diff ---
  // Done BEFORE identity restore so the baseline reflects what core just shipped, before
  // buyer's added deps get merged in.
  try {
    const freshPkgJson = readJsonSafe(PATHS.packageJson);
    if (freshPkgJson) {
      fs.writeFileSync(PATHS.corePackageJson, JSON.stringify(freshPkgJson, null, 2) + '\n');
    }
  } catch { /* baseline is best-effort — missing it just means next snapshot captures full deps */ }

  // --- Step 5: Apply identity from the temp zip ---
  let restoreResult;
  try {
    restoreResult = identity.applyIdentityZip(identity.loadIdentityTemp(identityTempPath));
    if (!restoreResult.ok) throw new Error(restoreResult.error || 'unknown error');
  } catch (err) {
    throw new Error('Identity restore failed: ' + err.message + recoveryHint);
  }

  identity.cleanupIdentityTemp(identityTempPath);

  return { filesWritten, filesSkipped, newVersion, cleanupStats, restoreResult };
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
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  isUpdateInProgress,
  setUpdateInProgress,
  readLicense,
  writeLicense,
  readManifest,
  readModuleLicenses,
  writeModuleLicense,
  removeModuleLicense,
  validateLicense,
  deactivateLicense,
  applyUpdateFromZip,
  downloadUpdate,
};
