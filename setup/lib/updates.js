'use strict';

const fs = require('fs');
const path = require('path');
const { PROJECT_DIR, PATHS, BACKUP_EXCLUDES } = require('./paths');
const { readJsonSafe, getSiteUrl } = require('./file-utils');
const { httpsRequest, parseZip } = require('./http-helpers');

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
  return readJsonSafe(PATHS.manifest) || { version: '0.0.0', buyerFiles: [], hybridFiles: [] };
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
// Update System — Backup & Restore
// ---------------------------------------------------------------------------

/** Recursively copy a directory, skipping excluded paths */
function copyDirRecursive(src, dest, excludes, baseDir) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relPath = path.relative(baseDir, srcPath).replace(/\\/g, '/');

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
      const ts = parts ? parseInt(parts[2]) : fs.statSync(path.join(PATHS.backupsDir, d.name)).mtimeMs;
      return {
        id: d.name,
        version: parts ? parts[1] : d.name,
        timestamp: ts,
        date: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        sizeMB: '?',
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  // Read cached sizes and app version from each backup
  for (const backup of dirs) {
    try {
      const sizeFile = path.join(PATHS.backupsDir, backup.id, '.size');
      const totalSize = fs.existsSync(sizeFile)
        ? parseInt(fs.readFileSync(sizeFile, 'utf8'), 10)
        : getDirSize(path.join(PATHS.backupsDir, backup.id));
      backup.sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    } catch { backup.sizeMB = '?'; }
    const appJson = readJsonSafe(path.join(PATHS.backupsDir, backup.id, 'app.json'));
    backup.appVersion = appJson?.expo?.version || '';
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

  // Copy all files from backup to project root, overwriting (skip .size cache file)
  copyDirRecursive(backupDir, PROJECT_DIR, ['.size'], backupDir);
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
 * Check if a file path matches a buyer-owned file or directory.
 * Buyer files are never overwritten during updates.
 */
function isBuyerFile(filePath, buyerFiles) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const p of buyerFiles) {
    if (p.endsWith('/')) {
      if (normalized.startsWith(p) || normalized === p.slice(0, -1)) return true;
    } else {
      if (normalized === p) return true;
    }
  }
  return false;
}

/**
 * Apply a core update from a ZIP buffer.
 *
 * Identity-preserving flow:
 *   1. Auto-export buyer identity (config values, assets, credentials, module imports)
 *   2. Extract all files from zip (skip buyer-owned files, write hybrid + core files)
 *   3. Update manifest.json version
 *   4. Restore buyer identity into fresh hybrid files
 *   5. Clean up temp identity file
 *
 * Returns { filesWritten, filesSkipped, dashboardUpdated, newVersion }
 */
function applyUpdateFromZip(zipBuffer) {
  const identity = require('./identity');
  const manifest = readManifest();
  const buyerFiles = manifest.buyerFiles || [];

  const files = parseZip(zipBuffer);

  // --- Step 1: Auto-export identity BEFORE any writes ---
  let savedIdentity;
  try {
    savedIdentity = identity.createIdentityZip();
  } catch (err) {
    throw new Error('Failed to capture buyer identity before update: ' + err.message);
  }

  let filesWritten = 0;
  let filesSkipped = 0;
  let dashboardUpdated = false;
  let newVersion = null;

  const updateManifest = files.find((f) => f.path === 'manifest.json');

  // --- Step 2: Extract files ---
  for (const file of files) {
      const relPath = file.path;

      if (relPath.endsWith('/')) continue;
      if (relPath === 'manifest.json') continue;

      // Dashboard self-update
      if (relPath === 'setup/dashboard.js') {
        const destPath = path.join(PROJECT_DIR, 'setup', 'dashboard.next.js');
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, file.data);
        dashboardUpdated = true;
        filesWritten++;
        continue;
      }

      // Skip buyer-owned files (never touched)
      if (isBuyerFile(relPath, buyerFiles)) {
        filesSkipped++;
        continue;
      }

      // Path traversal guard
      const destPath = path.resolve(PROJECT_DIR, relPath);
      if (!destPath.startsWith(PROJECT_DIR + path.sep) && destPath !== PROJECT_DIR) {
        filesSkipped++;
        continue;
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, file.data);
      filesWritten++;
    }

    // --- Step 3: Update manifest.json version ---
    if (updateManifest) {
      try {
        const um = JSON.parse(updateManifest.data.toString());
        if (um.version) {
          newVersion = um.version;
          const localManifest = readManifest();
          localManifest.version = um.version;
          if (um.dashboardVersion) localManifest.dashboardVersion = um.dashboardVersion;
          if (um.buyerFiles) localManifest.buyerFiles = um.buyerFiles;
          if (um.hybridFiles) localManifest.hybridFiles = um.hybridFiles;
          fs.writeFileSync(PATHS.manifest, JSON.stringify(localManifest, null, 2) + '\n');
        }
      } catch { /* ignore */ }
    }

    // --- Step 4: Restore buyer identity ---
    const restoreResult = identity.applyIdentityZip(savedIdentity);
    if (!restoreResult.ok) {
      throw new Error('Identity restore failed: ' + restoreResult.error);
    }

  return { filesWritten, filesSkipped, dashboardUpdated, newVersion };
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
  createBackup,
  listBackups,
  restoreFromBackup,
  deleteBackup,
  pruneBackups,
  applyUpdateFromZip,
  downloadUpdate,
};
