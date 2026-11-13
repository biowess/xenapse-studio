/* Find / replace bar for the active buffer. */
(function () {
  const { $ } = Xen.util, bar = $('#findbar'), q = $('#find-q'), r = $('#find-r'), count = $('#find-count'), rrow = $('#find-replace-row'), caseBtn = $('#find-case');
  let matchCase = false;
  const hits = () => {
    const needle = q.value; if (!needle) return [];
    const hay = matchCase ? Xen.editor.value : Xen.editor.value.toLowerCase(), n = matchCase ? needle : needle.toLowerCase(), out = [];
    for (let i = hay.indexOf(n); i !== -1; i = hay.indexOf(n, i + n.length || 1)) out.push(i);
    return out;
  };
  function label(list, idx) { count.textContent = !q.value ? '' : list.length ? `${idx + 1} of ${list.length}` : 'No results'; }
  function go(dir, fromStart) {
    const list = hits(), len = q.value.length; if (!list.length) return label(list, 0);
    const [s, e] = Xen.editor.selection; let idx;
    if (dir > 0) { idx = list.findIndex((p) => p >= (fromStart ? s : e)); if (idx < 0) idx = 0; }
    else { idx = list.length - 1; for (let i = list.length - 1; i >= 0; i--) if (list[i] < s) { idx = i; break; } }
    Xen.editor.setSelection(list[idx], list[idx] + len); Xen.editor.revealLine(Xen.editor.lineOf(list[idx])); label(list, idx);
  }
  function open(withReplace) {
    bar.hidden = false; rrow.hidden = !withReplace;
    const [s, e] = Xen.editor.selection; if (e > s && !Xen.editor.value.slice(s, e).includes('\n')) q.value = Xen.editor.value.slice(s, e);
    q.focus(); q.select(); label(hits(), 0);
  }
  function close() { if (bar.hidden) return; bar.hidden = true; Xen.editor.focus(); }
  function replaceOne() {
    const [s, e] = Xen.editor.selection, sel = Xen.editor.value.slice(s, e);
    if (sel && (matchCase ? sel === q.value : sel.toLowerCase() === q.value.toLowerCase())) { Xen.editor.replaceRange(s, e, r.value); }
    go(1, true);
  }
  function replaceAll() {
    const list = hits(); if (!list.length) return;
    const len = q.value.length; let v = Xen.editor.value, out = '', last = 0;
    list.forEach((p) => { out += v.slice(last, p) + r.value; last = p + len; }); out += v.slice(last);
    Xen.editor.replaceRange(0, v.length, out, 0); label(hits(), 0); Xen.toast(`Replaced ${list.length} occurrence${list.length === 1 ? '' : 's'}.`, { kind: 'success' });
  }
  q.addEventListener('input', () => { label(hits(), 0); if (q.value) go(1, true); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1); } });
  bar.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  Xen.commands.registerAll({
    'edit.find': () => open(false), 'edit.replace': () => open(true), 'find.next': () => go(1), 'find.prev': () => go(-1), 'find.close': close,
    'find.case': () => { matchCase = !matchCase; caseBtn.setAttribute('aria-pressed', matchCase); label(hits(), 0); }, 'find.replace': replaceOne, 'find.replaceAll': replaceAll,
  });
  Xen.find = { close };
})();
