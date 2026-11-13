/* Document model: one XNP source + at most one EXTERNAL stylesheet.
   The stylesheet is always described by the `STYLESHEET "path"` directive in the XNP header.
   Header scanning here is text bookkeeping only (it never validates Xenapse syntax; the compiler does). */
(function () {
  const { store } = Xen, S = store.state, D = S.doc;
  const DIRECTIVES = new Set(['STYLESHEET', 'DIRECTION', 'LAYOUT']);

  /* ---- filename helpers ---- */
  const stemOf = (fileName) => { const m = /^(.+)\.[^.\\/]*$/.exec(fileName); return m ? m[1] : fileName; };
  const baseName = (declared) => declared.split(/[\\/]/).pop() || declared;

  /* ---- string escapes inside STYLESHEET "…" ---- */
  const encodeString = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');

  /** Scan only the header region (after IMPORT, before the first body token).
      Returns { module, declared|null, directiveRange|null, partial, importEnd }. directiveRange = { start, end, strStart, strEnd }. */
  function parseHeader(text) {
    const n = text.length; let i = 0;
    const out = { module: null, declared: null, directiveRange: null, partial: false, importEnd: -1 };
    const skip = () => {
      while (i < n) {
        const c = text[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\ufeff') i++;
        else if (c === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; }
        else break;
      }
    };
    const WORD = /[A-Za-z_][A-Za-z0-9_]*/y;
    const word = () => { WORD.lastIndex = i; const r = WORD.exec(text); if (!r) return null; const w = { v: r[0], start: i, end: i + r[0].length }; i = w.end; return w; };
    const str = () => {                                   // positioned on the opening quote; null = unterminated
      const start = i; let v = ''; i++;
      while (i < n) {
        const c = text[i];
        if (c === '\n' || c === '\r') return null;
        if (c === '"') { i++; return { value: v, start, end: i }; }
        if (c === '\\' && i + 1 < n) {
          const d = text[i + 1];
          if (d === '\n' || d === '\r') { v += c; i++; continue; }
          v += d === '\\' ? '\\' : d === '"' ? '"' : d === 'n' ? '\n' : d === 't' ? '\t' : c + d; i += 2; continue;
        }
        v += c; i++;
      }
      return null;
    };

    skip(); const imp = word(); if (!imp || imp.v !== 'IMPORT') return out;
    out.importEnd = imp.end;
    while (i < n && (text[i] === ' ' || text[i] === '\t')) i++;
    const m = word();
    if (m && !DIRECTIVES.has(m.v)) { out.module = m.v; out.importEnd = m.end; } else i = imp.end;

    for (;;) {
      skip(); const w = word(); if (!w) break;            // any non-word token starts the body
      if (w.v === 'STYLESHEET') {
        skip();
        const first = out.directiveRange === null;
        if (text[i] !== '"') { if (first) out.partial = true; break; }
        const s = str();
        if (!s) { if (first) out.partial = true; break; }
        if (first) { out.declared = s.value; out.directiveRange = { start: w.start, end: s.end, strStart: s.start + 1, strEnd: s.end - 1 }; }
      } else if (w.v === 'DIRECTION' || w.v === 'LAYOUT') {
        skip(); const save = i, a = word(); if (a && DIRECTIVES.has(a.v)) i = save;
      } else break;                                       // first body keyword
    }
    return out;
  }

  /* ---- directive editing (pure text in / text out) ---- */
  function insertDirective(text, declared) {
    const h = parseHeader(text);
    if (h.directiveRange) return setDeclared(text, declared);
    const line = `STYLESHEET "${encodeString(declared)}"`;
    if (h.importEnd < 0) return line + '\n\n' + text;
    let eol = text.indexOf('\n', h.importEnd); if (eol < 0) eol = text.length;
    return text.slice(0, eol) + '\n' + line + text.slice(eol);
  }
  function setDeclared(text, declared) {
    const h = parseHeader(text), r = h.directiveRange;
    if (!r) return insertDirective(text, declared);
    return text.slice(0, r.strStart) + encodeString(declared) + text.slice(r.strEnd);
  }
  function removeDirective(text) {
    const r = parseHeader(text).directiveRange; if (!r) return text;
    const ls = text.lastIndexOf('\n', r.start - 1) + 1;
    let le = text.indexOf('\n', r.end); const hasNl = le >= 0; if (!hasNl) le = text.length;
    const before = text.slice(ls, r.start), after = text.slice(r.end, le);
    if (!before.trim() && !after.trim()) return text.slice(0, ls) + text.slice(hasNl ? le + 1 : le);
    if (!before.trim()) return text.slice(0, r.start) + text.slice(r.end).replace(/^[ \t]+/, '');
    return text.slice(0, r.start).replace(/[ \t]+$/, '') + text.slice(r.end);
  }
  function setModule(text, mod) {
    return /^[ \t]*IMPORT[ \t]+\w+/m.test(text) ? text.replace(/^([ \t]*IMPORT[ \t]+)\w+/m, '$1' + mod) : `IMPORT ${mod}\n\n` + text;
  }

  /* ---- reconciliation (keeps the model consistent when the user edits the XNP by hand) ---- */
  const newMissing = (declared) => ({ declared, fileName: baseName(declared), path: null, text: '', saved: null, state: 'missing' });
  function reconcile() {
    const h = parseHeader(D.xnp.text); if (h.partial) return;        // mid-typing: leave the model alone
    const declared = h.declared, x = D.xcss;
    if (declared === null) {
      if (!x) return;
      D.orphan = x; D.xcss = null; S.ui.xcssOpen = false; if (S.ui.tab === 'xcss') S.ui.tab = 'xnp';
      store.emit('doc'); store.emit('ui'); Xen.toast('Stylesheet reference removed from the source. The stylesheet is detached.', { kind: 'warn' }); return;
    }
    if (x && x.declared === declared) return;                        // nothing actually changed
    const orphan = D.orphan && D.orphan.declared === declared ? D.orphan : null;
    if (x && Doc.xcssDirty()) {                                      // unsaved edits: keep the text, retarget the reference
      x.declared = declared; x.fileName = baseName(declared); x.saved = null; x.path = null; x.state = 'new';
      store.emit('doc'); return;
    }
    if (orphan) { D.xcss = orphan; D.orphan = null; }
    else D.xcss = newMissing(declared);
    store.emit('text', { buffer: 'xcss', source: 'sync' }); store.emit('doc');
    if (!orphan) Xen.files?.resolveStylesheet?.();
  }

  const Doc = (Xen.doc = {
    state: D,
    parseHeader, insertDirective, setDeclared, removeDirective, setModule, reconcile, baseName, stemOf, encodeString,
    xnpFileName: () => D.fileName,
    xcssFileName: () => (D.xcss ? D.xcss.fileName : null),
    suggestStylesheetName: () => stemOf(D.fileName) + '.xcss',
    /** True when the stylesheet belongs to this document and is renamed along with it (Save As). */
    followsDocument: () => !!D.xcss && (D.xcss.state === 'new' || D.xcss.declared === stemOf(D.fileName) + '.xcss'),
    xnpDirty: () => D.xnp.text !== D.xnp.saved,
    xcssDirty() {
      const x = D.xcss; if (!x) return false;
      if ((x.state === 'missing' || x.state === 'unreadable') && x.text === '') return false;
      return x.saved === null || x.text !== x.saved;
    },
    isDirty() { return this.xnpDirty() || this.xcssDirty(); },
    bufferText: (id) => (id === 'xcss' ? (D.xcss ? D.xcss.text : '') : D.xnp.text),
    setText(buffer, text, source = 'user') {
      if (buffer === 'xnp') { D.xnp.text = text; reconcile(); }
      else if (D.xcss) {
        D.xcss.text = text;
        if (D.xcss.state === 'missing' && text !== '' && source !== 'sync') { D.xcss.state = 'new'; store.emit('doc'); }
      }
      store.emit('text', { buffer, source });
    },
    /** Replace the entire document. xcss: { text, path?, saved?, state? } | null. fileName is stored exactly as given. */
    load({ fileName, path = null, eol = 'lf', xnp, xcss, dirty = false }) {
      D.fileName = fileName || 'untitled.xnp'; D.path = path || null; D.eol = eol === 'crlf' ? 'crlf' : 'lf'; D.mtimeMs = null;
      D.loadId++; D.orphan = null;
      D.xnp = { text: xnp, saved: dirty ? '' : xnp };
      D.xcss = null;
      const declared = parseHeader(xnp).declared;
      if (declared !== null) {
        if (xcss) {
          const state = xcss.state || 'loaded';
          const saved = 'saved' in xcss ? xcss.saved : (dirty || state === 'new' || state === 'missing' ? null : xcss.text);
          D.xcss = { declared, fileName: baseName(declared), path: xcss.path || null, text: xcss.text, saved, state };
        } else D.xcss = newMissing(declared);
      }
      S.ui.tab = 'xnp'; S.ui.xcssOpen = !!D.xcss;
      store.emit('doc'); store.emit('ui');
      if (D.xcss && D.xcss.state === 'missing') Xen.files?.resolveStylesheet?.();
    },
    markSaved({ xnp = true, xcss = true } = {}) {
      if (xnp) D.xnp.saved = D.xnp.text;
      if (xcss && D.xcss && D.xcss.state !== 'missing') { D.xcss.saved = D.xcss.text; D.xcss.state = 'loaded'; }
      store.emit('doc');
    },
    /** Save As: change the document's on-disk identity. A Studio-created stylesheet follows; a shared or hand-named one does not. */
    setLocation({ fileName, path = null }) {
      const x = D.xcss, follows = Doc.followsDocument();
      D.fileName = fileName; D.path = path || null; D.mtimeMs = null;
      if (x && follows) {
        const declared = stemOf(fileName) + '.xcss';
        if (declared !== x.declared) {
          x.declared = declared; x.fileName = baseName(declared); x.path = null; x.saved = null; x.state = 'new';
          D.xnp.text = setDeclared(D.xnp.text, declared);
          store.emit('text', { buffer: 'xnp', source: 'sync' });
        }
      }
      store.emit('doc');
    },
  });
})();
