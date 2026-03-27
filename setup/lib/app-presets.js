'use strict';

const fs = require('fs');
const path = require('path');
const { readJsonSafe } = require('./file-utils');

// ---------------------------------------------------------------------------
// App Presets — stores saved app paths for the dashboard app switcher
// ---------------------------------------------------------------------------
// Presets live alongside the dashboard code (not inside any target app).
// File: setup/.app-presets.json

const PRESETS_PATH = path.join(__dirname, '..', '.app-presets.json');
const PRESETS_TMP = PRESETS_PATH + '.tmp';

function loadPresets() {
  return readJsonSafe(PRESETS_PATH) || { presets: [], lastUsed: '' };
}

function savePresets(data) {
  fs.writeFileSync(PRESETS_TMP, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(PRESETS_TMP, PRESETS_PATH);
}

/**
 * Validate a project path — checks folder is a directory containing app.json.
 * Returns { valid, name, error } where name is the expo app name (or folder name fallback).
 */
function validateProjectPath(projectPath) {
  const resolved = path.resolve(projectPath);

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return { valid: false, name: '', error: 'Path is not a directory' };
    }
  } catch {
    return { valid: false, name: '', error: 'Folder not found' };
  }

  const appJsonPath = path.join(resolved, 'app.json');
  const appJson = readJsonSafe(appJsonPath);
  if (!appJson) {
    return { valid: false, name: '', error: 'No app.json found — this doesn\'t look like an Expo app' };
  }

  const expoName = ((appJson.expo && appJson.expo.name) || '').trim();
  const name = expoName || path.basename(resolved);

  return { valid: true, name, error: '' };
}

/**
 * Add a project as a preset. Validates the path and reads the name from app.json.
 * Returns { ok, preset?, error? }
 */
function addPreset(projectPath) {
  const resolved = path.resolve(projectPath);
  const validation = validateProjectPath(resolved);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  const data = loadPresets();
  if (data.presets.some(p => p.path === resolved)) {
    return { ok: false, error: 'This app is already saved' };
  }

  const preset = { name: validation.name, path: resolved };
  data.presets.push(preset);
  savePresets(data);
  return { ok: true, preset };
}

/**
 * Remove a preset by path.
 */
function removePreset(projectPath) {
  const resolved = path.resolve(projectPath);
  const data = loadPresets();
  const before = data.presets.length;
  data.presets = data.presets.filter(p => p.path !== resolved);
  if (data.presets.length === before) {
    return { ok: false, error: 'Preset not found' };
  }
  savePresets(data);
  return { ok: true };
}

/**
 * List directory contents for the folder browser.
 * Returns { ok, entries[], parentPath }
 */
function listDirectory(dirPath) {
  const resolved = path.resolve(dirPath);
  try {
    const rawEntries = fs.readdirSync(resolved, { withFileTypes: true });
    const dirs = [];
    let hasAppJson = false;
    for (const entry of rawEntries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) {
        // Check if this subfolder is an Expo app
        const childAppJson = path.join(resolved, entry.name, 'app.json');
        const isApp = fs.existsSync(childAppJson);
        dirs.push({ name: entry.name, isApp });
      }
      if (entry.name === 'app.json') hasAppJson = true;
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return { ok: true, path: resolved, parent: path.dirname(resolved), entries: dirs, hasAppJson };
  } catch {
    return { ok: false, error: 'Cannot read directory' };
  }
}

module.exports = { loadPresets, savePresets, addPreset, removePreset, validateProjectPath, listDirectory };
