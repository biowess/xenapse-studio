/* Welcome screen and document home feature.
   Serves as the application's permanent home page.
   Provides contextual greeting, primary actions (Create Blank / Open File),
   Recent Files, Create with Templates (FLOW & MINDMAP), All Documents registry view,
   and integrated navigation to About, Docs, and Preferences. */
(function () {
  const { store, util } = Xen;
  const S = store.state;
  const D = S.doc;
  const Doc = Xen.doc;
  const { $, $$, esc } = util;

  let activeCategory = 'all';
  let searchQuery = '';
  let isOpen = false;

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function getWelcomeEl() {
    return $('#welcome');
  }

  function formatTime(ts) {
    if (!ts) return 'Unknown';
    return util.relativeTime ? util.relativeTime(ts) : new Date(ts).toLocaleDateString();
  }

  function renderRecent(res) {
    const recent = (res && res.recent) || [];
    if (!recent.length) {
      return `
        <div class="welcome__empty">
          <i data-icon="file"></i>
          <p>No recent files yet. Documents you create or open will appear here for fast access.</p>
        </div>
      `;
    }

    return recent.map((doc, idx) => {
      const isMissing = doc.status === 'missing';
      const isLatest = idx === 0 && !isMissing;
      const typeIcon = doc.module === 'MINDMAP' ? 'mindmap' : doc.module === 'FLOW' ? 'flow' : 'file';
      const typeLabel = doc.module || 'Document';
      const dirText = util.shortenPath ? util.shortenPath(doc.directory || '', 36) : (doc.directory || '');
      const timeText = formatTime(doc.lastOpened);

      if (isMissing) {
        return `
          <div class="welcome__recent-card is-missing" data-id="${esc(doc.id)}">
            <div class="welcome__recent-icon"><i data-icon="${typeIcon}"></i></div>
            <div class="welcome__recent-body" data-cmd="registry.openEntry" data-arg="${esc(doc.id)}" role="button" tabindex="0">
              <div class="welcome__recent-header">
                <span class="welcome__recent-name" title="${esc(doc.path)}">${esc(doc.fileName)}</span>
                <span class="welcome__tag welcome__tag--missing">Not found</span>
              </div>
              <div class="welcome__recent-meta">
                <span class="welcome__recent-path" title="${esc(doc.directory || '')}">${esc(dirText)}</span>
              </div>
            </div>
            <button class="welcome__recent-remove" data-cmd="welcome.removeRecent" data-arg="${esc(doc.id)}" title="Remove from list" aria-label="Remove from list">
              <i data-icon="x"></i>
            </button>
          </div>
        `;
      }

      return `
        <div class="welcome__recent-card${isLatest ? ' is-latest' : ''}" data-cmd="registry.openEntry" data-arg="${esc(doc.id)}" role="button" tabindex="0">
          <div class="welcome__recent-icon"><i data-icon="${typeIcon}"></i></div>
          <div class="welcome__recent-body">
            <div class="welcome__recent-header">
              <span class="welcome__recent-name" title="${esc(doc.path)}">${esc(doc.fileName)}</span>
              ${isLatest ? '<span class="welcome__tag welcome__tag--latest">Latest</span>' : `<span class="welcome__tag">${esc(typeLabel)}</span>`}
            </div>
            <div class="welcome__recent-meta">
              <span class="welcome__recent-path" title="${esc(doc.directory || '')}"><i data-icon="folder"></i> ${esc(dirText)}</span>
              <span class="welcome__recent-time"><i data-icon="clock"></i> ${esc(timeText)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTemplates() {
    if (!Xen.templates) return '';
    const list = Xen.templates.byCategory(activeCategory);
    if (!list.length) {
      return `
        <div class="welcome__empty">
          <p>No templates available in this category.</p>
        </div>
      `;
    }

    return list.map((tpl) => `
      <div class="welcome__template-card" data-cmd="welcome.createFromTemplate" data-arg="${esc(tpl.id)}" role="button" tabindex="0">
        <div class="welcome__template-preview">
          ${tpl.previewSvg}
        </div>
        <div class="welcome__template-info">
          <div class="welcome__template-header">
            <h3 class="welcome__template-name">${esc(tpl.name)}</h3>
            <span class="welcome__tag">${esc(tpl.category)}</span>
          </div>
          <p class="welcome__template-desc">${esc(tpl.desc)}</p>
        </div>
      </div>
    `).join('');
  }

  function renderAllDocs(res) {
    const all = (res && res.all) || [...((res && res.recent) || []), ...((res && res.others) || [])];
    if (!all.length) {
      return `
        <div class="welcome__empty">
          <i data-icon="file"></i>
          <p>No documents registered yet. Any documents you create or open will be remembered here.</p>
        </div>
      `;
    }

    let filtered = all;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = all.filter((d) => (d.fileName && d.fileName.toLowerCase().includes(q)) || (d.directory && d.directory.toLowerCase().includes(q)));
    }

    if (!filtered.length) {
      return `
        <div class="welcome__empty">
          <p>No documents matching “${esc(searchQuery)}”.</p>
        </div>
      `;
    }

    const rows = filtered.map((doc) => {
      const isMissing = doc.status === 'missing';
      const typeIcon = doc.module === 'MINDMAP' ? 'mindmap' : doc.module === 'FLOW' ? 'flow' : 'file';
      const typeLabel = doc.module || 'Document';
      const dirText = util.shortenPath ? util.shortenPath(doc.directory || '', 40) : (doc.directory || '');
      const timeText = formatTime(doc.lastOpened);

      return `
        <tr class="welcome__doc-row${isMissing ? ' is-missing' : ''}">
          <td class="welcome__doc-name-cell">
            <button class="welcome__doc-link" data-cmd="registry.openEntry" data-arg="${esc(doc.id)}">
              <i data-icon="${typeIcon}"></i>
              <span class="welcome__doc-title">${esc(doc.fileName)}</span>
            </button>
          </td>
          <td class="welcome__doc-type-cell">
            <span class="welcome__tag">${esc(typeLabel)}</span>
          </td>
          <td class="welcome__doc-path-cell" title="${esc(doc.path)}">
            ${esc(dirText)}
          </td>
          <td class="welcome__doc-date-cell">
            ${esc(timeText)}
          </td>
          <td class="welcome__doc-action-cell">
            ${isMissing ? `
              <span class="welcome__status-missing">Missing</span>
              <button class="btn btn--sm" data-cmd="welcome.removeRecent" data-arg="${esc(doc.id)}">Remove</button>
            ` : `
              <button class="btn btn--sm btn--ghost" data-cmd="registry.openEntry" data-arg="${esc(doc.id)}">Open</button>
            `}
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table class="welcome__table" aria-label="Known documents">
        <thead>
          <tr>
            <th scope="col" class="welcome__th-name">Document</th>
            <th scope="col" class="welcome__th-type">Type</th>
            <th scope="col" class="welcome__th-path">Location</th>
            <th scope="col" class="welcome__th-date">Last Opened</th>
            <th scope="col" class="welcome__th-action"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  async function render() {
    const el = getWelcomeEl();
    if (!el) return;

    let regData = null;
    if (Xen.registry) {
      try {
        regData = await Xen.registry.list({ recentLimit: 4 });
      } catch (e) {
        regData = Xen.registry.getCached();
      }
    }

    const greeting = getGreeting();
    const hasActiveDoc = !!(D.xnp && D.xnp.text && D.xnp.text.trim());
    const isDirty = Doc.isDirty ? Doc.isDirty() : false;
    const docName = Doc.xnpFileName ? Doc.xnpFileName() : D.fileName || 'Current Document';

    el.innerHTML = `
      <div class="welcome__container">
        
        <!-- Welcome Header -->
        <header class="welcome__header">
          <div class="welcome__header-brand">
            <h1 class="welcome__greeting">${esc(greeting)}</h1>
            <p class="welcome__intro">A focused desktop studio for declarative diagrams, process workflows, and hierarchical mind maps.</p>
          </div>
          <nav class="welcome__header-nav" aria-label="Secondary navigation">
            <button class="welcome__header-link" data-cmd="welcome.about">
              <i data-icon="info"></i>
              <span>About</span>
            </button>
            <button class="welcome__header-link" data-cmd="welcome.docs">
              <i data-icon="book-open"></i>
              <span>Documentation</span>
            </button>
            <button class="welcome__header-link" data-cmd="welcome.preferences">
              <i data-icon="settings"></i>
              <span>Preferences</span>
            </button>
          </nav>
        </header>

        ${hasActiveDoc ? `
          <!-- Active Document Resume Banner -->
          <div class="welcome__resume-bar">
            <div class="welcome__resume-content">
              <span class="welcome__resume-prefix">Current workspace:</span>
              <strong class="welcome__resume-title">${esc(docName)}</strong>
              ${isDirty ? '<span class="dirty-dot" title="Unsaved changes"></span>' : ''}
            </div>
            <button class="btn btn--sm btn--primary welcome__resume-btn" data-cmd="welcome.resume">
              <span>Return to Workspace</span>
              <i data-icon="arrow-left" style="transform: rotate(180deg);"></i>
            </button>
          </div>
        ` : ''}

        <!-- Primary Actions: Create Blank Document & Open a File -->
        <section class="welcome__primary-actions" aria-label="Primary actions">
          <button class="welcome__action-btn welcome__action-btn--create" data-cmd="welcome.createBlank">
            <div class="welcome__action-icon"><i data-icon="new"></i></div>
            <div class="welcome__action-content">
              <h2 class="welcome__action-title">Create Blank Document</h2>
              <p class="welcome__action-desc">Start a new empty Xenapse diagram with valid syntax</p>
            </div>
          </button>

          <button class="welcome__action-btn welcome__action-btn--open" data-cmd="welcome.openFile">
            <div class="welcome__action-icon"><i data-icon="open"></i></div>
            <div class="welcome__action-content">
              <h2 class="welcome__action-title">Open a File</h2>
              <p class="welcome__action-desc">Open an existing .xnp document from disk</p>
            </div>
          </button>
        </section>

        <!-- Recent Files Section -->
        <section class="welcome__section" aria-labelledby="welcome-recent-heading">
          <div class="welcome__section-header">
            <h2 class="welcome__section-title" id="welcome-recent-heading">Recent Files</h2>
          </div>
          <div class="welcome__recent-grid" id="welcome-recent-list">
            ${renderRecent(regData)}
          </div>
        </section>

        <!-- Create with Templates Section -->
        <section class="welcome__section" aria-labelledby="welcome-templates-heading">
          <div class="welcome__section-header">
            <h2 class="welcome__section-title" id="welcome-templates-heading">Create with Templates</h2>
            <div class="welcome__cat-tabs" role="tablist" aria-label="Template categories">
              <button class="welcome__cat-tab${activeCategory === 'all' ? ' is-active' : ''}" role="tab" aria-selected="${activeCategory === 'all'}" data-cat="all">All</button>
              <button class="welcome__cat-tab${activeCategory === 'FLOW' ? ' is-active' : ''}" role="tab" aria-selected="${activeCategory === 'FLOW'}" data-cat="FLOW">Flow</button>
              <button class="welcome__cat-tab${activeCategory === 'MINDMAP' ? ' is-active' : ''}" role="tab" aria-selected="${activeCategory === 'MINDMAP'}" data-cat="MINDMAP">Mind Map</button>
            </div>
          </div>
          <div class="welcome__templates-grid" id="welcome-templates-list">
            ${renderTemplates()}
          </div>
        </section>

        <!-- All Documents Section -->
        <section class="welcome__section" aria-labelledby="welcome-docs-heading">
          <div class="welcome__section-header">
            <h2 class="welcome__section-title" id="welcome-docs-heading">All Documents</h2>
            <div class="welcome__search-wrap">
              <input type="search" class="welcome__search-input" id="welcome-docs-search" placeholder="Filter documents…" value="${esc(searchQuery)}" aria-label="Filter documents">
            </div>
          </div>
          <div class="welcome__docs-container" id="welcome-docs-list">
            ${renderAllDocs(regData)}
          </div>
        </section>

      </div>
    `;

    Xen.icons.hydrate(el);

    // Bind search input
    const searchInp = $('#welcome-docs-search', el);
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        const docsContainer = $('#welcome-docs-list', el);
        if (docsContainer) {
          docsContainer.innerHTML = renderAllDocs(Xen.registry ? Xen.registry.getCached() : null);
          Xen.icons.hydrate(docsContainer);
        }
      });
    }
  }

  function show() {
    const el = getWelcomeEl();
    if (!el) return;
    if (Xen.backstage && Xen.backstage.isOpen && Xen.backstage.isOpen()) {
      Xen.backstage.close();
    }
    if (Xen.menus) Xen.menus.close(false);
    if (Xen.find) Xen.find.close();

    isOpen = true;
    el.hidden = false;
    document.body.classList.add('is-welcome');

    // Invert workspace & statusbar while welcome screen is active
    const ws = $('#workspace');
    if (ws) ws.setAttribute('inert', '');
    const sb = $('#statusbar');
    if (sb) sb.setAttribute('inert', '');
    const mb = $('#menubar');
    if (mb) mb.hidden = true;

    render();
  }

  function hide() {
    const el = getWelcomeEl();
    if (!el) return;
    isOpen = false;
    el.hidden = true;
    document.body.classList.remove('is-welcome');

    const ws = $('#workspace');
    if (ws) ws.removeAttribute('inert');
    const sb = $('#statusbar');
    if (sb) sb.removeAttribute('inert');
    const mb = $('#menubar');
    if (mb) {
      mb.hidden = false;
      mb.removeAttribute('inert');
    }
    if (Xen.menus && Xen.menus.setFileActive) Xen.menus.setFileActive(false);

    if (Xen.editor && Xen.editor.focus) {
      Xen.editor.focus();
    }
  }

  /* Delegated clicks on welcome screen */
  document.addEventListener('click', async (e) => {
    if (!isOpen) return;
    const el = getWelcomeEl();
    if (!el || !el.contains(e.target)) return;

    // Category tab
    const catTab = e.target.closest('[data-cat]');
    if (catTab) {
      activeCategory = catTab.dataset.cat;
      $$('.welcome__cat-tab', el).forEach((t) => {
        const sel = t.dataset.cat === activeCategory;
        t.classList.toggle('is-active', sel);
        t.setAttribute('aria-selected', String(sel));
      });
      const tplsGrid = $('#welcome-templates-list', el);
      if (tplsGrid) {
        tplsGrid.innerHTML = renderTemplates();
        Xen.icons.hydrate(tplsGrid);
      }
      return;
    }
  });

  // Keyboard navigation inside welcome screen cards/buttons
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      const hasActiveDoc = !!(D.xnp && D.xnp.text && D.xnp.text.trim());
      if (hasActiveDoc) {
        e.preventDefault();
        hide();
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const card = document.activeElement && document.activeElement.closest('[data-cmd]');
      if (card && card.closest('#welcome')) {
        const cmd = card.dataset.cmd;
        const arg = card.dataset.arg;
        if (cmd && Xen.commands) {
          e.preventDefault();
          Xen.commands.run(cmd, arg);
        }
      }
    }
  });

  /* Registry updates */
  if (Xen.store) {
    Xen.store.on('registry:updated', () => {
      if (isOpen) render();
    });
  }

  /* Commands */
  Xen.commands.registerAll({
    'welcome.show': () => show(),
    'welcome.hide': () => hide(),
    'welcome.resume': () => hide(),
    'welcome.createBlank': async () => {
      if (Xen.files && Xen.files.confirmUnsaved) {
        if (!(await Xen.files.confirmUnsaved('Creating a new document will replace the current one.'))) return;
      }
      const fileName = await Xen.fileService.suggestName({ kind: 'xnp', base: 'untitled' });
      Doc.load({
        fileName,
        path: null,
        eol: 'lf',
        xnp: 'IMPORT FLOW\n\nSTART\n\nEND\n',
        xcss: null,
        dirty: false,
      });
      D.mtimeMs = null;
      hide();
      Xen.toast(`New document: ${fileName}.`);
    },
    'welcome.openFile': async () => {
      if (Xen.files && Xen.files.confirmUnsaved) {
        if (!(await Xen.files.confirmUnsaved('Opening a document will replace the current one.'))) return;
      }
      const chosen = await Xen.fileService.openDocumentDialog();
      if (chosen) {
        const res = await Xen.files.openPath(chosen);
        if (res && res.ok) {
          hide();
        }
      }
    },
    'welcome.createFromTemplate': async (tplId) => {
      if (!tplId || !Xen.templates) return;
      const t = Xen.templates.get(tplId);
      if (!t) return;
      if (Xen.files && Xen.files.confirmUnsaved) {
        if (!(await Xen.files.confirmUnsaved('Creating a new document will replace the current one.'))) return;
      }
      const fileName = await Xen.fileService.suggestName({ kind: 'xnp', base: t.stem || 'untitled' });
      Doc.load({
        fileName,
        path: null,
        eol: 'lf',
        xnp: t.xnp,
        xcss: t.xcss ? {
          text: t.xcss.text,
          declared: t.xcss.declared || (t.stem + '.xcss'),
          state: 'new',
          path: null,
          saved: null,
        } : null,
        dirty: false,
      });
      D.mtimeMs = null;
      hide();
      Xen.toast(`New document from template: ${t.name}.`);
    },
    'welcome.removeRecent': async (id) => {
      if (!id || !Xen.registry) return;
      await Xen.registry.remove(id);
      render();
    },
    'welcome.about': () => {
      if (Xen.backstage) Xen.backstage.show('about');
    },
    'welcome.docs': () => {
      if (Xen.backstage) Xen.backstage.show('docs');
    },
    'welcome.preferences': () => {
      if (Xen.backstage) Xen.backstage.show('preferences');
    },
    'registry.openEntry': async (id) => {
      if (!id || !Xen.registry) return;
      if (Xen.files && Xen.files.confirmUnsaved) {
        if (!(await Xen.files.confirmUnsaved('Opening a document will replace the current one.'))) return;
      }
      const res = await Xen.registry.list();
      const all = [...(res.recent || []), ...(res.others || [])];
      const entry = all.find((e) => e.id === id);
      if (entry) {
        await Xen.registry.open(entry);
        if (D.path === entry.path || (D.fileName === entry.fileName && !entry.status.includes('missing'))) {
          hide();
        }
      }
    },
  });

  Xen.welcome = {
    show,
    hide,
    render,
    isOpen: () => isOpen,
  };
})();
