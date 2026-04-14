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

/** List recent OTA updates */
async function listOTAUpdates() {
  try {
    const output = await runCommand(['eas', 'update:list', '--all', '--json', '--non-interactive'], 30000);
    return { ok: true, updates: JSON.parse(output) };
  } catch (err) {
    // When no updates exist yet, EAS CLI errors out — treat as empty list
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('branch') || msg.includes('no updates') || msg.includes('not found') || msg.includes('could not find') || msg.includes('environment')) {
      return { ok: true, updates: [] };
    }
    return diagnoseEasError(err);
  }
}

/** Delete an OTA update group */
async function deleteOTAUpdate(groupId) {
  if (!OTA_GROUP_ID_PATTERN.test(groupId)) return { ok: false, error: 'Invalid group ID' };
  try {
    await runCommand(['eas', 'update:delete', groupId, '--non-interactive'], 30000);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { getOTAStatus, pushOTAUpdate, listOTAUpdates, deleteOTAUpdate };
