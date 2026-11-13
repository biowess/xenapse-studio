/* Source editor: textarea (input) over a highlighted <pre>, with gutter, current-line bar,
   per-buffer undo history, auto-indent and tab handling. One editor, two buffers (xnp / xcss). */
(function () {
  const { store, util } = Xen, S = store.state, D = S.doc, Doc = Xen.doc;
  const $ = util.$;
  const input = $('#editor-input'), hl = $('#editor-hl'), gutter = $('#editor-gutter-inner'), cur = $('#editor-curline'), root = $('#editor');
  const hist = { xnp: { stack: [], i: -1, t: 0 }, xcss: { stack: [], i: -1, t: 0 } };
  const view = { xnp: { sel: [0, 0], top: 0, left: 0 }, xcss: { sel: [0, 0], top: 0, left: 0 } };
  let buffer = 'xnp', lastLoad = -1, lineCount = 0;
  const lh = () => parseFloat(getComputedStyle(input).lineHeight) || 21;
  const unit = () => Xen.prefs.indentUnit();

  /* ---- history ---- */
  function push(force) {
    const h = hist[buffer], v = input.value, top = h.stack[h.i];
    if (top && top.v === v) return;
    const entry = { v, s: [input.selectionStart, input.selectionEnd] }, now = Date.now();
    if (!force && h.i > 0 && h.i === h.stack.length - 1 && now - h.t < 700) h.stack[h.i] = entry;
    else { h.stack = h.stack.slice(0, h.i + 1); h.stack.push(entry); h.i++; if (h.stack.length > 300) { h.stack.shift(); h.i--; } }
    h.t = now;
  }
  function restore(entry) {
    input.value = entry.v; input.setSelectionRange(entry.s[0], entry.s[1]);
    Doc.setText(buffer, entry.v, 'undo'); render(); updateCursor();
  }
  const undo = () => { const h = hist[buffer]; if (h.i > 0) { h.i--; restore(h.stack[h.i]); } };
  const redo = () => { const h = hist[buffer]; if (h.i < h.stack.length - 1) { h.i++; restore(h.stack[h.i]); } };

  const markers = { xnp: new Map(), xcss: new Map() };
  function applyMarkers() {
    const map = markers[buffer] || new Map(), g = gutter.children;
    for (let i = 0; i < g.length; i++) {
      g[i].classList.remove('has-error');
      g[i].classList.remove('has-warning');
      const s = map.get(i + 1);
      if (s) g[i].classList.add('has-' + s);
    }
  }
  function setMarkers(buf, list) {
    const map = new Map();
    if (Array.isArray(list)) {
      for (const m of list) {
        if (!m || !m.line) continue;
        const cur = map.get(m.line);
        if (!cur || m.severity === 'error') map.set(m.line, m.severity);
      }
    }
    markers[buf] = map;
    if (buf === buffer) applyMarkers();
  }
  function clearMarkers() { markers.xnp.clear(); markers.xcss.clear(); applyMarkers(); }

  /* ---- rendering ---- */
  function render() {
    const v = input.value;
    hl.innerHTML = Xen.highlight(v, buffer) + '\n';
    const n = v.split('\n').length;
    if (n !== lineCount) {
      lineCount = n;
      gutter.innerHTML = Array.from({ length: n }, (_, i) => `<span>${i + 1}</span>`).join('\n');
      prevLine = 0;
      applyMarkers();
    }
  }
  function syncScroll() {
    const t = input.scrollTop, l = input.scrollLeft;
    hl.style.transform = `translate(${-l}px, ${-t}px)`;
    gutter.style.transform = `translateY(${-t}px)`;
    placeCurLine();
  }
  function lineOf(pos) { let n = 1; const v = input.value; for (let i = v.indexOf('\n'); i !== -1 && i < pos; i = v.indexOf('\n', i + 1)) n++; return n; }
  function placeCurLine() { cur.style.transform = `translateY(${12 + (S.ui.cursor.line - 1) * lh() - input.scrollTop}px)`; }
  let prevLine = 0;
  function updateCursor() {
    const p = input.selectionStart, v = input.value, line = lineOf(p), col = p - (v.lastIndexOf('\n', p - 1) + 1) + 1;
    S.ui.cursor = { line, col }; view[buffer].sel = [input.selectionStart, input.selectionEnd];
    if (prevLine !== line) { const g = gutter.children; if (g[prevLine - 1]) g[prevLine - 1].classList.remove('is-current'); if (g[line - 1]) g[line - 1].classList.add('is-current'); prevLine = line; }
    placeCurLine(); store.emit('cursor'); updateBracketMatch();
  }

  /* ---- bracket matching ---- */
  /* Returns array of char indices of real (unquoted, uncommented) '{' and '}' in v. */
  function realBracePositions(v) {
    const positions = [];
    let i = 0, inStr = false, lineComment = false;
    while (i < v.length) {
      const c = v[i];
      if (c === '\n') { lineComment = false; i++; continue; }
      if (lineComment) { i++; continue; }
      if (!inStr && c === '/' && v[i + 1] === '/') { lineComment = true; i += 2; continue; }
      if (!inStr && c === '/' && v[i + 1] === '*') {
        i += 2; while (i < v.length && !(v[i] === '*' && v[i + 1] === '/')) i++; i += 2; continue;
      }
      if (!inStr && c === '"') { inStr = true; i++; continue; }
      if (inStr && c === '\\') { i += 2; continue; }
      if (inStr && c === '"') { inStr = false; i++; continue; }
      if (!inStr && (c === '{' || c === '}')) positions.push(i);
      i++;
    }
    return positions;
  }
  function findBraceMatch(positions, idx, isOpen, v) {
    /* returns index into positions[] of the matching brace, or -1 */
    let depth = 1;
    if (isOpen) { for (let i = idx + 1; i < positions.length; i++) { if (v[positions[i]] === '{') depth++; else if (--depth === 0) return i; } }
    else { for (let i = idx - 1; i >= 0; i--) { if (v[positions[i]] === '}') depth++; else if (--depth === 0) return i; } }
    return -1;
  }
  function updateBracketMatch() {
    hl.querySelectorAll('.t-br-match').forEach((el) => el.classList.remove('t-br-match'));
    const v = input.value, p = input.selectionStart;
    const positions = realBracePositions(v);
    /* find which real brace is at or just before the caret */
    let targetIdx = positions.indexOf(p);
    if (targetIdx < 0) targetIdx = positions.indexOf(p - 1);
    if (targetIdx < 0) return;
    const targetPos = positions[targetIdx], isOpen = v[targetPos] === '{';
    const matchIdx = findBraceMatch(positions, targetIdx, isOpen, v);
    const spans = hl.querySelectorAll('[class^="t-br"]');
    if (spans[targetIdx]) spans[targetIdx].classList.add('t-br-match');
    if (matchIdx >= 0 && spans[matchIdx]) spans[matchIdx].classList.add('t-br-match');
  }

  /* ---- buffer switching ---- */
  function loadBuffer(id, { keepView = true } = {}) {
    if (input.dataset.buf) { view[input.dataset.buf].top = input.scrollTop; view[input.dataset.buf].left = input.scrollLeft; view[input.dataset.buf].sel = [input.selectionStart, input.selectionEnd]; }
    buffer = id; input.dataset.buf = id; root.dataset.lang = id;
    const text = Doc.bufferText(id); input.value = text;
    const h = hist[id]; if (!h.stack.length) { h.stack = [{ v: text, s: [0, 0] }]; h.i = 0; } else if (h.stack[h.i].v !== text) push(true);
    lineCount = -1; prevLine = 0; render(); applyMarkers();
    const v = view[id]; input.setSelectionRange(Math.min(v.sel[0], text.length), Math.min(v.sel[1], text.length));
    input.scrollTop = keepView ? v.top : 0; input.scrollLeft = keepView ? v.left : 0; syncScroll(); updateCursor();
  }
  function resetHistory() { hist.xnp = { stack: [], i: -1, t: 0 }; hist.xcss = { stack: [], i: -1, t: 0 }; view.xnp = { sel: [0, 0], top: 0, left: 0 }; view.xcss = { sel: [0, 0], top: 0, left: 0 }; }

  /* ---- editing primitives ---- */
  function afterEdit(force) { Doc.setText(buffer, input.value, 'user'); push(force); render(); updateCursor(); }
  function replaceRange(start, end, text, caret) {
    const v = input.value; input.value = v.slice(0, start) + text + v.slice(end);
    const c = caret == null ? start + text.length : caret; input.setSelectionRange(c, c); afterEdit(true);
  }
  function indentSelection(outdent) {
    const v = input.value, s = input.selectionStart, e = input.selectionEnd, u = unit();
    const a = v.lastIndexOf('\n', s - 1) + 1; let b = v.indexOf('\n', e > s && v[e - 1] === '\n' ? e - 1 : e); if (b < 0) b = v.length;
    const lines = v.slice(a, b).split('\n'); let first = 0, total = 0;
    const out = lines.map((l, i) => {
      let nl = l;
      if (!outdent) nl = l.trim() || lines.length === 1 ? u + l : l;
      else if (l.startsWith(u)) nl = l.slice(u.length); else if (l.startsWith('\t')) nl = l.slice(1); else nl = l.replace(/^ {1,4}/, '');
      const d = nl.length - l.length; if (i === 0) first = d; total += d; return nl;
    });
    input.value = v.slice(0, a) + out.join('\n') + v.slice(b);
    input.setSelectionRange(Math.max(a, s + first), e + total); afterEdit(true);
  }
  function onKeydown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && !e.altKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod || e.altKey) return;
    const v = input.value, s = input.selectionStart, e2 = input.selectionEnd;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey || (s !== e2 && v.slice(s, e2).includes('\n'))) indentSelection(e.shiftKey);
      else replaceRange(s, e2, unit());
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const ls = v.lastIndexOf('\n', s - 1) + 1, before = v.slice(ls, s), ind = /^[ \t]*/.exec(before)[0];
      const opens = /\{\s*$/.test(before), closes = v[e2] === '}';
      if (opens && closes) replaceRange(s, e2, '\n' + ind + unit() + '\n' + ind, s + 1 + ind.length + unit().length);
      else replaceRange(s, e2, '\n' + ind + (opens ? unit() : ''));
    } else if (e.key === '}' && s === e2) {
      const ls = v.lastIndexOf('\n', s - 1) + 1, before = v.slice(ls, s);
      if (before && !before.trim() && before.endsWith(unit())) { e.preventDefault(); replaceRange(s - unit().length, s, '}'); }
    }
  }

  /* ---- snippet insertion (always into the XNP source) ---- */
  function insertSnippet(text) {
    if (S.ui.tab !== 'xnp') { S.ui.tab = 'xnp'; store.emit('ui'); }
    const v = input.value, s = input.selectionStart, e = input.selectionEnd;
    const ls = v.lastIndexOf('\n', s - 1) + 1; let le = v.indexOf('\n', e); if (le < 0) le = v.length;
    const line = v.slice(ls, le), blank = !line.trim();
    const ind = /^[ \t]*/.exec(blank ? line : v.slice(ls, s) || line)[0] + (!blank && /\{\s*$/.test(line) ? unit() : '');
    const body = text.split('\n').map((l) => ind + l).join('\n'), idx = body.indexOf('$0');
    const clean = body.replace('$0', ''), pre = blank ? v.slice(0, ls) : v.slice(0, le) + '\n\n';
    input.value = pre + clean + v.slice(le);
    const c = pre.length + (idx < 0 ? clean.length : idx); input.setSelectionRange(c, c);
    afterEdit(true); input.focus();
  }
  function selectAll() { input.focus(); input.select(); updateCursor(); }

  /* ---- wiring ---- */
  input.addEventListener('input', () => afterEdit(false));
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('scroll', syncScroll);
  ['keyup', 'mouseup', 'focus'].forEach((ev) => input.addEventListener(ev, updateCursor));
  document.addEventListener('selectionchange', () => { if (document.activeElement === input) updateCursor(); });
  new ResizeObserver(syncScroll).observe(input);

  store.on('text', ({ buffer: b, source }) => { if (source === 'sync' && b === buffer && input.value !== Doc.bufferText(b)) { const p = input.selectionStart; input.value = Doc.bufferText(b); input.setSelectionRange(p, p); push(true); render(); updateCursor(); } });
  store.on('ui', () => { if (S.ui.tab !== buffer && (S.ui.tab === 'xnp' || D.xcss)) loadBuffer(S.ui.tab); });
  store.on('doc', () => { if (D.loadId !== lastLoad) { lastLoad = D.loadId; resetHistory(); clearMarkers(); input.dataset.buf = ''; loadBuffer(S.ui.tab, { keepView: false }); } });
  store.on('prefs', () => { render(); syncScroll(); });

  Xen.editor = {
    undo, redo, selectAll, insertSnippet, replaceRange, focus: () => input.focus({ preventScroll: true }),
    get value() { return input.value; }, get selection() { return [input.selectionStart, input.selectionEnd]; },
    setSelection(s, e) { input.setSelectionRange(s, e); updateCursor(); },
    revealLine(line) { const top = (line - 1) * lh(), h = input.clientHeight; if (top < input.scrollTop + lh() || top > input.scrollTop + h - lh() * 3) input.scrollTop = Math.max(0, top - h / 3); },
    get buffer() { return buffer; }, lineOf, setMarkers, clearMarkers,
  };
  Xen.commands.registerAll({ 'edit.undo': () => { Xen.editor.focus(); undo(); }, 'edit.redo': () => { Xen.editor.focus(); redo(); }, 'edit.selectAll': selectAll,
    'insert.snippet': (id) => { const s = Xen.snippets.find(id); if (s) insertSnippet(s.text); },
    'insert.module': (m) => { if (S.ui.tab !== 'xnp') { S.ui.tab = 'xnp'; store.emit('ui'); } const next = Doc.setModule(input.value, m); if (next !== input.value) { input.value = next; afterEdit(true); } } });
})();
