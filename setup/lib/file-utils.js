const fs = require('fs');
const path = require('path');
const { PATHS } = require('./paths');

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function fileSizeKB(p) {
  try { return Math.round(fs.statSync(p).size / 1024); } catch { return 0; }
}

function extractTsValue(content, pattern) {
  const m = content.match(pattern);
  return m ? m[1] : '';
}

function getSiteUrl(easJson) {
  if (!easJson) return '';
  const profiles = easJson.build || {};
  // Prefer production, then preview, then first non-development profile
  const preferred = profiles.production?.env?.EXPO_PUBLIC_SITE_URL || profiles.preview?.env?.EXPO_PUBLIC_SITE_URL;
  if (preferred) return preferred;
  for (const key of Object.keys(profiles)) {
    if (key === 'development') continue;
    if (profiles[key]?.env?.EXPO_PUBLIC_SITE_URL) return profiles[key].env.EXPO_PUBLIC_SITE_URL;
  }
  return '';
}

function getPluginVersion(pluginFolder) {
  const dir = path.join(PATHS.pluginsDir, pluginFolder);
  if (!fileExists(dir)) return null;
  // Resolve which PHP file to read: main file or first .php found
  let phpFile = path.join(dir, pluginFolder + '.php');
  if (!fileExists(phpFile)) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.php'));
    if (files.length === 0) return 'unknown';
    phpFile = path.join(dir, files[0]);
  }
  const m = fs.readFileSync(phpFile, 'utf8').match(/Version:\s*(.+)/i);
  return m ? m[1].trim() : 'unknown';
}

module.exports = { fileExists, readJsonSafe, fileSizeKB, extractTsValue, getSiteUrl, getPluginVersion };
