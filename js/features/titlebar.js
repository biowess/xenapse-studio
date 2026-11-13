/* Custom top bar behaviour: window controls, window-state hooks on <html>, document-area visibility. */
(function () {
  const { $ } = Xen.util, N = Xen.native, W = N && N.window, root = document.documentElement;
  const ctl = $('#wincontrols'), docEl = $('#topbar-title') || $('#topbar-doc'), saveBtn = $('#topbar-save'), maxBtn = $('#win-max'), bar = $('#topbar');
  const os = Xen.platform.os;

  root.dataset.platform = os;
  root.dataset.native = W ? '1' : '0';
  root.dataset.maximized = 'false';
  root.dataset.fullscreen = 'false';
  root.dataset.windowFocused = 'true';

  function setIcon(el, name) { el.dataset.icon = name; el.innerHTML = Xen.icons.svg(name); el.dataset.ready = '1'; }

  function applyState(s) {
    root.dataset.maximized = String(!!s.maximized);
    root.dataset.fullscreen = String(!!s.fullscreen);
    root.dataset.windowFocused = String(!!s.focused);
    const label = s.maximized ? 'Restore' : 'Maximize';
    setIcon($('i', maxBtn), s.maximized ? 'win-restore' : 'win-maximize');
    maxBtn.setAttribute('aria-label', label); maxBtn.title = label;
  }

  function setDocumentVisible(on) { docEl.hidden = !on; saveBtn.hidden = !on; }

  if (!W) {
    ctl.hidden = true; /* browser preview: no window controls, normal browser behaviour */
  } else {
    $('#win-min').addEventListener('click', () => W.minimize());
    maxBtn.addEventListener('click', () => W.toggleMaximize());
    $('#win-close').addEventListener('click', () => W.close());
    W.onStateChange(applyState);
    W.getState().then(applyState).catch(() => {});
    /* Windows toggles maximize natively on double-click of the drag region; handle it here only on Linux. */
    if (os === 'linux') {
      bar.addEventListener('dblclick', (e) => {
        if (e.target.closest('button, nav, .wincontrols, .menu')) return;
        W.toggleMaximize();
      });
    }
  }

  Xen.titlebar = { setDocumentVisible };
})();
