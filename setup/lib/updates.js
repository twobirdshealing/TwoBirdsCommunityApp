'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PROJECT_DIR, PATHS, BACKUP_EXCLUDES } = require('./paths');
const { readJsonSafe, getSiteUrl } = require('./file-utils');
const { httpsRequest, parseTar } = require('./http-helpers');

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
      const ts = parts ? parseInt(parts[2]) : fs.statSync(path.join(PATHS.backupsDir, d.name)).mtimeMs;
      return {
        id: d.name,
        version: parts ? parts[1] : d.name,
        timestamp: ts,
        date: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
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

  for (const key of ['dependencies', 'devDependencies']) {
    if (!depChanges[key]) continue;
    if (!pkg[key]) pkg[key] = {};
    for (const [name, version] of Object.entries(depChanges[key])) {
      if (version === null) {
        if (pkg[key][name]) { delete pkg[key][name]; changed = true; }
      } else if (pkg[key][name] !== version) {
        pkg[key][name] = version;
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
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  isUpdateInProgress,
  setUpdateInProgress,
  readLicense,
  writeLicense,
  readManifest,
  validateLicense,
  deactivateLicense,
  createBackup,
  listBackups,
  restoreFromBackup,
  deleteBackup,
  pruneBackups,
  applyUpdateFromTar,
  downloadUpdate,
};
