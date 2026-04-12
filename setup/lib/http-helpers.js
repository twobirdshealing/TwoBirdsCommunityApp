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

// CRC-32 lookup table (IEEE 802.3 polynomial, used by ZIP)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC32_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Create a minimal ZIP archive from a list of {path, data} entries.
 * Uses DEFLATE compression, falls back to STORED when the deflated payload
 * would be larger (very small files). Writes local file headers, then a
 * central directory, then an end-of-central-directory record. No ZIP64.
 */
function createZip(files) {
  const LFH_SIG = 0x04034b50;
  const CD_SIG = 0x02014b50;
  const EOCD_SIG = 0x06054b50;

  const parts = [];
  const cdEntries = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.path, 'utf8');
    const uncompressed = file.data;
    const uncompressedSize = uncompressed.length;
    const crc = crc32(uncompressed);

    let method, payload;
    if (uncompressedSize === 0) {
      method = 0;
      payload = uncompressed;
    } else {
      const deflated = zlib.deflateRawSync(uncompressed);
      if (deflated.length < uncompressedSize) {
        method = 8;
        payload = deflated;
      } else {
        method = 0;
        payload = uncompressed;
      }
    }

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(LFH_SIG, 0);
    lfh.writeUInt16LE(20, 4);                  // version needed
    lfh.writeUInt16LE(0, 6);                   // general purpose bit flag (utf8 off — we only use ASCII paths)
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(0, 10);                  // mod time
    lfh.writeUInt16LE(0x21, 12);               // mod date (1980-01-01)
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);     // compressed size
    lfh.writeUInt32LE(uncompressedSize, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);                  // extra field length

    const localHeaderOffset = offset;
    parts.push(lfh, nameBuf, payload);
    offset += 30 + nameBuf.length + payload.length;

    cdEntries.push({ nameBuf, method, crc, compressedSize: payload.length, uncompressedSize, localHeaderOffset });
  }

  const cdStart = offset;
  for (const e of cdEntries) {
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(CD_SIG, 0);
    cd.writeUInt16LE(20, 4);                   // version made by
    cd.writeUInt16LE(20, 6);                   // version needed
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(e.method, 10);
    cd.writeUInt16LE(0, 12);                   // mod time
    cd.writeUInt16LE(0x21, 14);                // mod date
    cd.writeUInt32LE(e.crc, 16);
    cd.writeUInt32LE(e.compressedSize, 20);
    cd.writeUInt32LE(e.uncompressedSize, 24);
    cd.writeUInt16LE(e.nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);                   // extra field length
    cd.writeUInt16LE(0, 32);                   // comment length
    cd.writeUInt16LE(0, 34);                   // disk number start
    cd.writeUInt16LE(0, 36);                   // internal file attrs
    cd.writeUInt32LE(0, 38);                   // external file attrs
    cd.writeUInt32LE(e.localHeaderOffset, 42);
    parts.push(cd, e.nameBuf);
    offset += 46 + e.nameBuf.length;
  }

  const cdSize = offset - cdStart;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);                    // disk number
  eocd.writeUInt16LE(0, 6);                    // disk with CD
  eocd.writeUInt16LE(cdEntries.length, 8);
  eocd.writeUInt16LE(cdEntries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);                   // comment length
  parts.push(eocd);

  return Buffer.concat(parts);
}

/**
 * Parse a ZIP buffer into an array of {path, data}.
 * Walks the central directory (robust — works even when entries use data
 * descriptors where local-file-header sizes are zeroed). Supports STORED
 * and DEFLATE compression methods, which is everything `zip`/`python -m
 * zipfile` produce. No ZIP64, no encryption — we don't need them.
 */
function parseZip(buffer) {
  const EOCD_SIG = 0x06054b50;
  const CD_ENTRY_SIG = 0x02014b50;
  const LFH_SIG = 0x04034b50;

  // Find End of Central Directory Record. It sits at the end of the file,
  // optionally followed by a comment up to 65535 bytes long.
  const maxBack = Math.min(buffer.length, 22 + 65535);
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= buffer.length - maxBack && i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('Not a valid ZIP file (no EOCD record found)');

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  const files = [];
  let cdPos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(cdPos) !== CD_ENTRY_SIG) {
      throw new Error('Invalid ZIP central directory entry at offset ' + cdPos);
    }
    const compressionMethod = buffer.readUInt16LE(cdPos + 10);
    const compressedSize = buffer.readUInt32LE(cdPos + 20);
    const fileNameLen = buffer.readUInt16LE(cdPos + 28);
    const extraFieldLen = buffer.readUInt16LE(cdPos + 30);
    const fileCommentLen = buffer.readUInt16LE(cdPos + 32);
    const localHeaderOffset = buffer.readUInt32LE(cdPos + 42);
    const rawName = buffer.subarray(cdPos + 46, cdPos + 46 + fileNameLen).toString('utf8');

    cdPos += 46 + fileNameLen + extraFieldLen + fileCommentLen;

    // Skip directory entries
    if (rawName.endsWith('/')) continue;

    // Jump to the local file header to find where the data actually starts
    if (buffer.readUInt32LE(localHeaderOffset) !== LFH_SIG) {
      throw new Error('Invalid ZIP local file header for ' + rawName);
    }
    const lfhNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const lfhExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (compressionMethod === 0) {
      data = compressed;
    } else if (compressionMethod === 8) {
      data = zlib.inflateRawSync(compressed);
    } else {
      throw new Error('Unsupported ZIP compression method ' + compressionMethod + ' for ' + rawName);
    }

    const name = rawName.replace(/\\/g, '/').replace(/^\.\//, '');
    files.push({ path: name, data });
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

module.exports = { checkConnectivity, httpsRequest, parseMultipart, createZip, parseZip };
