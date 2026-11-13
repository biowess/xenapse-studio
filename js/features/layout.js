/* Workspace layout (side-by-side / stacked / single pane), resizable divider, status bar toggle. */
(function () {
  const { store, util } = Xen, S = store.state, { $ } = util, ws = $('#workspace'), divider = $('#divider'), app = $('#app');
  const KEY = 'xenapse.layout.v1';
  try { Object.assign(S.ui, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ layout: S.ui.layout, split: S.ui.split, statusbar: S.ui.statusbar })); } catch (e) { /* */ } };
  const effective = () => (S.ui.layout === 'split-h' && window.innerWidth < 860 ? 'split-v' : S.ui.layout);

  function apply() {
    const eff = effective(), r = S.ui.split, track = `minmax(0, ${r}fr) var(--divider-w) minmax(0, ${1 - r}fr)`;
    ws.dataset.eff = eff; ws.style.gridTemplateColumns = eff === 'split-h' ? track : ''; ws.style.gridTemplateRows = eff === 'split-v' ? track : '';
    divider.setAttribute('aria-orientation', eff === 'split-v' ? 'horizontal' : 'vertical');
    divider.setAttribute('aria-valuenow', Math.round(r * 100)); app.dataset.statusbar = S.ui.statusbar ? 'on' : 'off';
  }
  function setLayout(l) { S.ui.layout = l; apply(); persist(); store.emit('ui'); }
  let dragging = false;
  divider.addEventListener('pointerdown', (e) => { dragging = true; divider.setPointerCapture(e.pointerId); divider.classList.add('is-dragging'); document.body.classList.add('is-resizing'); });
  divider.addEventListener('pointermove', (e) => {
    if (!dragging) return; const b = ws.getBoundingClientRect(), v = ws.dataset.eff === 'split-v';
    S.ui.split = util.clamp(v ? (e.clientY - b.top) / b.height : (e.clientX - b.left) / b.width, 0.2, 0.8); apply();
  });
  const stop = () => { if (!dragging) return; dragging = false; divider.classList.remove('is-dragging'); document.body.classList.remove('is-resizing'); persist(); };
  divider.addEventListener('pointerup', stop); divider.addEventListener('pointercancel', stop);
  divider.addEventListener('dblclick', () => { S.ui.split = 0.5; apply(); persist(); });
  divider.addEventListener('keydown', (e) => {
    const v = ws.dataset.eff === 'split-v', d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key]; if (!d || (v && /Left|Right/.test(e.key)) || (!v && /Up|Down/.test(e.key))) return;
    e.preventDefault(); S.ui.split = util.clamp(S.ui.split + d * 0.02, 0.2, 0.8); apply(); persist();
  });
  window.addEventListener('resize', apply);
  Xen.layout = { apply, setLayout };
  Xen.commands.registerAll({
    'view.layout': setLayout,
    'view.statusbar': () => { S.ui.statusbar = !S.ui.statusbar; apply(); persist(); store.emit('ui'); },
    'view.lineNumbers': () => Xen.prefs.set('lineNumbers', !Xen.prefs.get('lineNumbers')),
    'theme.set': (t) => Xen.prefs.set('theme', t),
    'theme.toggle': () => Xen.prefs.set('theme', Xen.prefs.resolvedTheme() === 'dark' ? 'light' : 'dark'),
  });
})();
