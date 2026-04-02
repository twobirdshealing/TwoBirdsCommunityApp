'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { PROJECT_DIR, PATHS, VALID_PLATFORMS, VALID_PROFILES, BUILD_ID_PATTERN } = require('./paths');
const { readJsonSafe, fileExists } = require('./file-utils');

/** Diagnose EAS CLI errors — checks if eas is installed and logged in */
async function diagnoseEasError(originalError) {
  try { await runCommand(['eas', '--version'], 5000); }
  catch { return { ok: false, error: 'EAS CLI not installed. Run: npm install -g eas-cli' }; }
  try { await runCommand(['eas', 'whoami'], 5000); }
  catch { return { ok: false, error: 'Not logged into EAS. Run: eas login' }; }
  return { ok: false, error: originalError.message };
}

/** Run a command asynchronously (doesn't block the server) */
function runCommand(args, timeout = 30000, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(args.join(' '), [], {
      cwd: PROJECT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      shell: true,
      windowsHide: true,
      ...(env ? { env: { ...process.env, ...env } } : {}),
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
  // Auto-detect git — if no repo, tell EAS to skip VCS and use .easignore instead
  const hasGit = fileExists(path.join(PROJECT_DIR, '.git'));
  const env = hasGit ? undefined : { EAS_NO_VCS: '1' };
  try {
    const output = await runCommand(
      ['eas', 'build', '--platform', platform, '--profile', profile, '--non-interactive', '--json'],
      300000,
      env
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

module.exports = { diagnoseEasError, runCommand, getEasBuilds, startEasBuild, submitBuild, cancelBuild, getSubmissions, saveSubmission };
