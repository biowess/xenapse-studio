/* Redesigned Preferences panel with custom dropdowns, font catalogue integration, and 34-theme visual picker */
(function () {
  const { store, util } = Xen;
  const S = store.state;
  const { esc } = util;
  const Pf = Xen.prefs;

  const CATS = [
    ['interface', 'Interface & Themes'],
    ['editor', 'Editor & Typography'],
    ['preview', 'Diagram Preview'],
    ['files', 'Files & Storage'],
    ['shortcuts', 'Keyboard Shortcuts']
  ];

  let themeFilter = 'all'; // 'all', 'studio', 'light', 'dark'

  const row = (label, desc, ctl) => `<div class="pref">
    <div class="pref__info">
      <div class="pref__label">${label}</div>
      ${desc ? `<div class="pref__desc">${desc}</div>` : ''}
    </div>
    <div class="pref__ctl">${ctl}</div>
  </div>`;

  const sw = (k, label) => `<label class="switch"><input type="checkbox" data-pref="${k}" ${Pf.get(k) ? 'checked' : ''} aria-label="${esc(label)}"><span></span></label>`;
  const seg = (k, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<button role="radio" aria-checked="${String(Pf.get(k)) === String(v)}" data-pref="${k}" data-val="${v}">${esc(l)}</button>`).join('')}</div>`;
  const swatches = (k, opts) => `<div class="swatches" role="radiogroup">${opts.map(([v, l, c]) => `<button class="swatch" role="radio" aria-checked="${Pf.get(k) === v}" aria-label="${esc(l)}" title="${esc(l)}" data-pref="${k}" data-val="${v}" style="background:${c}"></button>`).join('')}</div>`;

  function renderThemePicker() {
    const themes = Xen.themesCatalog || [];
    const curTheme = Pf.get('theme');

    const filtered = themes.filter((t) => {
      if (themeFilter === 'studio') return t.id === 'light' || t.id === 'dark';
      if (themeFilter === 'light') return !t.isDark;
      if (themeFilter === 'dark') return t.isDark;
      return true;
    });

    const filterBtns = [
      ['all', `All (${themes.length})`],
      ['studio', 'Studio Defaults (2)'],
      ['light', 'Light (18)'],
      ['dark', 'Dark (16)']
    ].map(([f, label]) => `<button class="theme-filter-btn${themeFilter === f ? ' is-active' : ''}" data-cmd="prefs.themeFilter" data-arg="${f}">${esc(label)}</button>`).join('');

    const cardsHtml = filtered.map((t) => {
      const isSel = curTheme === t.id;
      const p = t.preview || { bg: '#888', surface: '#aaa', accent: '#333', text: '#fff' };
      return `<button class="theme-card${isSel ? ' is-active' : ''}" data-pref="theme" data-val="${esc(t.id)}" role="radio" aria-checked="${isSel}">
        <div class="theme-card__preview" style="background:${p.bg}; border-color:${p.surface}">
          <div class="theme-card__swatches">
            <span class="theme-swatch" style="background:${p.surface}" title="Surface"></span>
            <span class="theme-swatch" style="background:${p.accent}" title="Accent"></span>
            <span class="theme-swatch" style="background:${p.text}" title="Text"></span>
          </div>
          <div class="theme-card__sample" style="color:${p.text}">
            <span style="color:${p.accent}">FLOW</span> &bull; [ Node ]
          </div>
        </div>
        <div class="theme-card__meta">
          <span class="theme-card__name">${esc(t.name)}</span>
          <span class="theme-card__badge">${t.id === 'light' || t.id === 'dark' ? 'Default' : t.isDark ? 'Dark' : 'Light'}</span>
        </div>
      </button>`;
    }).join('');

    return `<div class="theme-picker-section">
      <div class="theme-picker-head">
        <div class="theme-filter-bar">${filterBtns}</div>
      </div>
      <div class="theme-card-grid" role="radiogroup" aria-label="Available themes">${cardsHtml}</div>
    </div>`;
  }

  function getFontOptions(isMonoOnly) {
    const fonts = Xen.fontsCatalog || [];
    const list = [];

    // System options
    if (isMonoOnly) {
      list.push({ value: 'jetbrains-mono', label: 'JetBrains Mono', sub: 'Variable · Monospace (Default)', fontFamily: 'JetBrains Mono' });
      list.push({ value: 'fira-code', label: 'Fira Code', sub: 'Variable · Monospace', fontFamily: 'Fira Code' });
      list.push({ value: 'source-code-pro', label: 'Source Code Pro', sub: 'Variable · Monospace', fontFamily: 'Source Code Pro' });
      list.push({ value: 'inconsolata', label: 'Inconsolata', sub: 'Variable · Monospace', fontFamily: 'Inconsolata' });
      list.push({ value: 'space-mono', label: 'Space Mono', sub: '4 weights · Monospace', fontFamily: 'Space Mono' });
      list.push({ value: 'system', label: 'System Monospace', sub: 'Platform default monospace' });
      list.push({ value: 'classic', label: 'Courier New', sub: 'Classic typewriter' });
    } else {
      list.push({ value: 'spline-sans', label: 'Spline Sans', sub: 'Variable · Clean geometric sans (Default)', fontFamily: 'Spline Sans' });
      list.push({ value: 'inter', label: 'Inter', sub: 'Variable · Modern interface sans', fontFamily: 'Inter' });
      list.push({ value: 'outfit', label: 'Outfit', sub: 'Variable · Geometric display', fontFamily: 'Outfit' });
      list.push({ value: 'plus-jakarta-sans', label: 'Plus Jakarta Sans', sub: 'Variable · Clean grotesque', fontFamily: 'Plus Jakarta Sans' });
      list.push({ value: 'roboto', label: 'Roboto', sub: 'Variable · Neo-grotesque', fontFamily: 'Roboto' });
      list.push({ value: 'open-sans', label: 'Open Sans', sub: 'Variable · Humanist sans', fontFamily: 'Open Sans' });
      list.push({ value: 'lato', label: 'Lato', sub: '6 weights · Warm humanist sans', fontFamily: 'Lato' });
      list.push({ value: 'montserrat', label: 'Montserrat', sub: 'Variable · Geometric sans', fontFamily: 'Montserrat' });
      list.push({ value: 'fira-sans', label: 'Fira Sans', sub: '4 weights · Technical sans', fontFamily: 'Fira Sans' });
      list.push({ value: 'source-sans-3', label: 'Source Sans 3', sub: 'Variable · UI sans', fontFamily: 'Source Sans 3' });
      list.push({ value: 'eb-garamond', label: 'EB Garamond', sub: 'Classical serif typeface', fontFamily: 'EB Garamond' });
      list.push({ value: 'libre-baskerville', label: 'Libre Baskerville', sub: 'Transitional serif', fontFamily: 'Libre Baskerville' });
      list.push({ value: 'merriweather', label: 'Merriweather', sub: 'High-contrast editorial serif', fontFamily: 'Merriweather' });
      list.push({ value: 'system', label: 'System UI Font', sub: 'Operating system native font' });
    }

    // Append any remaining bundled fonts
    fonts.forEach((f) => {
      if (!list.some((existing) => existing.value === f.id)) {
        if (!isMonoOnly || f.isMonospace) {
          list.push({
            value: f.id,
            label: f.family,
            sub: `${f.weights.join(', ')} · ${f.category}`,
            fontFamily: f.family
          });
        }
      }
    });

    return list;
  }

  function getThemeDropdownOptions() {
    const list = [
      { value: 'system', label: 'System (Auto)', sub: 'Follow operating system theme' },
      { value: 'light', label: 'Default Light', sub: 'Studio Default Light' },
      { value: 'dark', label: 'Default Dark', sub: 'Studio Default Dark' }
    ];
    const catalog = Xen.themesCatalog || [];
    catalog.forEach((t) => {
      if (t.id !== 'light' && t.id !== 'dark') {
        list.push({
          value: t.id,
          label: t.name,
          sub: `${t.category} (Loto)`,
          swatches: [t.preview.bg, t.preview.surface, t.preview.accent, t.preview.text]
        });
      }
    });
    return list;
  }

  const body = {
    interface: () => {
      const themeOpts = getThemeDropdownOptions();
      const uiFontOpts = getFontOptions(false);
      return row('Active theme', 'Choose from Studio defaults or any of the 32 migrated Laurevine Loto themes.', Xen.dropdown.render({ id: 'theme', pref: 'theme', value: Pf.get('theme'), options: themeOpts, ariaLabel: 'Active Theme' })) +
        renderThemePicker() +
        row('Interface font', 'Used throughout menus, tabs, backstage, and window chrome.', Xen.dropdown.render({ id: 'uiFont', pref: 'uiFont', value: Pf.get('uiFont'), options: uiFontOpts, ariaLabel: 'Interface Font' })) +
        row('Density', 'Compact or comfortable height for titlebars, tabs, and buttons.', seg('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']]));
    },

    editor: () => {
      const editorFontOpts = getFontOptions(true);
      const tabWidthOpts = [
        { value: 2, label: '2 spaces', sub: 'Compact indentation' },
        { value: 4, label: '4 spaces', sub: 'Standard indentation (Default)' },
        { value: 8, label: '8 spaces', sub: 'Wide indentation' }
      ];

      return row('Editor font', 'Monospace and bundled typography for code and stylesheets.', Xen.dropdown.render({ id: 'editorFont', pref: 'editorFont', value: Pf.get('editorFont'), options: editorFontOpts, ariaLabel: 'Editor Font' })) +
        row('Font size', 'Editor line height scales proportionally.', `<div class="stepper"><button data-pref-step="-1" aria-label="Decrease font size">−</button><output>${Pf.get('editorSize')} px</output><button data-pref-step="1" aria-label="Increase font size">+</button></div>`) +
        row('Line numbers', 'Display gutter line numbers in the editor.', sw('lineNumbers', 'Line numbers')) +
        row('Highlight current line', 'Emphasize the active cursor line with subtle background shading.', sw('currentLine', 'Highlight current line')) +
        row('Indentation unit', 'Characters inserted by the Tab key.', seg('indentUnit', [['spaces', 'Spaces'], ['tabs', 'Tabs']])) +
        row('Tab width', 'Indentation step size.', Xen.dropdown.render({ id: 'tabWidth', pref: 'tabWidth', value: Pf.get('tabWidth'), options: tabWidthOpts, dataType: 'number', ariaLabel: 'Tab Width' })) +
        row('Syntax highlighting', 'Token coloring for XNP diagrams and XCSS stylesheets.', sw('highlight', 'Syntax highlighting')) +
        row('Bold keywords', 'Emphasize directives, shape tags, and keywords in bold weights.', sw('boldKeywords', 'Bold keywords'));
    },

    preview: () => {
      const zoomOpts = [
        { value: 'fit', label: 'Fit to view', sub: 'Automatic fit based on pane dimensions' },
        { value: '0.5', label: '50%', sub: 'Half scale' },
        { value: '0.75', label: '75%', sub: 'Three-quarter scale' },
        { value: '1', label: '100%', sub: 'Actual 1:1 pixel scale' },
        { value: '1.5', label: '150%', sub: 'Magnified view' }
      ];

      return row('Default zoom', 'Applied when opening or previewing a diagram.', Xen.dropdown.render({ id: 'previewZoom', pref: 'previewZoom', value: Pf.get('previewZoom'), options: zoomOpts, ariaLabel: 'Default Zoom' })) +
        row('Canvas background', 'Visual background pattern behind the rendered diagram.', seg('canvasBg', [['dots', 'Dots'], ['grid', 'Grid'], ['plain', 'Plain']])) +
        row('Re-fit on resize', 'Maintain diagram fitting whenever the editor pane is resized.', sw('refit', 'Re-fit on resize'));
    },

    files: () => row('Autosave recovery copy', 'Keeps an automatic recovery copy of unsaved work on this computer. Original documents remain intact.', sw('autosave', 'Autosave recovery')) +
      row('Offer recovery on start', 'Prompt to restore unsaved documents after an abnormal closure or crash.', sw('recovery', 'Offer recovery')) +
      row('Default export format', 'Preselected format when exporting diagrams to disk.', seg('exportFormat', [['svg', 'SVG'], ['png', 'PNG']])),

    shortcuts: () => Xen.shortcutsHtml()
  };

  Xen.panels = Xen.panels || {};
  Xen.panels.preferences = () => {
    const curTab = S.ui.prefsTab || 'interface';
    const curCat = CATS.find((c) => c[0] === curTab) || CATS[0];

    const navHtml = CATS.map(([id, label]) => {
      const isAct = curTab === id;
      return `<button data-cmd="prefs.tab" data-arg="${id}" class="${isAct ? 'is-active' : ''}" ${isAct ? 'aria-current="true"' : ''}>${esc(label)}</button>`;
    }).join('');

    return {
      wide: true,
      html: `<div class="bs-page bs-page--wide bs-page--prefs">
        <header class="bs-head">
          <div class="bs-head__meta">
            <h1>Preferences</h1>
            <p>Application appearance, typography, editor behaviors, and file settings.</p>
          </div>
          <div class="bs-head__actions">
            <button class="btn btn--sm btn--ghost" data-cmd="prefs.reset"><i data-icon="rotate-ccw"></i>Restore Defaults</button>
          </div>
        </header>
        <div class="prefs">
          <nav class="prefs__nav" aria-label="Preference categories">${navHtml}</nav>
          <section class="prefs__section">
            <div class="prefs__section-head">
              <h2>${esc(curCat[1])}</h2>
            </div>
            <div class="prefs__list">${body[curCat[0]]()}</div>
          </section>
        </div>
      </div>`
    };
  };

  Xen.shortcutsHtml = () => {
    const groups = {};
    if (Xen.shortcuts && Array.isArray(Xen.shortcuts.list)) {
      Xen.shortcuts.list.forEach((s) => (groups[s.group] = groups[s.group] || []).push(s));
    }
    return `<div class="shortcuts-table-wrap"><table class="reftable"><tbody>${Object.entries(groups).map(([g, items]) => `<tr><th colspan="2">${esc(g)}</th></tr>` + items.map((s) => `<tr><td class="k">${esc(s.label)}</td><td style="text-align:right"><kbd>${esc(util.fmtKeys(s.keys))}</kbd></td></tr>`).join('')).join('')}</tbody></table></div>`;
  };

  Xen.commands.registerAll({
    'prefs.tab': (id) => {
      S.ui.prefsTab = id;
      Xen.backstage.refresh();
    },
    'prefs.themeFilter': (f) => {
      themeFilter = f;
      Xen.backstage.refresh();
    },
    'prefs.reset': async () => {
      const r = await Xen.dialogs.choose({
        title: 'Restore default preferences?',
        message: 'All application settings, theme selections, and font choices will return to defaults. Your documents are not affected.',
        actions: [
          { id: 'cancel', label: 'Cancel' },
          { id: 'ok', label: 'Restore defaults', kind: 'primary' }
        ]
      });
      if (r === 'ok') {
        Pf.reset();
        Xen.backstage.refresh();
        Xen.toast('Default preferences restored.');
      }
    }
  });
})();
