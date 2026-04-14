'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const { PROJECT_DIR, PATHS, VALID_PLATFORMS, VALID_PROFILES, BUILD_ID_PATTERN } = require('./paths');
const { readJsonSafe, fileExists } = require('./file-utils');

/** Env override for EAS commands when the project has no git repo.
 *  EAS CLI otherwise prompts the user to run `git init`, which hangs
 *  any non-TTY call (dashboard HTTP handlers). Returns undefined when
 *  git IS present so EAS uses its normal VCS flow.
 *  Deliberately NOT memoized — git state can toggle during a dashboard
 *  session (snapshot, git init, .git deletion), and a stale cache here
 *  causes every subsequent EAS call to hang on the git init prompt until
 *  the dashboard is restarted. fs.stat is cheap; just check every call. */
function getEasVcsEnv() {
  return fileExists(path.join(PROJECT_DIR, '.git')) ? undefined : { EAS_NO_VCS: '1' };
}

/** Diagnose EAS CLI errors — checks if eas is installed and logged in */
async function diagnoseEasError(originalError) {
  try { await runCommand(['eas', '--version'], 5000); }
  catch { return { ok: false, error: 'EAS CLI not installed. Run: npm install -g eas-cli' }; }
  try { await runCommand(['eas', 'whoami'], 5000); }
  catch { return { ok: false, error: 'Not logged into EAS. Run: eas login' }; }
  return { ok: false, error: originalError.message };
}

/** Run a command asynchronously. With raw: true, returns { stdout, stderr, code } instead of rejecting on non-zero exit.
 *  onSpawn(child) lets the caller hold the child handle (e.g. to kill it on HTTP disconnect). */
function runCommand(args, timeout = 30000, { env, raw = false, onSpawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(args.join(' '), [], {
      cwd: PROJECT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      shell: true,
      windowsHide: true,
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    if (onSpawn) onSpawn(child);
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      if (raw) resolve({ stdout, stderr, code });
      else if (code === 0) resolve(stdout);
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

/** Start an EAS build and await the result. Returns success, or failure with full output + fix hint.
 *  onSpawn(child) lets the caller kill the subprocess if the HTTP client disconnects mid-build. */
async function startEasBuild(platform, profile, { onSpawn } = {}) {
  if (!VALID_PLATFORMS.includes(platform)) return { ok: false, error: 'Invalid platform' };
  if (!VALID_PROFILES.includes(profile)) return { ok: false, error: 'Invalid profile' };
  const env = getEasVcsEnv();
  try {
    // --no-wait: return immediately after the upload is queued on EAS, instead of blocking until the
    // build itself finishes (which can take hours). The dashboard polls EAS via loadBuilds() for status.
    const { stdout, stderr, code } = await runCommand(
      ['eas', 'build', '--platform', platform, '--profile', profile, '--non-interactive', '--no-wait', '--json'],
      300000,
      { env, raw: true, onSpawn }
    );
    const fullOutput = (stdout + (stderr ? '\n' + stderr : '')).trim();
    if (code === 0) {
      try { return { ok: true, result: JSON.parse(stdout) }; }
      catch { return { ok: true, result: null, fullOutput }; }
    }
    // iOS credentials is the only fix hint with a UI flow today; everything else routes through
    // diagnoseEasError so the user gets a CLI/login-aware message.
    if (/Failed to set up credentials|couldn't find any credentials/i.test(fullOutput)) {
      return { ok: false, error: "iOS credentials aren't set up yet", fullOutput, fixHint: 'iosCredentials' };
    }
    const diag = await diagnoseEasError(new Error(fullOutput));
    return { ok: false, error: diag.error, fullOutput, fixHint: null };
  } catch (err) {
    return { ok: false, error: err.message, fullOutput: err.message, fixHint: null };
  }
}

/** Submit a build to store — dashboard is just a launcher, user checks status on EAS */
async function submitBuild(platform, buildId) {
  if (!VALID_PLATFORMS.includes(platform)) return { ok: false, error: 'Invalid platform' };
  if (!BUILD_ID_PATTERN.test(buildId)) return { ok: false, error: 'Invalid build ID format' };
  try {
    const { stdout, stderr, code } = await runCommand(
      ['eas', 'submit', '--platform', platform, '--id', buildId, '--no-wait', '--non-interactive'],
      120000,
      { raw: true }
    );
    const combined = (stdout + '\n' + stderr).trim();
    console.log('  [eas submit output]\n' + combined.split('\n').map(l => '    ' + l).join('\n'));
    const urlMatch = combined.match(/Submission details:\s*(https:\/\/\S+)/);
    if (code !== 0 && !urlMatch) {
      return { ok: false, error: combined || 'Submit exited with code ' + code };
    }
    return { ok: true, submissionUrl: urlMatch ? urlMatch[1] : '' };
  } catch (err) {
    console.log('  [eas submit error] ' + err.message);
    return { ok: false, error: 'Failed to start submission: ' + err.message };
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
function saveSubmission(buildId, platform, submissionUrl) {
  fs.mkdirSync(PATHS.logsDir, { recursive: true });
  const subs = getSubmissions();
  subs[buildId] = { platform, date: new Date().toISOString(), ...(submissionUrl ? { submissionUrl } : {}) };
  fs.writeFileSync(PATHS.submissionsLog, JSON.stringify(subs, null, 2));
}

/** Build the EAS submissions list URL from app.json owner + slug */
function getSubmissionsUrl() {
  const appJson = readJsonSafe(PATHS.appJson);
  const owner = appJson?.expo?.owner;
  const slug = appJson?.expo?.slug;
  if (owner && slug) return `https://expo.dev/accounts/${owner}/projects/${slug}/submissions`;
  return '';
}

/** Validate that an artifact URL points at an EAS-owned host.
 *  EAS serves builds from expo.dev, which 302-redirects to CloudFront/S3.
 *  Redirects are followed by the caller, so we only validate the initial host. */
function validateEasArtifactUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch { return { ok: false, error: 'Invalid URL' }; }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'URL must be https' };
  const host = parsed.hostname;
  const allowed =
    host === 'expo.dev' ||
    host.endsWith('.expo.dev') ||
    host.endsWith('.cloudfront.net') ||
    host.endsWith('.amazonaws.com');
  if (!allowed) return { ok: false, error: 'Host not allowed: ' + host };
  return { ok: true };
}

/** Stream an EAS artifact through to the HTTP response with a custom filename.
 *  Follows redirects (EAS → CloudFront). Pipes bytes straight through — no
 *  buffering, so multi-hundred-MB .aab/.ipa files work fine. */
function streamEasArtifact(rawUrl, filename, res, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) { reject(new Error('Too many redirects')); return; }
    const mod = rawUrl.startsWith('https') ? https : http;
    const upstream = mod.get(rawUrl, { timeout: 30_000 }, (up) => {
      if ([301, 302, 307, 308].includes(up.statusCode) && up.headers.location) {
        up.resume();
        resolve(streamEasArtifact(up.headers.location, filename, res, redirects + 1));
        return;
      }
      if (up.statusCode !== 200) {
        res.writeHead(up.statusCode || 502, { 'Content-Type': 'text/plain' });
        res.end('Upstream error: ' + up.statusCode);
        up.resume();
        resolve();
        return;
      }
      const headers = {
        'Content-Type': up.headers['content-type'] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      };
      if (up.headers['content-length']) headers['Content-Length'] = up.headers['content-length'];
      res.writeHead(200, headers);
      // Abort upstream if the client disconnects, otherwise Node keeps pulling
      // the full artifact from the CDN into the void after the browser cancels.
      res.on('close', () => upstream.destroy());
      up.pipe(res);
      up.on('end', resolve);
      up.on('error', reject);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Upstream timeout')));
    upstream.on('error', reject);
  });
}

module.exports = { diagnoseEasError, runCommand, getEasVcsEnv, getEasBuilds, startEasBuild, submitBuild, cancelBuild, getSubmissions, saveSubmission, getSubmissionsUrl, validateEasArtifactUrl, streamEasArtifact };
