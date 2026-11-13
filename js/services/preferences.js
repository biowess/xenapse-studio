/* Preferences service: defaults, font catalogue, theme system, localStorage persistence, DOM application */
(function () {
  const KEY = 'xenapse.prefs.v1';
  const DEFAULTS = {
    theme: 'light',
    density: 'comfortable',
    uiFont: 'spline-sans',
    editorFont: 'jetbrains-mono',
    editorSize: 13,
    lineNumbers: true,
    currentLine: true,
    highlight: true,
    boldKeywords: true,
    indentUnit: 'spaces',
    tabWidth: 4,
    previewZoom: 'fit',
    canvasBg: 'dots',
    refit: true,
    autosave: true,
    recovery: true,
    exportFormat: 'svg'
  };

  const SYS_UI = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
  const SYS_MONO = '"Cascadia Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

  // Build complete font maps from bundled font catalogue
  const UI_FONTS = {
    system: SYS_UI,
    splinesans: '"Spline Sans", ' + SYS_UI,
    'spline-sans': '"Spline Sans", ' + SYS_UI,
    inter: '"Inter", ' + SYS_UI,
  };

  const EDITOR_FONTS = {
    system: SYS_MONO,
    classic: '"Courier New", Courier, monospace',
    jetbrains: '"JetBrains Mono", ' + SYS_MONO,
    'jetbrains-mono': '"JetBrains Mono", ' + SYS_MONO,
    fira: '"Fira Code", ' + SYS_MONO,
    'fira-code': '"Fira Code", ' + SYS_MONO,
    sourcecode: '"Source Code Pro", ' + SYS_MONO,
    'source-code-pro': '"Source Code Pro", ' + SYS_MONO,
    inconsolata: '"Inconsolata", ' + SYS_MONO,
    spacemono: '"Space Mono", ' + SYS_MONO,
    'space-mono': '"Space Mono", ' + SYS_MONO,
  };

  if (Xen.fontsCatalog && Array.isArray(Xen.fontsCatalog)) {
    Xen.fontsCatalog.forEach((f) => {
      const familyStack = `"${f.family}", ` + (f.isMonospace ? SYS_MONO : SYS_UI);
      UI_FONTS[f.id] = familyStack;
      EDITOR_FONTS[f.id] = familyStack;
    });
  }

  const MIGRATE = {
    uiFont: { sans: 'spline-sans', humanist: 'spline-sans', grotesque: 'spline-sans', splinesans: 'spline-sans' },
    editorFont: { plex: 'jetbrains-mono', jetbrains: 'jetbrains-mono', fira: 'fira-code', sourcecode: 'source-code-pro', spacemono: 'space-mono' }
  };

  function normalize(p) {
    let changed = false;
    [['uiFont', UI_FONTS], ['editorFont', EDITOR_FONTS]].forEach(([k, map]) => {
      let v = p[k];
      if (MIGRATE[k] && Object.prototype.hasOwnProperty.call(MIGRATE[k], v)) v = MIGRATE[k][v];
      if (typeof v !== 'string' || !Object.prototype.hasOwnProperty.call(map, v)) v = DEFAULTS[k];
      if (v !== p[k]) { p[k] = v; changed = true; }
    });
    return changed;
  }

  let prefs = Object.assign({}, DEFAULTS);
  try {
    Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (e) {
    /* ignore storage read error */
  }

  if (normalize(prefs)) {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) {
      /* storage unavailable */
    }
  }

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const resolvedTheme = () => {
    if (prefs.theme === 'system') {
      return mq.matches ? 'dark' : 'light';
    }
    return prefs.theme || 'light';
  };

  function isThemeDark(themeId) {
    if (themeId === 'dark') return true;
    if (themeId === 'light') return false;
    if (themeId === 'system') return mq.matches;
    if (Xen.themesCatalog) {
      const t = Xen.themesCatalog.find((x) => x.id === themeId);
      if (t) return t.isDark;
    }
    return false;
  }

  function apply() {
    const root = document.documentElement;
    const st = root.style;
    const b = document.body;
    const curTheme = resolvedTheme();
    const dark = isThemeDark(curTheme);

    root.dataset.theme = curTheme;
    root.dataset.density = prefs.density || 'comfortable';
    root.style.colorScheme = dark ? 'dark' : 'light';

    st.setProperty('--font-ui', UI_FONTS[prefs.uiFont] || UI_FONTS['spline-sans'] || UI_FONTS.splinesans);
    st.setProperty('--font-mono', EDITOR_FONTS[prefs.editorFont] || EDITOR_FONTS['jetbrains-mono'] || EDITOR_FONTS.jetbrains);
    st.setProperty('--editor-size', (prefs.editorSize || 13) + 'px');
    st.setProperty('--editor-lh', Math.round((prefs.editorSize || 13) * 1.62) + 'px');
    st.setProperty('--tab-size', prefs.tabWidth || 4);

    b.classList.toggle('pref-no-linenumbers', !prefs.lineNumbers);
    b.classList.toggle('pref-no-curline', !prefs.currentLine);
    b.classList.toggle('pref-no-kwbold', !prefs.boldKeywords);
    b.dataset.canvas = prefs.canvasBg || 'dots';
  }

  Xen.prefs = {
    DEFAULTS,
    UI_FONTS,
    EDITOR_FONTS,
    get: (k) => prefs[k],
    all: () => Object.assign({}, prefs),
    set(k, v) {
      prefs[k] = v;
      try {
        localStorage.setItem(KEY, JSON.stringify(prefs));
      } catch (e) {
        /* storage unavailable */
      }
      apply();
      Xen.store.emit('prefs', { key: k, value: v });
    },
    reset() {
      prefs = Object.assign({}, DEFAULTS);
      try {
        localStorage.removeItem(KEY);
      } catch (e) {
        /* ignore */
      }
      apply();
      Xen.store.emit('prefs', { key: '*' });
    },
    resolvedTheme,
    isThemeDark,
    apply,
    indentUnit: () => (prefs.indentUnit === 'tabs' ? '\t' : ' '.repeat(prefs.tabWidth || 4)),
  };

  mq.addEventListener && mq.addEventListener('change', () => {
    if (prefs.theme === 'system') {
      apply();
      Xen.store.emit('prefs', { key: 'theme' });
    }
  });
})();
