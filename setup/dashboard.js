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
//   - Push OTA updates to users
//   - Manage modules (install, toggle, remove, export)
// =============================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
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
// Load modules
// ---------------------------------------------------------------------------

const { PROJECT_DIR, PORT, PATHS, VALID_PLATFORMS, VALID_PROFILES, BUILD_ID_PATTERN, BACKUP_ID_PATTERN, isPlaceholder } = require('./lib/paths');
const { fileExists, readJsonSafe, getSiteUrl } = require('./lib/file-utils');
const { readProjectState } = require('./lib/state');
const { writeConfigValues } = require('./lib/config-writer');
const { checkConnectivity, parseMultipart, httpsRequest } = require('./lib/http-helpers');
const { runCommand, getEasBuilds, startEasBuild, submitBuild, cancelBuild, getSubmissions, saveSubmission } = require('./lib/eas');
const { getOTAStatus, pushOTAUpdate, listOTAUpdates, deleteOTAUpdate } = require('./lib/ota');
const { getInstalledModules, toggleModule, removeModule, exportModule, importModule } = require('./lib/modules');
const {
  readLicense, writeLicense, readManifest, validateLicense, deactivateLicense,
  createBackup, listBackups, restoreFromBackup, deleteBackup, pruneBackups,
  applyUpdateFromTar, downloadUpdate, isUpdateInProgress, setUpdateInProgress,
} = require('./lib/updates');

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let installProcess = { status: 'idle', output: '', exitCode: null };
let lastHeartbeat = Date.now();

// ---------------------------------------------------------------------------
// Load frontend HTML
// ---------------------------------------------------------------------------

const dashboardHTML = fs.readFileSync(path.join(__dirname, 'frontend', 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

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
// Auto-shutdown: stop the server if no browser heartbeat for 5 minutes
// ---------------------------------------------------------------------------

const HEARTBEAT_TIMEOUT = 5 * 60 * 1000;
const heartbeatCheck = setInterval(() => {
  if (Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT) {
    console.log('\n  No browser connection for 5 minutes — shutting down.');
    process.exit(0);
  }
}, 30000);

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // --- System ---
    if (pathname === '/api/heartbeat' && req.method === 'GET') {
      lastHeartbeat = Date.now();
      jsonResponse(res, { ok: true });
      return;
    }

    if (pathname === '/api/shutdown' && req.method === 'POST') {
      jsonResponse(res, { ok: true });
      console.log('\n  Dashboard stopped via browser.');
      setTimeout(() => process.exit(0), 500);
      return;
    }

    // --- Config ---
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

    // --- EAS CLI ---
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
        const freshExpo = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'app.json'), 'utf8'));
        const newOwner = (freshExpo.expo && freshExpo.expo.owner) || '';
        const newProjectId = (freshExpo.expo && freshExpo.expo.extra && freshExpo.expo.extra.eas && freshExpo.expo.extra.eas.projectId) || '';
        jsonResponse(res, { ok: true, owner: newOwner, projectId: newProjectId, output: initOutput });
      } catch (e) {
        jsonResponse(res, { ok: false, error: e.stderr || e.message });
      }
      return;
    }

    // --- Modules ---
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

    // --- Builds ---
    if (pathname === '/api/builds' && req.method === 'GET') {
      const result = await getEasBuilds();
      jsonResponse(res, result);
      return;
    }

    if (pathname === '/api/builds/new' && req.method === 'POST') {
      const body = await readBody(req);
      const { platform, profile } = JSON.parse(body);
      if (!platform || !profile) { jsonResponse(res, { ok: false, error: 'Missing platform or profile' }, 400); return; }
      if (!VALID_PLATFORMS.includes(platform)) { jsonResponse(res, { ok: false, error: 'Invalid platform' }, 400); return; }
      if (!VALID_PROFILES.includes(profile)) { jsonResponse(res, { ok: false, error: 'Invalid profile' }, 400); return; }
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
      const { channel, message, platform } = JSON.parse(body);
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
      const { groupId } = JSON.parse(body);
      console.log(`  Deleting OTA update group ${groupId}...`);
      const result = await deleteOTAUpdate(groupId || '');
      jsonResponse(res, result);
      return;
    }

    // --- File Uploads ---
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

    // --- Updates: Apply ---
    if (pathname === '/api/updates/apply' && req.method === 'POST') {
      if (isUpdateInProgress()) { jsonResponse(res, { error: 'An update is already in progress' }, 409); return; }
      const body = JSON.parse(await readBody(req));
      const downloadUrl = body.downloadUrl;
      if (!downloadUrl) { jsonResponse(res, { error: 'No download URL provided' }, 400); return; }

      setUpdateInProgress(true);
      try {
        const manifest = readManifest();
        const backup = createBackup(manifest.version);
        const key = readLicense();
        const tarGzBuffer = await downloadUpdate(downloadUrl, key);
        const result = applyUpdateFromTar(tarGzBuffer);
        pruneBackups(3);
        jsonResponse(res, { ok: true, backup: backup.label, ...result });
      } catch (err) {
        jsonResponse(res, { error: 'Update failed: ' + err.message }, 500);
      } finally {
        setUpdateInProgress(false);
      }
      return;
    }

    // --- Updates: Manual upload ---
    if (pathname === '/api/updates/upload' && req.method === 'POST') {
      if (isUpdateInProgress()) { jsonResponse(res, { error: 'An update is already in progress' }, 409); return; }
      setUpdateInProgress(true);
      try {
        const parts = await parseMultipart(req);
        const filePart = parts.find((p) => p.filename);
        if (!filePart) { jsonResponse(res, { error: 'No file uploaded' }, 400); return; }

        const manifest = readManifest();
        const backup = createBackup(manifest.version);

        let tarGzBuffer = filePart.data;
        const filename = (filePart.filename || '').toLowerCase();
        if (filename.endsWith('.zip')) {
          jsonResponse(res, { error: 'ZIP format not supported yet. Please upload a .tar.gz file.' }, 400);
          return;
        }

        const result = applyUpdateFromTar(tarGzBuffer);
        pruneBackups(3);
        jsonResponse(res, { ok: true, backup: backup.label, ...result });
      } catch (err) {
        jsonResponse(res, { error: 'Upload update failed: ' + err.message }, 500);
      } finally {
        setUpdateInProgress(false);
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
      if (!BACKUP_ID_PATTERN.test(backupId)) { jsonResponse(res, { error: 'Invalid backup ID' }, 400); return; }
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

    // --- Dashboard HTML ---
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

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

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
