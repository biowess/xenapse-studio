/* File backstage: desktop navigation + contextual panels with fluid layout and accessible focus */
(function () {
  const { store, util } = Xen;
  const S = store.state;
  const { $, $$ } = util;
  const el = $('#backstage');

  const NAV = [
    ['welcome', 'Home', 'home'],
    null,
    ['new', 'New', 'new'],
    ['open', 'Open', 'open'],
    ['save', 'Save', 'save'],
    ['saveas', 'Save As', 'saveas'],
    ['export', 'Export', 'export'],
    null,
    ['preferences', 'Preferences', 'settings'],
    ['docs', 'Documentation', 'book-open'],
    ['about', 'About', 'info']
  ];

  const inertTargets = () => ['#menubar', '#workspace', '#statusbar'].map((s) => $(s));

  function render(focusKey) {
    const id = S.ui.backstage;
    if (!id || !Xen.panels[id]) return;
    const p = Xen.panels[id]();
    const prev = $('.bs-content', el);
    const top = prev ? prev.scrollTop : 0;

    const existingNav = $('.bs-nav', el);
    const content = $('.bs-content', el);
    if (existingNav && content) {
      $$('.bs-nav__item', el).forEach((b) => {
        const isAct = b.id === `bs-tab-${id}`;
        b.classList.toggle('is-active', isAct);
        if (isAct) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      content.setAttribute('aria-label', id);
      content.innerHTML = p.html;
      Xen.icons.hydrate(content);
      if (p.bind) p.bind(content);
      content.scrollTop = 0;
      if (focusKey) {
        const t = $(`[data-pref="${focusKey.pref}"]${focusKey.val != null ? `[data-val="${focusKey.val}"]` : ''}`, el) ||
                  $(`[data-pref-step="${focusKey.step}"]`, el);
        if (t) t.focus();
      }
      return;
    }

    const navItems = NAV.map((n) => {
      if (!n) return '<div class="bs-nav__sep" role="separator"></div>';
      const isAct = n[0] === id;
      return `<button class="bs-nav__item${isAct ? ' is-active' : ''}" data-cmd="backstage.show" data-arg="${n[0]}" ${isAct ? 'aria-current="page"' : ''} role="tab" id="bs-tab-${n[0]}">
        <i data-icon="${n[2]}"></i>
        <span>${n[1]}</span>
      </button>`;
    }).join('');

    el.innerHTML = `
      <nav class="bs-nav" aria-label="Backstage navigation" role="tablist">
        <button class="bs-back" data-cmd="backstage.close" title="Return to editor workspace (Esc)">
          <i data-icon="arrow-left"></i>
          <span>Back to workspace</span>
        </button>
        <div class="bs-nav__items">${navItems}</div>
        <div class="bs-nav__foot">
          <div class="bs-nav__brand">Xenapse Studio</div>
          <div class="bs-nav__version">0.1.0 &bull; Biowess</div>
        </div>
      </nav>
      <main class="bs-content" role="region" aria-label="${id}" id="bs-content-region">
        ${p.html}
      </main>
    `;

    Xen.icons.hydrate(el);
    if (p.bind) p.bind($('.bs-content', el));
    $('.bs-content', el).scrollTop = top;

    if (focusKey) {
      const t = $(`[data-pref="${focusKey.pref}"]${focusKey.val != null ? `[data-val="${focusKey.val}"]` : ''}`, el) ||
                $(`[data-pref-step="${focusKey.step}"]`, el);
      if (t) t.focus();
    }
  }

  function show(id) {
    if (id === 'welcome') {
      close();
      if (Xen.welcome) Xen.welcome.show();
      return;
    }
    if (!Xen.panels[id]) return;
    if (Xen.menus) Xen.menus.close(false);
    if (Xen.find) Xen.find.close();

    S.ui.backstage = id;
    el.hidden = false;
    const mb = $('#menubar');
    if (mb) mb.hidden = true;
    inertTargets().forEach((t) => t && t.setAttribute('inert', ''));
    if (Xen.menus && Xen.menus.setFileActive) Xen.menus.setFileActive(true);

    render();

    if (id !== 'saveas') {
      const a = $('.bs-nav__item.is-active', el);
      if (a) a.focus();
    }
  }

  function close() {
    if (!S.ui.backstage) return;
    const wasWelcome = Xen.welcome && Xen.welcome.isOpen();
    S.ui.backstage = null;
    el.hidden = true;
    el.innerHTML = '';
    const mb = $('#menubar');
    if (mb) mb.removeAttribute('inert');
    if (Xen.menus && Xen.menus.setFileActive) Xen.menus.setFileActive(false);
    if (!wasWelcome) {
      if (mb) mb.hidden = false;
      inertTargets().forEach((t) => t && t.removeAttribute('inert'));
      if (Xen.editor && Xen.editor.focus) Xen.editor.focus();
    } else {
      if (Xen.welcome && Xen.welcome.render) Xen.welcome.render();
    }
  }

  /* Delegated preference controls */
  el.addEventListener('change', (e) => {
    const t = e.target.closest('[data-pref]');
    if (!t) return;
    const val = t.type === 'checkbox' ? t.checked : t.dataset.type === 'number' ? Number(t.value) : t.value;
    Xen.prefs.set(t.dataset.pref, val);
    render({ pref: t.dataset.pref });
  });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-pref][data-val]');
    if (b) {
      Xen.prefs.set(b.dataset.pref, b.dataset.val);
      render({ pref: b.dataset.pref, val: b.dataset.val });
      return;
    }
    const s = e.target.closest('[data-pref-step]');
    if (s) {
      const n = util.clamp(Xen.prefs.get('editorSize') + Number(s.dataset.prefStep), 10, 24);
      Xen.prefs.set('editorSize', n);
      render({ step: s.dataset.prefStep });
    }
  });

  // Global keydown when backstage is open
  document.addEventListener('keydown', (e) => {
    if (!S.ui.backstage) return;

    if (e.key === 'Escape') {
      // If a custom dropdown is currently open, let dropdown.js handle it
      if (document.querySelector('.x-dropdown.is-open')) return;
      e.preventDefault();
      close();
      return;
    }

    // Keyboard navigation between navigation items
    if (document.activeElement && document.activeElement.classList.contains('bs-nav__item')) {
      const items = Array.from(el.querySelectorAll('.bs-nav__item'));
      const idx = items.indexOf(document.activeElement);
      if (idx !== -1) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = items[(idx + 1) % items.length];
          if (next) next.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = items[(idx - 1 + items.length) % items.length];
          if (prev) prev.focus();
        }
      }
    }
  });

  const live = ['save', 'saveas', 'export'];
  store.on('doc', () => {
    if (live.includes(S.ui.backstage) && document.activeElement && document.activeElement.tagName !== 'INPUT') {
      render();
    }
  });

  Xen.backstage = {
    show,
    close,
    refresh: () => render(),
    isOpen: () => !!S.ui.backstage
  };

  Xen.commands.registerAll({
    'backstage.show': show,
    'backstage.close': close,
    'file.new': () => show('new'),
    'file.open': () => show('open'),
    'file.save': () => show('save'),
    'file.saveAs': () => Xen.files.saveAs(),
    'file.export': () => show('export'),
    'file.preferences': () => show('preferences'),
    'file.docs': () => show('docs'),
    'file.about': () => show('about'),
    'help.about': () => show('about'),
    'help.docs': () => show('docs'),
  });
})();
