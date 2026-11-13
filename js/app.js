/* Application bootstrap: chrome rendering (tabs, status bar, title), help dialogs, recovery, drag-and-drop. */
(function () {
  const { store, util } = Xen, S = store.state, D = S.doc, Doc = Xen.doc, { $, esc } = util;
  const RECOVERY = 'xenapse.recovery.v1';

  /* ---------- tabs ---------- */
  let tabSig = '';
  function renderTabs() {
    const x = D.xcss, act = S.ui.tab, showX = S.ui.xcssOpen && x;
    const sig = [act, showX, x && x.state, x && x.fileName, Doc.xnpFileName(), Doc.xnpDirty(), Doc.xcssDirty()].join('|');
    if (sig === tabSig) return; tabSig = sig;
    const dot = '<span class="dirty-dot" title="Unsaved changes"></span>';
    let h = `<div class="tab${act === 'xnp' ? ' is-active' : ''}" data-lang="xnp"><button class="tab__main" role="tab" aria-selected="${act === 'xnp'}" data-cmd="tab.switch" data-arg="xnp"><span class="tab__lang">XNP</span><span class="tab__name">${esc(Doc.xnpFileName())}</span>${Doc.xnpDirty() ? dot : ''}</button><span class="tab__pad"></span></div>`;
    if (showX) h += `<div class="tab${act === 'xcss' ? ' is-active' : ''}" data-lang="xcss"><button class="tab__main" role="tab" aria-selected="${act === 'xcss'}" data-cmd="tab.switch" data-arg="xcss"><span class="tab__lang">XCSS</span><span class="tab__name">${esc(x.fileName)}</span>${x.state === 'missing' ? '<span class="tab__note">Not found</span>' : ''}${Doc.xcssDirty() ? dot : ''}</button><button class="tab__close" data-cmd="xcss.closeTab" aria-label="Close XCSS tab" title="Close tab (the stylesheet stays attached)"><i data-icon="x"></i></button></div>`;
    h += '<div class="tabs__spacer"></div>';
    if (showX && act === 'xcss') h += '<div class="tabs__tools"><button class="btn btn--sm btn--ghost" data-popup="stylesheet" aria-haspopup="true" aria-expanded="false">Stylesheet <i data-icon="chevron-down"></i></button></div>';
    const tabs = $('#tabs'); tabs.innerHTML = h; Xen.icons.hydrate(tabs);
  }

  /* ---------- status bar / title ---------- */
  function renderChrome() {
    renderTabs();
    const dirty = Doc.isDirty ? Doc.isDirty() : false;
    const isWelcome = Xen.welcome && Xen.welcome.isOpen();
    const titleEl = $('#topbar-title') || $('#topbar-doc');
    if (titleEl) {
      if (isWelcome) {
        titleEl.textContent = 'Xenapse Studio';
      } else {
        titleEl.innerHTML = `Xenapse Studio${dirty ? '<span class="dirty-dot" title="Unsaved changes"></span>' : ''}`;
      }
    }
    document.title = isWelcome ? 'Xenapse Studio' : `${dirty ? '• ' : ''}${Doc.xnpFileName()} — Xenapse Studio`;
    const brandBtn = $('.brand');
    if (brandBtn) brandBtn.style.display = isWelcome ? 'none' : '';
    const topbarSave = $('#topbar-save');
    if (topbarSave) topbarSave.style.display = isWelcome ? 'none' : '';
    $('#st-state').innerHTML = dirty ? '<span class="dirty-dot"></span>Unsaved changes' : 'No unsaved changes';
    $('#st-module').textContent = Xen.engine.detectModule(D.xnp.text) || 'No module';
    $('#st-pos').textContent = `Ln ${S.ui.cursor.line}, Col ${S.ui.cursor.col}`;
    $('#st-indent').textContent = Xen.prefs.get('indentUnit') === 'tabs' ? `Tabs: ${Xen.prefs.get('tabWidth')}` : `Spaces: ${Xen.prefs.get('tabWidth')}`;
    $('#st-lang').textContent = S.ui.tab === 'xnp' ? 'XNP' : 'XCSS';
    const comp = Xen.compiler ? Xen.compiler.status() : null;
    const stEngine = $('#st-engine');
    if (stEngine) {
      if (S.ui.compiling) {
        stEngine.textContent = 'Compiling…';
      } else if (comp && comp.usable && comp.version) {
        stEngine.textContent = `Xenapse Language ${comp.version}`;
      } else {
        stEngine.textContent = 'Compiler not found';
      }
      stEngine.removeAttribute('title');
    }
    const stProblems = $('#st-problems');
    if (stProblems && Xen.diagnostics) {
      const counts = Xen.diagnostics.counts();
      const parts = [];
      if (counts.errors > 0) parts.push(`${counts.errors} error${counts.errors > 1 ? 's' : ''}`);
      if (counts.warnings > 0) parts.push(`${counts.warnings} warning${counts.warnings > 1 ? 's' : ''}`);
      stProblems.textContent = parts.length ? parts.join(', ') : 'No problems';
      stProblems.classList.toggle('has-errors', counts.errors > 0);
      stProblems.classList.toggle('has-warnings', counts.warnings > 0 && counts.errors === 0);
    }
  }
  let raf = 0; const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderChrome(); }); };
  store.on('compiler:running', (running) => { S.ui.compiling = running; schedule(); });
  ['text', 'doc', 'ui', 'cursor', 'prefs', 'compiler:status', 'diagnostics:update'].forEach((t) => store.on(t, schedule));
  $('#st-problems')?.addEventListener('click', () => Xen.diagnostics?.toggle(true));

  /* ---------- commands owned by the shell ---------- */
  Xen.commands.registerAll({
    'tab.switch': (id) => { if (id === 'xcss' && !(D.xcss && S.ui.xcssOpen)) return; S.ui.tab = id; store.emit('ui'); Xen.editor.focus(); },
    'help.docs': () => Xen.commands.run('docs.show', 'overview.md'),
    'help.reference': () => Xen.commands.run('docs.show', 'decisions.md'),
    'help.shortcuts': () => Xen.dialogs.info({ title: 'Keyboard shortcuts', html: Xen.shortcutsHtml() }),
    'app.home': () => (Xen.welcome ? Xen.welcome.show() : null),
  });

  /* ---------- recovery + close protection ---------- */
  if (Xen.native && Xen.native.window) {
    Xen.native.window.onCloseRequested(async () => {
      if (await Xen.files.confirmUnsaved('Closing the window will discard unsaved changes.')) {
        Xen.native.window.confirmClose();
      }
    });
  }

  let recoveryBusy = false;
  setInterval(async () => {
    if (recoveryBusy || !Xen.prefs.get('autosave')) return;
    if (!Doc.isDirty()) {
      try { await Xen.fileService.clearRecovery(); } catch (e) {}
      return;
    }
    recoveryBusy = true;
    try {
      await Xen.fileService.writeRecovery({
        t: Date.now(),
        fileName: D.fileName,
        path: D.path,
        eol: D.eol,
        xnp: D.xnp.text,
        xcss: D.xcss ? { declared: D.xcss.declared, text: D.xcss.text, path: D.xcss.path, state: D.xcss.state } : null,
      });
    } catch (e) { /* write failed */ }
    finally { recoveryBusy = false; }
  }, 4000);

  async function offerRecovery() {
    if (Xen.dependency && Xen.dependency.isVisible()) return;
    let snap = null;
    try { snap = await Xen.fileService.readRecovery(); } catch (e) {}
    if (!snap || !snap.xnp || !Xen.prefs.get('recovery')) return;
    const fileName = snap.fileName || 'untitled.xnp';
    const dateStr = snap.t ? new Date(snap.t).toLocaleString() : 'a previous session';
    const r = await Xen.dialogs.choose({
      title: 'Restore unsaved work?',
      message: `A recovery copy of “${fileName}” from ${dateStr} was found.`,
      actions: [
        { id: 'discard', label: 'Discard it', kind: 'danger' },
        { spacer: true },
        { id: 'restore', label: 'Restore', kind: 'primary' },
      ],
    });
    if (r === 'restore') {
      const sx = snap.xcss && typeof snap.xcss.text === 'string' ? snap.xcss : null;
      Doc.load({
        fileName,
        path: snap.path || null,
        eol: snap.eol || 'lf',
        xnp: snap.xnp,
        xcss: sx ? { text: sx.text, path: sx.path || null, state: sx.state || 'loaded' } : null,
        dirty: true,
      });
      if (Xen.welcome) Xen.welcome.hide();
    }
    try { await Xen.fileService.clearRecovery(); } catch (e) {}
  }

  /* ---------- drag and drop ---------- */
  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
  });
  window.addEventListener('drop', async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    if (!Xen.native || !Xen.native.files) return;
    const files = Array.from(e.dataTransfer.files);
    const paths = files.map((f) => Xen.native.files.getPathForFile(f)).filter(Boolean);
    if (!paths.length) return;
    const granted = await Xen.native.files.grantDropped(paths);
    const xnp = granted.find((p) => /\.xnp$/i.test(p));
    const xcss = paths.find((p) => /\.xcss$/i.test(p));
    if (xnp) {
      await Xen.files.openPath(xnp);
    } else if (xcss) {
      Xen.toast('Drop a .xnp file to open it. Stylesheets open together with their document.', { kind: 'warn' });
    } else {
      Xen.dialogs.alert({ title: 'Unsupported file type', message: 'Only Xenapse documents (.xnp) can be opened.', error: true });
    }
  });

  /* ---------- second-instance listener ---------- */
  if (Xen.native && Xen.native.files) {
    Xen.native.files.onOpenRequested((reqPath) => {
      Xen.files.openPath(reqPath);
      if (Xen.welcome) Xen.welcome.hide();
    });
  }

  /* ---------- start ---------- */
  Xen.prefs.apply(); Xen.icons.hydrate(); Xen.layout.apply();
  (async () => {
    if (Xen.compiler) {
      await Xen.compiler.init();
      if (!Xen.compiler.status().usable && Xen.dependency) {
        Xen.dependency.show();
      }
    }
    renderChrome();
    let opened = false;
    if (Xen.native && Xen.native.files) {
      try {
        const launch = await Xen.native.files.getLaunchFiles();
        if (launch && launch.length) {
          await Xen.files.openPath(launch[0]);
          opened = true;
        }
      } catch (e) {}
    }
    if (!opened) {
      if (Xen.welcome) {
        Xen.welcome.show();
      }
    }
    renderChrome();
    await offerRecovery();
  })();
})();
