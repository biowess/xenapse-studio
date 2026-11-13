/* About panel: genuine software About section with verified legal texts and engine detection */
(function () {
  const { util } = Xen;
  const { esc } = util;

  let activeLegalTab = 'license';

  Xen.panels = Xen.panels || {};
  Xen.panels.about = () => {
    const meta = Xen.appMetadata || {};
    const legal = meta.legal || {};

    let compilerInfo = 'Not detected. Previews use representative samples.';
    if (Xen.compiler && Xen.compiler.status) {
      const s = Xen.compiler.status();
      if (s && s.usable) {
        compilerInfo = `Connected${s.version ? ` (version ${s.version})` : ''} · ${s.path || 'system'}`;
      }
    }

    const legalTabs = [
      { id: 'license', label: 'Apache License 2.0' },
      { id: 'notice', label: 'NOTICE' },
      { id: 'trademark', label: 'Brand Assets Policy' },
      { id: 'thirdParty', label: 'Third-Party Notices' }
    ];

    const currentText = legal[activeLegalTab] || '';
    const renderedLegal = Xen.markdown ? Xen.markdown.render(currentText) : `<pre>${esc(currentText)}</pre>`;

    return {
      wide: true,
      html: `<div class="bs-page bs-page--wide bs-page--about">
        <div class="about-hero">
          <div class="about-hero__brand">
            <svg class="about-hero__icon" viewBox="0 0 104 100" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M22 60L60 60C60 78.78 44.78 94 26 94L22 94Z"/>
              <path fill-rule="evenodd" d="M0 0L26 0C69.08 0 104 34.92 104 78L104 100L78 100L78 78C78 49.28 54.72 26 26 26L26 60L26 94L26 100L0 74Z"/>
            </svg>
            <div class="about-hero__titles">
              <h1 class="about-hero__name">${esc(meta.name || 'Xenapse Studio')}</h1>
              <div class="about-hero__version">Version ${esc(meta.version || '0.1.0')}</div>
            </div>
          </div>
          <p class="about-hero__desc">${esc(meta.description || 'A desktop editor for Xenapse diagrams.')}</p>
          <div class="about-hero__actions">
            <button class="btn btn--primary" data-cmd="help.docs"><i data-icon="book-open"></i><span>Documentation</span></button>
            <button class="btn" data-cmd="about.openRepo"><i data-icon="external-link"></i><span>Repository</span></button>
            <button class="btn" data-cmd="about.openReleases"><i data-icon="external-link"></i><span>Releases</span></button>
          </div>
        </div>

        <div class="about-meta-grid">
          <div class="about-card">
            <div class="about-card__header">Application & Environment</div>
            <dl class="about-dl">
              <dt>Publisher</dt>
              <dd>${esc(meta.publisher || 'Biowess')}</dd>
              <dt>Copyright</dt>
              <dd>${esc(meta.copyright || 'Copyright 2026 Biowess')}</dd>
              <dt>Primary License</dt>
              <dd>${esc(meta.license || 'Apache License, Version 2.0')}</dd>
              <dt>Platform</dt>
              <dd>${esc(Xen.platform && Xen.platform.os ? Xen.platform.os : 'desktop')}</dd>
            </dl>
          </div>

          <div class="about-card">
            <div class="about-card__header">Xenapse Language & Engine</div>
            <dl class="about-dl">
              <dt>Language</dt>
              <dd>${esc(meta.language && meta.language.name ? meta.language.name : 'Xenapse Language')}</dd>
              <dt>Compiler Status</dt>
              <dd>${esc(compilerInfo)}</dd>
              <dt>Document Types</dt>
              <dd><code>.xnp</code> (Diagram) &bull; <code>.xcss</code> (Stylesheet)</dd>
              <dt>Minimum Spec</dt>
              <dd>${esc(meta.language && meta.language.minVersion ? meta.language.minVersion : '0.1.0')}</dd>
            </dl>
          </div>
        </div>

        <section class="about-legal" aria-label="Legal Information">
          <div class="about-legal__header">
            <h2>Legal Notices & Licensing</h2>
            <div class="about-legal__tabs" role="tablist">
              ${legalTabs.map((t) => `<button class="about-legal__tab${activeLegalTab === t.id ? ' is-active' : ''}" data-cmd="about.legalTab" data-arg="${t.id}" role="tab" aria-selected="${activeLegalTab === t.id}">${esc(t.label)}</button>`).join('')}
            </div>
          </div>
          <div class="about-legal__viewer" role="tabpanel" tabindex="0">
            <div class="about-legal__content">${renderedLegal}</div>
          </div>
        </section>
      </div>`,
      bind(root) {
        // Hydrate icons
        Xen.icons.hydrate(root);

        // Handle external link clicks in legal text
        const viewer = root.querySelector('.about-legal__viewer');
        if (viewer) {
          viewer.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && /^https?:\/\//i.test(link.href)) {
              e.preventDefault();
              if (Xen.native && Xen.native.shell && Xen.native.shell.openExternal) {
                Xen.native.shell.openExternal(link.href);
              } else {
                window.open(link.href, '_blank', 'noopener,noreferrer');
              }
            }
          });
        }
      }
    };
  };

  Xen.commands.registerAll({
    'about.legalTab': (tabId) => {
      activeLegalTab = tabId;
      Xen.backstage.refresh();
    },
    'about.openRepo': () => {
      const url = (Xen.appMetadata && Xen.appMetadata.repositoryUrl) || 'https://github.com/biowess/xenapse';
      if (Xen.native && Xen.native.shell && Xen.native.shell.openExternal) {
        Xen.native.shell.openExternal(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    'about.openReleases': () => {
      const url = (Xen.appMetadata && Xen.appMetadata.releasesUrl) || 'https://github.com/biowess/xenapse/releases';
      if (Xen.native && Xen.native.shell && Xen.native.shell.openExternal) {
        Xen.native.shell.openExternal(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  });
})();
