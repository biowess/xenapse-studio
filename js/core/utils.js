/* Shared utilities. Everything hangs off window.Xen (no build step, works from file://). */
(function () {
  const Xen = (window.Xen = window.Xen || {});
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const slug = (s) => (String(s).trim().toLowerCase().replace(/\.(xnp|xcss)$/i, '').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')) || 'untitled';
  const safeFileName = (s) => String(s).replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '').replace(/[. ]+$/, '');
  const fmtKeys = (combo) => combo.split('+').map((k) => (k === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : k === 'Alt' && isMac ? '⌥' : k === 'Shift' && isMac ? '⇧' : k)).join(isMac ? '' : '+');
  const relativeTime = (ts) => {
    if (!ts || typeof ts !== 'number') return '';
    const diffSec = Math.round((ts - Date.now()) / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHr = Math.round(diffMin / 60);
    const diffDays = Math.round(diffHr / 24);
    if (Math.abs(diffDays) > 30) {
      try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(new Date(ts));
      } catch (e) {
        return new Date(ts).toLocaleDateString();
      }
    }
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (Math.abs(diffSec) < 45) return 'just now';
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
    return rtf.format(diffDays, 'day');
  };
  const shortenPath = (p, max = 40) => {
    if (!p || typeof p !== 'string') return '';
    if (p.length <= max) return p;
    const isWin = /^[a-zA-Z]:[\\/]/.test(p);
    const sep = p.includes('\\') ? '\\' : '/';
    let root = '';
    let rest = p;
    if (isWin) {
      const m = p.match(/^[a-zA-Z]:[\\/]/);
      root = m[0];
      rest = p.slice(root.length);
    } else if (p.startsWith('/')) {
      root = '/';
      rest = p.slice(1);
    }
    const parts = rest.split(/[\\/]/).filter(Boolean);
    if (parts.length <= 2) return p;
    const tail = parts.slice(-2).join(sep);
    return `${root}...${sep}${tail}`;
  };
  Xen.util = { isMac, esc, debounce, clamp, $, $$, slug, safeFileName, fmtKeys, relativeTime, shortenPath };
})();
