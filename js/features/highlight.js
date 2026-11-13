/* Lightweight tokenisers for syntax colouring ONLY. This is not a parser, a validator or the Xenapse engine.
   Both tokenisers are stateful across lines and linear-time per call (they run on every keystroke). */
(function () {
  const { esc } = Xen.util;
  const sp = (c, t) => `<span class="t-${c}">${esc(t)}</span>`;

  /* ---------------- XNP ---------------- */
  const KEYWORDS = new Set(['IMPORT', 'STYLESHEET', 'DIRECTION', 'LAYOUT', 'ROOT', 'START', 'START*', 'END', 'END*', 'IF', 'ELSE', 'DATABASE']);
  const MODULES = new Set(['FLOW', 'MINDMAP']);
  const DIRECTIVE_VALUES = new Set(['TB', 'LR', 'RADIAL', 'TREE', 'HORIZONTAL']);
  const SHAPES = { '[': [']', 'proc'], '(': [')', 'proc'], '<': ['>', 'dec'], '/': ['/', 'io'], '|': ['|', 'emph'] };
  const WORD = /[A-Za-z_][A-Za-z0-9_-]*/y;
  const IDENT = /[A-Za-z_][A-Za-z0-9_-]*/y;

  /* End index (exclusive) of a string starting at `i` (a quote), or -1 when it is not closed on this line. */
  function stringEnd(line, i) {
    for (let j = i + 1; j < line.length; j++) {
      const c = line[j];
      if (c === '\\') j++;
      else if (c === '"') return j + 1;
    }
    return -1;
  }
  /* End index (exclusive) of a FLOW shape starting at `i`, or -1 when it is unterminated on this line. */
  function shapeEnd(line, i, closer) {
    let j = i + 1;
    while (j < line.length && (line[j] === ' ' || line[j] === '\t' || line[j] === '\r')) j++;
    if (line[j] === '"') {
      const e = stringEnd(line, j);
      if (e < 0) return -1;
      j = e;
      while (j < line.length && (line[j] === ' ' || line[j] === '\t' || line[j] === '\r')) j++;
      return line[j] === closer ? j + 1 : -1;
    }
    const k = line.indexOf(closer, i + 1);
    return k < 0 ? -1 : k + 1;
  }

  function xnpLine(line, st) {
    let out = '', i = 0, plain = 0;
    const n = line.length;
    const flush = (to) => { if (to > plain) out += esc(line.slice(plain, to)); };
    const emit = (from, to, cls) => { flush(from); out += sp(cls, line.slice(from, to)); plain = i = to; };
    while (i < n) {
      const c = line[i];
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && line[i + 1] === '/') { emit(i, n, 'c'); break; }
      if (c === '"') {
        const e = stringEnd(line, i);
        emit(i, e < 0 ? n : e, 's'); st.pending = null;
        continue;
      }
      if (c === '{') { emit(i, i + 1, 'br' + (st.depth % 6)); st.depth++; st.pending = null; continue; }
      if (c === '}') { st.depth = Math.max(0, st.depth - 1); emit(i, i + 1, 'br' + (st.depth % 6)); st.pending = null; continue; }
      if (c === '#' || c === '.') {
        IDENT.lastIndex = i + 1;
        const m = IDENT.exec(line);
        if (m) { emit(i, i + 1 + m[0].length, c === '#' ? 'tag' : 'cls'); continue; }
        i++; continue;
      }
      if (st.module === 'FLOW' && SHAPES[c]) {
        const [closer, cls] = SHAPES[c];
        const e = shapeEnd(line, i, closer);
        if (e < 0) { emit(i, i + 1, cls); break; } /* unterminated: opener only, rest of the line stays plain */
        emit(i, e, cls); st.pending = null;
        continue;
      }
      WORD.lastIndex = i;
      const m = WORD.exec(line);
      if (m) {
        let w = m[0], e = i + w.length;
        if ((w === 'START' || w === 'END') && line[e] === '*') { w += '*'; e++; }
        const prev = st.pending; st.pending = null;
        if (KEYWORDS.has(w)) {
          emit(i, e, 'k');
          if (w === 'IMPORT' && !st.module) st.pending = 'import';
          else if (w === 'DIRECTION' || w === 'LAYOUT') st.pending = 'value';
          else if (w === 'IF') st.pending = 'if';
        } else if (prev === 'import' && MODULES.has(w)) { emit(i, e, 'm'); if (!st.module) st.module = w; }
        else if (prev === 'value' && DIRECTIVE_VALUES.has(w)) emit(i, e, 'm');
        else if (prev === 'if' && w === 'YES') emit(i, e, 'k');
        else i = e;
        continue;
      }
      i++;
    }
    flush(n);
    return out;
  }

  /* ---------------- XCSS ---------------- */
  /* Recognised properties (colour only; any `identifier:` is coloured as a property, never validated):
     fill stroke stroke-width color font-family font-size font-weight text-align padding min-width max-width
     border-radius stroke-dasharray arrowhead node-gap rank-gap branch-gap diagram-padding */
  const HEX = /#[0-9a-fA-F]{3,8}(?![\w-])/y;
  const NUM = /-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|em)?(?![\w.-])/y;
  const PROP = /[A-Za-z_-][A-Za-z0-9_-]*(?=\s*:)/y;
  const XIDENT = /[A-Za-z_-][A-Za-z0-9_-]*/y;
  const isWordChar = (ch) => ch !== undefined && /[\w-]/.test(ch);

  function xcssLine(line, st) {
    let out = '', i = 0, plain = 0, inValue = false; /* a value never continues onto the next line */
    const n = line.length;
    const flush = (to) => { if (to > plain) out += esc(line.slice(plain, to)); };
    const emit = (from, to, cls) => { flush(from); out += sp(cls, line.slice(from, to)); plain = i = to; };
    while (i < n) {
      if (st.comment) {
        const e = line.indexOf('*/', i);
        if (e < 0) { emit(i, n, 'c'); break; }
        emit(i, e + 2, 'c'); st.comment = false;
        continue;
      }
      const c = line[i];
      if (c === '/' && line[i + 1] === '*') { st.comment = true; const e = line.indexOf('*/', i + 2); if (e < 0) { emit(i, n, 'c'); break; } emit(i, e + 2, 'c'); st.comment = false; continue; }
      if (c === '{') { emit(i, i + 1, 'br' + (st.depth % 6)); st.depth++; st.block = true; inValue = false; continue; }
      if (c === '}') { st.depth = Math.max(0, st.depth - 1); emit(i, i + 1, 'br' + (st.depth % 6)); st.block = false; inValue = false; continue; }
      if (!st.block) { /* selector context */
        if (c === '.' || c === '#') {
          IDENT.lastIndex = i + 1;
          const r = IDENT.exec(line);
          if (r) { emit(i, i + 1 + r[0].length, 'cls'); continue; }
          i++; continue;
        }
        XIDENT.lastIndex = i;
        const m = XIDENT.exec(line);
        if (m) { emit(i, i + m[0].length, 'sel'); continue; }
        i++; continue;
      }
      if (!inValue) { /* property context */
        PROP.lastIndex = i;
        const m = PROP.exec(line);
        if (m) {
          emit(i, i + m[0].length, 'prop');
          while (i < n && (line[i] === ' ' || line[i] === '\t')) i++;
          if (line[i] === ':') { i++; inValue = true; }
          continue;
        }
        if (c === ';') { emit(i, i + 1, 'op'); continue; }
        i++; continue;
      }
      /* value context */
      if (c === ';') { emit(i, i + 1, 'op'); inValue = false; continue; }
      if (c === '"') { const e = stringEnd(line, i); emit(i, e < 0 ? n : e, 's'); continue; }
      if (c === '#') {
        HEX.lastIndex = i;
        const m = HEX.exec(line);
        if (m) { flush(i); out += `<span class="t-color" style="--sw:${m[0]}">${esc(m[0])}</span>`; plain = i = i + m[0].length; continue; }
        i++; continue;
      }
      if (isWordChar(c) || c === '.') {
        if (!isWordChar(line[i - 1]) && line[i - 1] !== '.') {
          NUM.lastIndex = i;
          const m = NUM.exec(line);
          if (m) { emit(i, i + m[0].length, 'num'); continue; }
        }
        XIDENT.lastIndex = i;
        const m = XIDENT.exec(line);
        i += m ? m[0].length : 1; continue;
      }
      i++;
    }
    flush(n);
    return out;
  }

  Xen.highlight = function (text, lang) {
    if (!Xen.prefs.get('highlight')) return esc(text);
    const lines = text.split('\n');
    if (lang === 'xcss') { const st = { comment: false, block: false, depth: 0 }; return lines.map((l) => xcssLine(l, st)).join('\n'); }
    const st = { module: null, pending: null, depth: 0 };
    return lines.map((l) => xnpLine(l, st)).join('\n');
  };
})();
