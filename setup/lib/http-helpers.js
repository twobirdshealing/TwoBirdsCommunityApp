const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { DASHBOARD_VERSION } = require('./paths');

// ---------------------------------------------------------------------------
// Connectivity Checker
// ---------------------------------------------------------------------------

async function checkConnectivity(siteUrl) {
  if (!siteUrl) return { error: 'No EXPO_PUBLIC_SITE_URL configured' };
  const results = {};
  const endpoints = [
    { key: 'site', url: siteUrl, label: 'Site root' },
    { key: 'wpRest', url: `${siteUrl}/wp-json/`, label: 'WP REST API' },
    { key: 'fluentApi', url: `${siteUrl}/wp-json/fluent-community/v2`, label: 'Fluent Community API' },
    { key: 'tbcCa', url: `${siteUrl}/wp-json/tbc-ca/v1`, label: 'TBC Community App plugin' },
  ];
  const checks = await Promise.all(endpoints.map(async (ep) => {
    try {
      const status = await httpGet(ep.url, 5000);
      return [ep.key, { url: ep.url, label: ep.label, status, ok: status >= 200 && status < 400 }];
    } catch (err) {
      return [ep.key, { url: ep.url, label: ep.label, status: 0, ok: false, error: err.message }];
    }
  }));
  for (const [key, val] of checks) results[key] = val;
  return results;
}

function httpGet(url, timeout) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    const req = mod.get(url, { timeout }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/** Create a minimal tar archive from a list of {path, data} entries */
function createTar(files) {
  const blocks = [];
  for (const file of files) {
    const header = Buffer.alloc(512, 0);
    // name (100 bytes)
    const nameBytes = Buffer.from(file.path, 'utf8');
    nameBytes.copy(header, 0, 0, Math.min(nameBytes.length, 100));
    // mode (8 bytes at offset 100)
    Buffer.from('0000644\0', 'ascii').copy(header, 100);
    // uid (8 bytes at offset 108)
    Buffer.from('0001000\0', 'ascii').copy(header, 108);
    // gid (8 bytes at offset 116)
    Buffer.from('0001000\0', 'ascii').copy(header, 116);
    // size (12 bytes at offset 124, octal)
    const sizeOctal = file.data.length.toString(8).padStart(11, '0') + '\0';
    Buffer.from(sizeOctal, 'ascii').copy(header, 124);
    // mtime (12 bytes at offset 136)
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
    Buffer.from(mtime, 'ascii').copy(header, 136);
    // Initialize checksum field with spaces (8 bytes at offset 148)
    Buffer.from('        ', 'ascii').copy(header, 148);
    // typeflag (1 byte at offset 156) — '0' for regular file
    header[156] = 0x30;
    // magic (6 bytes at offset 257)
    Buffer.from('ustar\0', 'ascii').copy(header, 257);
    // version (2 bytes at offset 263)
    Buffer.from('00', 'ascii').copy(header, 263);

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i];
    const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
    Buffer.from(checksumStr, 'ascii').copy(header, 148);

    blocks.push(header);
    blocks.push(file.data);
    // Pad to 512-byte boundary
    const remainder = file.data.length % 512;
    if (remainder > 0) blocks.push(Buffer.alloc(512 - remainder, 0));
  }
  // End-of-archive marker (two empty blocks)
  blocks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(blocks);
}

/** Parse a tar buffer into an array of {path, data} */
function parseTar(buffer) {
  const files = [];
  let offset = 0;
  while (offset < buffer.length - 512) {
    const header = buffer.subarray(offset, offset + 512);
    // Check for end-of-archive (first byte zero means null header)
    if (header[0] === 0) break;

    // Extract name (normalize: strip leading ./ and backslashes)
    let name = '';
    for (let i = 0; i < 100 && header[i] !== 0; i++) name += String.fromCharCode(header[i]);
    name = name.trim().replace(/\\/g, '/').replace(/^\.\//, '');

    // Extract size (octal, 12 bytes at offset 124)
    const sizeStr = header.subarray(124, 136).toString('ascii').trim().replace(/\0/g, '');
    const size = parseInt(sizeStr, 8) || 0;

    // Type flag
    const typeflag = header[156];

    offset += 512;

    if (size > 0 && (typeflag === 0x30 || typeflag === 0)) { // regular file
      const data = buffer.subarray(offset, offset + size);
      files.push({ path: name, data });
    }

    // Skip data blocks (padded to 512)
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

// ---------------------------------------------------------------------------
// Multipart Parser
// ---------------------------------------------------------------------------

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    if (!boundaryMatch) return reject(new Error('No boundary in content-type'));
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const parts = [];
      const boundaryBuf = Buffer.from('--' + boundary);
      const crlfcrlf = Buffer.from('\r\n\r\n');
      let start = buffer.indexOf(boundaryBuf, 0);
      if (start === -1) return resolve(parts);
      while (true) {
        const nextStart = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
        if (nextStart === -1) break;
        const partData = buffer.subarray(start + boundaryBuf.length, nextStart);
        const headerEnd = partData.indexOf(crlfcrlf, 0);
        if (headerEnd === -1) { start = nextStart; continue; }
        const headerStr = partData.subarray(0, headerEnd).toString('utf8');
        const body = partData.subarray(headerEnd + 4, partData.length - 2);
        const nameMatch = headerStr.match(/name="([^"]+)"/);
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        parts.push({ name: nameMatch ? nameMatch[1] : '', filename: filenameMatch ? filenameMatch[1] : '', data: body });
        start = nextStart;
      }
      resolve(parts);
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Update System — HTTPS helper
// ---------------------------------------------------------------------------

/**
 * Make an HTTPS request. Returns { statusCode, body }.
 * Follows up to 3 redirects. Supports GET and POST.
 */
function httpsRequest(url, options = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const method = (options.method || 'GET').toUpperCase();
    const reqOptions = {
      method,
      timeout: options.timeout || 30000,
      headers: {
        'User-Agent': 'TBC-Dashboard/' + DASHBOARD_VERSION,
        ...(options.headers || {}),
      },
    };

    const req = mod.request(url, reqOptions, (res) => {
      // Follow redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(httpsRequest(res.headers.location, options, redirects + 1));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, body, headers: res.headers });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

module.exports = { checkConnectivity, httpGet, httpsRequest, parseMultipart, parseTar, createTar };
