/* Documentation backstage panel: renders official Xenapse Language docs with full Markdown formatting and internal navigation */
(function () {
  const { store, util } = Xen;
  const { esc } = util;

  const DOCS = [
    {
      id: 'overview.md',
      title: 'Overview & Quickstart',
      badge: 'Guide',
      desc: 'Introduction to the Xenapse diagramming language, quickstart syntax, and CLI usage.'
    },
    {
      id: 'decisions.md',
      title: 'Language Specification',
      badge: 'Authoritative',
      desc: 'The official resolved language decisions (DECISIONS.md): lexical rules, grammar, FLOW & MINDMAP semantics, diagnostics, and XCSS.'
    },
    {
      id: 'blueprint.md',
      title: 'Language Blueprint',
      badge: 'Reference',
      desc: 'Complete architectural blueprint for FLOW and MINDMAP modules, layout engine, and styling properties.'
    },
    {
      id: 'file-types.md',
      title: 'File Types & OS Integration',
      badge: 'System',
      desc: 'Specification for .xnp diagrams and .xcss stylesheets, MIME types, and desktop platform integration.'
    }
  ];

  let currentDocId = 'overview.md';
  const docCache = new Map();

  async function loadDocText(docId) {
    if (docCache.has(docId)) return docCache.get(docId);
    let text = null;

    // 1. Try privileged IPC if running in Electron
    if (Xen.native && Xen.native.app && Xen.native.app.getDoc) {
      try {
        text = await Xen.native.app.getDoc(docId);
      } catch (e) {
        text = null;
      }
    }

    // 2. Try fetch from app:// or local server
    if (!text) {
      try {
        const res = await fetch('docs/' + docId);
        if (res.ok) text = await res.text();
      } catch (e) {
        /* fetch failed */
      }
    }

    if (text) docCache.set(docId, text);
    return text;
  }

  const renderedCache = new Map();

  function renderDocBody(docId, rawText) {
    if (!rawText) {
      return `<div class="doc-error">
        <i data-icon="alert-circle"></i>
        <h3>Document could not be loaded</h3>
        <p>The documentation file <code>${esc(docId)}</code> was not found or could not be accessed.</p>
        <button class="btn btn--sm" data-cmd="docs.switch" data-arg="overview.md">Return to Overview</button>
      </div>`;
    }
    if (renderedCache.has(docId)) return renderedCache.get(docId);
    const rendered = Xen.markdown.render(rawText);
    renderedCache.set(docId, rendered);
    return rendered;
  }

  // Pre-warm documentation in idle time to eliminate opening stutter
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      DOCS.forEach((d) => loadDocText(d.id).then((t) => t && renderDocBody(d.id, t)));
    });
  } else {
    setTimeout(() => {
      DOCS.forEach((d) => loadDocText(d.id).then((t) => t && renderDocBody(d.id, t)));
    }, 100);
  }

  Xen.panels = Xen.panels || {};
  Xen.panels.docs = () => {
    const cur = DOCS.find((d) => d.id === currentDocId) || DOCS[0];

    const navItems = DOCS.map((d) => {
      const isAct = d.id === cur.id;
      return `<button class="doc-nav__item${isAct ? ' is-active' : ''}" data-cmd="docs.switch" data-arg="${d.id}" ${isAct ? 'aria-current="page"' : ''}>
        <div class="doc-nav__item-head">
          <span class="doc-nav__item-title">${esc(d.title)}</span>
          <span class="doc-nav__item-badge">${esc(d.badge)}</span>
        </div>
        <span class="doc-nav__item-desc">${esc(d.desc)}</span>
      </button>`;
    }).join('');

    const cachedText = docCache.get(cur.id);
    const initialContent = cachedText
      ? renderDocBody(cur.id, cachedText)
      : `<div class="doc-loading"><span class="doc-spinner"></span> Loading documentation…</div>`;

    return {
      wide: true,
      html: `<div class="bs-page bs-page--wide bs-page--docs">
        <header class="bs-head">
          <div class="bs-head__meta">
            <h1>Documentation</h1>
            <p>Official Xenapse language specifications and references.</p>
          </div>
          <div class="bs-head__actions">
            <button class="btn btn--sm" data-cmd="docs.openExternalRepo"><i data-icon="external-link"></i>GitHub Repository</button>
          </div>
        </header>
        <div class="doc-layout">
          <nav class="doc-nav" aria-label="Documentation chapters">
            <div class="doc-nav__header">Documents</div>
            ${navItems}
          </nav>
          <div class="doc-viewer" id="doc-viewer" role="article" aria-label="${esc(cur.title)}">
            <div class="doc-body" id="doc-body">${initialContent}</div>
          </div>
        </div>
      </div>`,
      bind(root) {
        const bodyEl = root.querySelector('#doc-body');
        if (!bodyEl) return;

        // Asynchronously load if not cached yet
        if (!docCache.has(cur.id)) {
          loadDocText(cur.id).then((text) => {
            if (bodyEl) {
              bodyEl.innerHTML = renderDocBody(cur.id, text);
              Xen.icons.hydrate(bodyEl);
            }
          });
        } else {
          Xen.icons.hydrate(bodyEl);
        }

        // Delegate doc link clicks
        bodyEl.addEventListener('click', (e) => {
          // Copy code
          const copyBtn = e.target.closest('.doc-code-copy');
          if (copyBtn) {
            e.preventDefault();
            const code = copyBtn.dataset.copy;
            if (code && navigator.clipboard) {
              navigator.clipboard.writeText(code).then(() => {
                const span = copyBtn.querySelector('span');
                if (span) span.textContent = 'Copied!';
                setTimeout(() => { if (span) span.textContent = 'Copy'; }, 1500);
              });
            }
            return;
          }

          // External links
          const extLink = e.target.closest('.doc-link--ext');
          if (extLink && extLink.href) {
            e.preventDefault();
            if (Xen.native && Xen.native.shell && Xen.native.shell.openExternal) {
              Xen.native.shell.openExternal(extLink.href);
            } else {
              window.open(extLink.href, '_blank', 'noopener,noreferrer');
            }
            return;
          }

          // Internal document link
          const docLink = e.target.closest('[data-doc-link]');
          if (docLink) {
            e.preventDefault();
            const target = docLink.dataset.docLink;
            let [targetFile, targetAnchor] = target.split('#');
            targetFile = targetFile.replace(/^\.?\/?(docs\/)?/, '');
            if (!targetFile.endsWith('.md') && targetFile) targetFile += '.md';
            if (!targetFile) targetFile = cur.id;

            const matched = DOCS.find((d) => d.id.toLowerCase() === targetFile.toLowerCase() || d.id.toLowerCase().includes(targetFile.toLowerCase()));
            if (matched) {
              currentDocId = matched.id;
              Xen.backstage.refresh();
              if (targetAnchor) {
                setTimeout(() => {
                  const targetEl = document.getElementById(targetAnchor);
                  if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }
            }
            return;
          }

          // Anchor link
          const anchorLink = e.target.closest('[data-anchor]');
          if (anchorLink) {
            e.preventDefault();
            const anchor = anchorLink.dataset.anchor;
            const targetEl = document.getElementById(anchor);
            if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    };
  };

  Xen.commands.registerAll({
    'docs.show': (id) => {
      if (id && DOCS.some((d) => d.id === id)) currentDocId = id;
      Xen.backstage.show('docs');
    },
    'docs.switch': (id) => {
      if (id && DOCS.some((d) => d.id === id)) {
        currentDocId = id;
        Xen.backstage.refresh();
      }
    },
    'docs.openExternalRepo': () => {
      const url = (Xen.appMetadata && Xen.appMetadata.repositoryUrl) || 'https://github.com/biowess/xenapse';
      if (Xen.native && Xen.native.shell && Xen.native.shell.openExternal) {
        Xen.native.shell.openExternal(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    'help.docs': () => Xen.commands.run('docs.show', 'overview.md'),
    'help.reference': () => Xen.commands.run('docs.show', 'decisions.md'),
  });
})();
