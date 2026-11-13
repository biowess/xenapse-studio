/* Backstage panels: New, Open, Save, Save As, Export. Each returns { html, bind?(root) }. */
(function () {
  const { store, util } = Xen, S = store.state, D = S.doc, { esc } = util;
  const head = (t, p) => `<header class="bs-head"><h1>${t}</h1>${p ? `<p>${p}</p>` : ''}</header>`;
  const P = (inner, wide) => `<div class="bs-page${wide ? ' bs-page--wide' : ''}">${inner}</div>`;
  const panels = (Xen.panels = Xen.panels || {});

  panels.new = () => ({ html: P(head('New', 'Start from a template. If the current document has unsaved changes you will be asked what to do with them first.') +
    `<div class="bs-list">${Object.values(Xen.samples).filter((t) => t.id).map((t) => `<button class="bs-row" data-cmd="file.newFrom" data-arg="${t.id}"><span class="bs-row__icon"><i data-icon="${t.icon}"></i></span><span class="bs-row__main"><span class="bs-row__title">${esc(t.title)} <span class="tag">${t.module}</span></span><span class="bs-row__desc">${esc(t.desc)}</span></span></button>`).join('')}</div>`) });

  function renderRecentList(res) {
    if (!res || !res.total) {
      return '<div class="bs-empty">Documents you open or save appear here.</div>';
    }
    const { recent = [], others = [] } = res;
    const othersSorted = others.slice().sort((a, b) => {
      const aMissing = a.status === 'missing' ? 1 : 0;
      const bMissing = b.status === 'missing' ? 1 : 0;
      if (aMissing !== bMissing) return aMissing - bMissing;
      return (b.lastOpened || 0) - (a.lastOpened || 0);
    });
    const items = [...recent.slice(0, 8), ...othersSorted];
    if (!items.length) {
      return '<div class="bs-empty">Documents you open or save appear here.</div>';
    }
    return items.map((entry) => {
      const isMissing = entry.status === 'missing';
      const shortDir = util.shortenPath(entry.directory || '', 40);
      const timeStr = util.relativeTime(entry.lastOpened);
      const icon = entry.module === 'FLOW' ? 'flow' : entry.module === 'MINDMAP' ? 'mindmap' : 'file';

      if (isMissing) {
        return `<div class="bs-row is-disabled">
          <span class="bs-row__icon"><i data-icon="${icon}"></i></span>
          <div class="bs-row__main" style="cursor:pointer;" data-cmd="file.openRecent" data-arg="${esc(entry.id)}">
            <span class="bs-row__title">${esc(entry.fileName)}${entry.module ? ` <span class="tag">${entry.module}</span>` : ''}</span>
            <span class="bs-row__desc">${esc(shortDir)}</span>
          </div>
          <span class="state">Not found</span>
          <button class="btn btn--sm" data-cmd="registry.remove" data-arg="${esc(entry.id)}">Remove</button>
        </div>`;
      }

      return `<button class="bs-row" data-cmd="file.openRecent" data-arg="${esc(entry.id)}">
        <span class="bs-row__icon"><i data-icon="${icon}"></i></span>
        <span class="bs-row__main">
          <span class="bs-row__title">${esc(entry.fileName)}${entry.module ? ` <span class="tag">${entry.module}</span>` : ''}</span>
          <span class="bs-row__desc">${esc(shortDir)} &bull; ${esc(timeStr)}</span>
        </span>
      </button>`;
    }).join('');
  }

  panels.open = () => {
    const listHtml = renderRecentList(Xen.registry ? Xen.registry.getCached() : null);
    return {
      html: P(head('Open', 'Open a Xenapse document from disk.') +
        `<div class="dropzone" id="dropzone"><h3>Drop a .xnp file here</h3><p>or</p><button class="btn btn--primary" data-cmd="file.pick"><i data-icon="open"></i>Choose a document…</button></div>
         <div class="bs-recent">
           <h2 class="bs-subtitle">Recent documents</h2>
           <div class="bs-list" id="recent-list">${listHtml}</div>
         </div>
         <div class="bs-note bs-note--quiet">Stylesheets declared with <code>STYLESHEET</code> are resolved automatically from the document’s directory.</div>`),
      bind(root) {
        const z = root.querySelector('#dropzone');
        ['dragenter', 'dragover'].forEach((t) => z.addEventListener(t, () => z.classList.add('is-over')));
        ['dragleave', 'drop'].forEach((t) => z.addEventListener(t, () => z.classList.remove('is-over')));
        if (Xen.registry) {
          Xen.registry.list({ recentLimit: 8 }).then((res) => {
            const listEl = root.querySelector('#recent-list');
            if (listEl) {
              listEl.innerHTML = renderRecentList(res);
              Xen.icons.hydrate(listEl);
            }
          }).catch(() => {});
        }
      }
    };
  };

  const st = (dirty, saved) => `<span class="state${dirty ? ' is-dirty' : ''}">${dirty ? 'Unsaved changes' : saved || 'Saved'}</span>`;
  panels.save = () => {
    const x = D.xcss, Doc = Xen.doc;
    const xstate = !x ? '' : x.state === 'missing' ? '<span class="state">Not found</span>' : x.saved === null ? '<span class="state is-dirty">Not yet saved</span>' : st(Doc.xcssDirty());
    const xrow = !x ? `<dt>XCSS</dt><dd>None attached</dd><span class="state">—</span>` : `<dt>XCSS</dt><dd>${esc(x.path || x.declared)}</dd>${xstate}`;
    const docLoc = D.path ? esc(D.path) : 'Not yet saved to disk';
    return { html: P(head('Save', 'Save changes in place on disk.') +
      `<dl class="kv"><dt>XNP</dt><dd>${esc(Doc.xnpFileName())}</dd>${st(Doc.xnpDirty())}<dt>Location</dt><dd>${docLoc}</dd><span class="state">—</span>${xrow}</dl>
       <div class="actions"><button class="btn btn--primary" data-cmd="file.saveNow"><i data-icon="save"></i>Save</button>${x && x.state !== 'missing' ? '<button class="btn" data-cmd="xcss.saveOnly">Save stylesheet only</button>' : ''}</div>`) };
  };

  panels.saveas = () => ({ html: P(head('Save As', 'Save a copy under a new name and location. The stylesheet reference is updated to match.') +
    `<div class="actions"><button class="btn btn--primary" data-cmd="file.saveAs"><i data-icon="saveas"></i>Save As…</button></div>`) });

  panels.export = () => {
    const def = Xen.prefs.get('exportFormat'), x = D.xcss;
    const row = (icon, title, desc, cmd, arg, tag, off) => `<div class="bs-row${off ? ' is-disabled' : ''}"><span class="bs-row__icon"><i data-icon="${icon}"></i></span><span class="bs-row__main"><span class="bs-row__title">${title}${tag ? ` <span class="tag tag--accent">${tag}</span>` : ''}</span><span class="bs-row__desc">${desc}</span></span>${off ? '<span class="kbd">Needs engine</span>' : `<button class="btn" data-cmd="${cmd}" ${arg ? `data-arg="${arg}"` : ''}>Export</button>`}</div>`;
    return { html: P(head('Export', 'Produce files from the current document.') +
      `<div class="bs-list">
        ${row('image', 'SVG image', 'Scalable vector graphic of the preview.', 'file.export.do', 'svg', def === 'svg' ? 'Default' : '', false)}
        ${row('image', 'PNG image', 'High-resolution raster image at 400 DPI.', 'file.export.do', 'png', def === 'png' ? 'Default' : '', false)}
        ${row('file', 'PDF document', 'Vector PDF output custom-sized to diagram bounds.', 'file.export.do', 'pdf', def === 'pdf' ? 'Default' : '', false)}
        ${row('file', 'Source (.xnp)', 'The XNP document as plain text.', 'file.exportSource')}
        ${x ? row('stylesheet', 'Stylesheet (.xcss)', 'A separate copy of the stylesheet. The document is unchanged.', 'xcss.extract') : ''}
      </div>`, true) };
  };
  Xen.commands.register('xcss.saveOnly', () => Xen.files.saveXcss());
})();
