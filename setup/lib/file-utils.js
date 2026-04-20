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
  const zipFile = path.join(PATHS.pluginsDir, pluginFolder + '.zip');

  // Check extracted folder first
  if (fileExists(dir) && fs.statSync(dir).isDirectory()) {
    let phpFile = path.join(dir, pluginFolder + '.php');
    if (!fileExists(phpFile)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.php'));
      if (files.length === 0) return 'unknown';
      phpFile = path.join(dir, files[0]);
    }
    const m = fs.readFileSync(phpFile, 'utf8').match(/Version:\s*(.+)/i);
    return m ? m[1].trim() : 'unknown';
  }

  // Check for shipped zip (core updates ship companion plugins as zips)
  if (fileExists(zipFile)) {
    try {
      const { parseZip } = require('./http-helpers');
      const zipData = fs.readFileSync(zipFile);
      const files = parseZip(zipData);
      const phpEntry = files.find(f => f.path === pluginFolder + '/' + pluginFolder + '.php')
        || files.find(f => f.path.endsWith('.php') && f.path.includes(pluginFolder));
      if (phpEntry) {
        const m = phpEntry.data.toString().match(/Version:\s*(.+)/i);
        return m ? m[1].trim() : 'unknown';
      }
    } catch {}
    return 'bundled';
  }

  return null;
}

function findPluginConfig(plugins, pluginName) {
  if (!Array.isArray(plugins)) return null;
  for (const p of plugins) {
    if (Array.isArray(p) && p[0] === pluginName && p[1]) return p[1];
  }
  return null;
}

function resolveUploadPath(target) {
  if (target === 'firebase-android') return PATHS.googleServicesJson;
  if (target === 'firebase-ios') return PATHS.googleServiceInfoPlist;
  if (target === 'google-play-key') return PATHS.googlePlayKeyFile;
  if (target === 'asc-api-key') return PATHS.ascApiKeyFile;
  return null;
}

/** Walk a nested object, creating empty objects along the way, and return the deepest one. */
function ensurePath(obj, ...keys) {
  let o = obj;
  for (const k of keys) { if (!o[k]) o[k] = {}; o = o[k]; }
  return o;
}

function readFileNormalized(p) {
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

module.exports = { fileExists, readJsonSafe, fileSizeKB, extractTsValue, getSiteUrl, getPluginVersion, findPluginConfig, resolveUploadPath, ensurePath, readFileNormalized };
