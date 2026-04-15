'use strict';

const { PATHS, VALID_OTA_CHANNELS, VALID_OTA_PLATFORMS, OTA_GROUP_ID_PATTERN } = require('./paths');
const { readJsonSafe } = require('./file-utils');
const { runCommand, diagnoseEasError, getEasVcsEnv } = require('./eas');

/** Check if OTA updates are properly configured */
async function getOTAStatus() {
  const appJson = readJsonSafe(PATHS.appJson);
  const easJson = readJsonSafe(PATHS.easJson);
  const pkgJson = readJsonSafe(PATHS.packageJson);
  const expo = appJson?.expo || {};

  // Check channels in eas.json (local config)
  const channels = {};
  if (easJson?.build) {
    for (const [profile, config] of Object.entries(easJson.build)) {
      channels[profile] = config.channel || null;
    }
  }

  // Check if channels exist on EAS (created after first build)
  let liveChannels = [];
  try {
    const output = await runCommand(['eas', 'channel:list', '--json', '--non-interactive'], 15000);
    const parsed = JSON.parse(output);
    liveChannels = (parsed?.currentPage || []).map(c => c.name);
  } catch (_) {}

  return {
    channels,
    liveChannels,
    hasBuilt: liveChannels.length > 0,
    currentVersion: expo.version || '',
  };
}

/** Push an OTA update via eas update */
async function pushOTAUpdate(channel, message, platform) {
  if (!VALID_OTA_CHANNELS.includes(channel)) return { ok: false, error: 'Invalid channel' };
  if (!VALID_OTA_PLATFORMS.includes(platform)) return { ok: false, error: 'Invalid platform' };
  if (!message || typeof message !== 'string' || message.length > 500) return { ok: false, error: 'Message is required (max 500 chars)' };

  // `--environment` selects which EAS env-var group is baked into the published bundle.
  // It must be one of: development, preview, production. For this project, channel names
  // match env names 1:1, so we forward channel as environment. If a buyer ever adds a
  // channel with a non-standard name, fall back to 'production'.
  const VALID_ENVS = ['development', 'preview', 'production'];
  const environment = VALID_ENVS.includes(channel) ? channel : 'production';
  const args = ['eas', 'update', '--branch', channel, '--environment', environment, '--message', JSON.stringify(message), '--non-interactive'];
  if (platform !== 'all') {
    args.push('--platform', platform);
  }
  try {
    args.push('--json');
    const output = await runCommand(args, 300000, { env: getEasVcsEnv() });
    try {
      const parsed = JSON.parse(output);
      const items = Array.isArray(parsed) ? parsed : [];
      const first = items[0] || {};
      return {
        ok: true,
        runtimeVersion: first.runtimeVersion || null,
        platforms: items.map(i => i.platform).filter(Boolean),
        group: first.group || null,
        gitCommit: first.gitCommitHash || null,
      };
    } catch (_) {
      return { ok: true };
    }
  } catch (err) {
    return diagnoseEasError(err);
  }
}

/** Collapse per-platform update rows into one entry per `group` id. */
function groupUpdates(raw) {
  const list = Array.isArray(raw) ? raw : (raw?.currentPage || []);
  const byGroup = new Map();
  for (const u of list) {
    const key = u.group || u.id;
    if (!key) continue;
    if (!byGroup.has(key)) {
      byGroup.set(key, {
        group: u.group || u.id,
        id: u.id,
        branch: u.branch?.name || u.branch || u.branchName || null,
        runtimeVersion: u.runtimeVersion || null,
        message: u.message || '',
        createdAt: u.createdAt || u.updatedAt || null,
        gitCommitHash: u.gitCommitHash || null,
        isRollBackToEmbedded: !!u.isRollBackToEmbedded,
        platforms: [],
      });
    }
    const entry = byGroup.get(key);
    if (u.platform && !entry.platforms.includes(u.platform)) entry.platforms.push(u.platform);
    // Prefer the earliest createdAt we see (they should all match anyway)
    if (u.createdAt && (!entry.createdAt || new Date(u.createdAt) < new Date(entry.createdAt))) {
      entry.createdAt = u.createdAt;
    }
  }
  const sorted = Array.from(byGroup.values()).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
  // Tag the newest non-empty entry per branch as currently serving.
  const seenBranches = new Set();
  for (const entry of sorted) {
    if (!entry.branch) continue;
    if (!seenBranches.has(entry.branch)) {
      entry.isServing = true;
      seenBranches.add(entry.branch);
    }
  }
  return sorted;
}

/** List recent OTA updates (grouped by push). */
async function listOTAUpdates() {
  try {
    const output = await runCommand(['eas', 'update:list', '--all', '--json', '--non-interactive'], 30000);
    const parsed = JSON.parse(output);
    const updates = groupUpdates(parsed);
    const runtimeVersions = Array.from(new Set(updates.map(u => u.runtimeVersion).filter(Boolean)));
    return { ok: true, updates, runtimeVersions };
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('branch') || msg.includes('no updates') || msg.includes('not found') || msg.includes('could not find') || msg.includes('environment')) {
      return { ok: true, updates: [], runtimeVersions: [] };
    }
    return diagnoseEasError(err);
  }
}

/** Republish a previous update group to a branch. Safe alternative to delete. */
async function republishUpdate(groupId, targetBranch) {
  if (!OTA_GROUP_ID_PATTERN.test(groupId)) return { ok: false, error: 'Invalid group ID' };
  if (!VALID_OTA_CHANNELS.includes(targetBranch)) return { ok: false, error: 'Invalid target branch' };
  try {
    const args = ['eas', 'update:republish', '--group', groupId, '--branch', targetBranch, '--non-interactive', '--json'];
    const output = await runCommand(args, 120000, { env: getEasVcsEnv() });
    try {
      const parsed = JSON.parse(output);
      const items = Array.isArray(parsed) ? parsed : (parsed?.currentPage || []);
      const first = items[0] || {};
      return {
        ok: true,
        runtimeVersion: first.runtimeVersion || null,
        group: first.group || null,
        platforms: items.map(i => i.platform).filter(Boolean),
      };
    } catch (_) {
      return { ok: true };
    }
  } catch (err) {
    return diagnoseEasError(err);
  }
}

/** Delete an OTA update group. Publishes a rollback-to-embedded marker on the branch. */
async function deleteOTAUpdate(groupId) {
  if (!OTA_GROUP_ID_PATTERN.test(groupId)) return { ok: false, error: 'Invalid group ID' };
  try {
    await runCommand(['eas', 'update:delete', groupId, '--non-interactive'], 30000);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { getOTAStatus, pushOTAUpdate, listOTAUpdates, republishUpdate, deleteOTAUpdate };
