'use strict';
const path = require('path');
const fs = require('fs');
const { protocol } = require('electron');

const SCHEME = 'app';
const HOST = 'studio';

/* Only these top-level entries are served. Everything else (electron/, node_modules/, package.json, dotfiles) is 404. */
const ALLOWED_FILES = new Set(['index.html']);
const ALLOWED_DIRS = new Set(['css', 'js', 'assets', 'fonts', 'templates', 'docs', 'config']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/* CSP applied to every response. */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function respond(status, body, type) {
  const headers = {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': type || 'text/plain; charset=utf-8',
  };
  return new Response(body, { status, headers });
}
const notFound = () => respond(404, 'Not found');

/* Maps an app:// URL to an absolute file path inside root, or null. */
function resolveRequest(root, rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch (e) { return null; }
  if (url.protocol !== SCHEME + ':' || url.hostname !== HOST) return null;

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (e) { return null; } /* query + fragment are not part of pathname */
  if (pathname.indexOf('\0') !== -1) return null;
  if (pathname === '' || pathname === '/') pathname = '/index.html';

  const abs = path.resolve(root, '.' + path.posix.sep + pathname.replace(/^\/+/, ''));
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;

  const segs = rel.split(path.sep);
  if (segs.some((s) => s === '' || s.startsWith('.'))) return null;
  if (segs.length === 1) return ALLOWED_FILES.has(segs[0]) ? abs : null;
  return ALLOWED_DIRS.has(segs[0]) ? abs : null;
}

function installProtocol(session, root) {
  const handler = async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return respond(405, 'Method not allowed');
    const file = resolveRequest(root, request.url);
    if (!file) return notFound();
    try {
      const data = await fs.promises.readFile(file); /* ASAR-compatible */
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      return respond(200, request.method === 'HEAD' ? null : data, type);
    } catch (e) {
      return notFound();
    }
  };
  (session && session.protocol ? session.protocol : protocol).handle(SCHEME, handler);
}

module.exports = { SCHEME, HOST, CSP, installProtocol, resolveRequest };
