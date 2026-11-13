/* Menu bar + popup menus. Menu contents are rebuilt on open so they always reflect current state
   (e.g. the context-aware XCSS entries in Insert). */
(function () {
  const { store, util } = Xen, S = store.state, D = S.doc, { esc, fmtKeys, $, $$ } = util;
  const layer = $('#menu-layer'), bar = $('#menubar');
  let cur = null;                                   // { id, anchor, el, popup }
  const item = (label, cmd, o = {}) => Object.assign({ label, cmd }, o), SEP = { sep: true }, head = (t) => ({ heading: t });
  const ico = Xen.icons.svg;

  const defs = {
    edit: () => [item('Undo', 'edit.undo', { kbd: 'Mod+Z' }), item('Redo', 'edit.redo', { kbd: 'Mod+Y' }), SEP,
      item('Find', 'edit.find', { kbd: 'Mod+F' }), item('Replace', 'edit.replace', { kbd: 'Mod+H' }), SEP, item('Select all', 'edit.selectAll', { kbd: 'Mod+A' })],
    insert: () => {
      const p = Xen.xcss.primary(), out = [head('Module'), item('IMPORT FLOW', 'insert.module', { arg: 'FLOW' }), item('IMPORT MINDMAP', 'insert.module', { arg: 'MINDMAP' })];
      Xen.snippets.groups.forEach((g) => { out.push(head(g.title)); g.items.forEach((i) => out.push(item(i.label, 'insert.snippet', { arg: i.id }))); });
      out.push(head('XCSS stylesheet'), item(p.label, 'xcss.primary'));
      if (!D.xcss) out.push(item('Add new stylesheet', 'xcss.add'), item('Attach existing stylesheet…', 'xcss.attachExisting'));
      else {
        if (D.xcss.state === 'missing' && p.label !== 'Create missing stylesheet') out.push(item('Create missing stylesheet', 'xcss.createMissing'));
        out.push(item('Detach stylesheet…', 'xcss.detach'));
      }
      return out;
    },
    view: () => {
      const L = S.ui.layout, T = Xen.prefs.get('theme');
      return [head('Layout'), item('Source and preview, side by side', 'view.layout', { arg: 'split-h', checked: L === 'split-h' }), item('Source above preview', 'view.layout', { arg: 'split-v', checked: L === 'split-v' }),
        item('Source only', 'view.layout', { arg: 'source', checked: L === 'source' }), item('Preview only', 'view.layout', { arg: 'preview', checked: L === 'preview' }),
        head('Zoom'), item('Zoom in', 'zoom.in', { kbd: 'Mod+=' }), item('Zoom out', 'zoom.out', { kbd: 'Mod+-' }), item('Actual size', 'zoom.actual', { kbd: 'Mod+1' }), item('Fit preview', 'zoom.fit', { kbd: 'Mod+0' }),
        head('Appearance'), item('Light', 'theme.set', { arg: 'light', checked: T === 'light' }), item('Dark', 'theme.set', { arg: 'dark', checked: T === 'dark' }), item('Match system', 'theme.set', { arg: 'system', checked: T === 'system' }),
        head('Panels'), item('Status bar', 'view.statusbar', { checked: S.ui.statusbar, check: true }), item('Line numbers', 'view.lineNumbers', { checked: Xen.prefs.get('lineNumbers'), check: true })];
    },
    help: () => [item('Welcome Screen', 'welcome.show'), SEP, item('Documentation', 'help.docs'), item('Language Reference', 'help.reference'), item('Keyboard shortcuts', 'help.shortcuts', { kbd: 'F1' }), SEP, item('About Xenapse Studio', 'help.about')],
    stylesheet: () => [item('Export a copy…', 'xcss.extract'), SEP, item('Detach stylesheet…', 'xcss.detach')],
  };

  function html(items) {
    return items.map((i) => {
      if (i.sep) return '<div class="menu__sep" role="separator"></div>';
      if (i.heading) return `<div class="menu__heading" role="presentation">${esc(i.heading)}</div>`;
      const role = i.checked === undefined ? 'menuitem' : i.check ? 'menuitemcheckbox' : 'menuitemradio';
      return `<button class="menu__item" role="${role}" ${i.checked === undefined ? '' : `aria-checked="${!!i.checked}"`} data-cmd="${i.cmd}" ${i.arg != null ? `data-arg="${esc(i.arg)}"` : ''} ${i.disabled ? 'disabled' : ''}><span class="menu__check">${i.checked ? ico('check') : ''}</span><span class="menu__label">${esc(i.label)}</span>${i.kbd ? `<span class="kbd">${esc(fmtKeys(i.kbd))}</span>` : ''}</button>`;
    }).join('');
  }
  function close(refocus) {
    if (!cur) return; const a = cur.anchor; cur.el.remove(); a.setAttribute('aria-expanded', 'false'); a.classList.remove('is-open'); cur = null;
    if (refocus) a.focus();
  }
  function open(id, anchor, { popup = false, focusFirst = false } = {}) {
    close(); const el = document.createElement('div'); el.className = 'menu'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', id);
    el.innerHTML = html(defs[id]()); layer.appendChild(el); anchor.setAttribute('aria-expanded', 'true');
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth;
    el.style.top = r.bottom + (popup ? 2 : 0) + 'px'; el.style.left = util.clamp(popup ? r.right - w : r.left, 8, window.innerWidth - w - 8) + 'px';
    cur = { id, anchor, el, popup };
    if (focusFirst) { const f = $('.menu__item:not(:disabled)', el); f && f.focus(); }
  }
  const items = () => $$('.menu__item:not(:disabled)', cur.el);
  const barBtns = () => $$('.menubar__btn', bar);

  function openTop(btn, focusFirst) { const id = btn.dataset.menu; if (id === 'file') { close(); Xen.commands.run('file.open'); return; } open(id, btn, { focusFirst }); }
  bar.addEventListener('click', (e) => { const b = e.target.closest('.menubar__btn'); if (!b) return; if (cur && cur.anchor === b) close(); else openTop(b, false); });
  bar.addEventListener('keydown', (e) => {
    const b = e.target.closest('.menubar__btn'); if (!b) return; const all = barBtns(), i = all.indexOf(b);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]; n.focus(); if (cur && n.dataset.menu !== 'file') open(n.dataset.menu, n, { focusFirst: true }); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTop(b, true); }
  });
  document.addEventListener('click', (e) => {
    const pop = e.target.closest('[data-popup]');
    if (pop) { if (cur && cur.anchor === pop) close(); else open(pop.dataset.popup, pop, { popup: true }); return; }
    if (cur && (e.target.closest('.menu') || !e.target.closest('.menubar__btn'))) close(false);
  });
  document.addEventListener('keydown', (e) => {
    if (!cur) return;
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    const list = items(), i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); } else if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
    else if (!cur.popup && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); const all = barBtns(), n = all[(all.indexOf(cur.anchor) + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]; if (n.dataset.menu === 'file') close(true); else open(n.dataset.menu, n, { focusFirst: true }); }
    else if (e.key === 'Tab') close(false);
  });
  window.addEventListener('blur', () => close(false)); window.addEventListener('resize', () => close(false));
  Xen.menus = { isOpen: () => !!cur, close, setFileActive: (on) => $('[data-menu="file"]', bar).classList.toggle('is-active', on) };
})();
