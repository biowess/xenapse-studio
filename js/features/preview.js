/* Preview canvas: zoom, fit, pan, empty state, automatic compilation. */
(function () {
  const { store, util } = Xen, S = store.state, D = S.doc, { $ } = util;
  const canvas = $('#canvas'), stage = $('#stage'), label = $('#zoom-label'), fitBtn = $('#fit-btn'), badge = $('#preview-badge');
  const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];
  let natural = null;
  let lastGoodSvg = null;
  let lastGoodNatural = null;
  let seq = 0;
  let inFlight = false;
  let pending = false;
  let scheduleTimer = null;
  let lastXcssState = null;

  function applyZoom() {
    const svg = stage.querySelector('svg');
    if (svg && natural) {
      svg.setAttribute('width', natural.w * S.ui.zoom);
      svg.setAttribute('height', natural.h * S.ui.zoom);
    }
    label.textContent = natural ? Math.round(S.ui.zoom * 100) + '%' : '—';
    fitBtn.setAttribute('aria-pressed', S.ui.fit);
    store.emit('ui:zoom');
  }

  function fit() {
    S.ui.fit = true;
    if (natural) {
      const pad = 36 * 2 + 28 * 2 + 4;
      S.ui.zoom = util.clamp(Math.min((canvas.clientWidth - pad) / natural.w, (canvas.clientHeight - pad) / natural.h), 0.2, 1.5);
    }
    applyZoom();
  }

  function setZoom(z, anchor) {
    const old = S.ui.zoom;
    S.ui.fit = false;
    S.ui.zoom = util.clamp(z, 0.1, 6);
    const cx = anchor ? anchor.x : canvas.clientWidth / 2;
    const cy = anchor ? anchor.y : canvas.clientHeight / 2;
    const px = (canvas.scrollLeft + cx) / old;
    const py = (canvas.scrollTop + cy) / old;
    applyZoom();
    canvas.scrollLeft = px * S.ui.zoom - cx;
    canvas.scrollTop = py * S.ui.zoom - cy;
  }

  const step = (dir) => {
    const z = S.ui.zoom;
    const next = dir > 0
      ? STEPS.find((s) => s > z + 0.001) || STEPS[STEPS.length - 1]
      : [...STEPS].reverse().find((s) => s < z - 0.001) || STEPS[0];
    setZoom(next);
  };

  function hasContent(text) {
    if (!text) return false;
    return text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().length > 0;
  }

  function showEmptyInitial() {
    natural = null;
    lastGoodSvg = null;
    lastGoodNatural = null;
    badge.textContent = '';
    badge.hidden = true;
    badge.className = 'badge';
    stage.innerHTML = `<div class="empty"><img class="empty__mark" src="assets/brand/original/xenapse-symbol-mono.svg" alt=""><h3>Nothing to preview yet</h3><p>Add an IMPORT FLOW or IMPORT MINDMAP line to begin.</p><div class="empty__actions"><button class="btn" data-cmd="insert.module" data-arg="FLOW">IMPORT FLOW</button><button class="btn" data-cmd="insert.module" data-arg="MINDMAP">IMPORT MINDMAP</button></div></div>`;
    label.textContent = '—';
    if (Xen.editor) {
      Xen.editor.setMarkers('xnp', []);
      Xen.editor.setMarkers('xcss', []);
    }
    if (Xen.diagnostics) {
      Xen.diagnostics.setProblems([]);
    }
  }

  function applySvg(svgStr, nat) {
    natural = nat;
    stage.innerHTML = `<div class="sheet">${svgStr}</div>`;
    const z = Xen.prefs.get('previewZoom');
    if (z === 'fit') fit(); else { S.ui.fit = false; S.ui.zoom = parseFloat(z); applyZoom(); }
  }

  function applyLastGoodWithChip() {
    if (lastGoodSvg) {
      natural = lastGoodNatural;
      stage.innerHTML = `<div class="preview-chip">Showing the last successful preview</div><div class="sheet">${lastGoodSvg}</div>`;
      applyZoom();
    } else {
      natural = null;
      stage.innerHTML = `<div class="empty"><img class="empty__mark" src="assets/brand/original/xenapse-symbol-mono.svg" alt=""><h3>Nothing to preview yet</h3><p>Fix the errors to see a preview.</p></div>`;
      label.textContent = '—';
    }
  }

  async function compileNow() {
    if (!hasContent(D.xnp.text)) {
      showEmptyInitial();
      return;
    }

    inFlight = true;
    const reqId = ++seq;
    store.emit('compiler:running', true);

    let res;
    try {
      res = await Xen.engine.render({
        xnp: D.xnp.text,
        xcss: D.xcss && D.xcss.text,
      });
    } catch (err) {
      res = {
        ok: false,
        requestId: reqId,
        exitCode: null,
        svg: null,
        stderr: '',
        durationMs: 0,
        error: { type: 'spawn', message: err.message || String(err) },
        stale: false,
      };
    } finally {
      inFlight = false;
      store.emit('compiler:running', false);
    }

    // Discard stale results: must never update preview, panel, markers or status bar
    if (res.stale || reqId !== seq) {
      if (pending) {
        pending = false;
        compileNow();
      }
      return;
    }

    // Missing compiler is handled by dependency overlay
    if (res.error && res.error.type === 'missing-compiler') {
      if (pending) {
        pending = false;
        compileNow();
      }
      return;
    }

    // Diagnostics parsing
    let diagnostics = [];
    if (Xen.diagnostics) {
      diagnostics = Xen.diagnostics.parse(res.stderr);
      if (res.error) {
        const msg = res.error.type === 'timeout'
          ? 'The compiler did not respond within 10 seconds.'
          : (res.error.message || 'Compiler process failed');
        diagnostics.push({
          severity: 'error',
          code: null,
          message: msg,
          help: null,
          notes: [],
          origin: 'system',
          line: null,
          col: null,
        });
      }
    }

    // 1. Result handling
    if (res.exitCode === 0) {
      // Exit 0 (warnings allowed) -> update SVG; warnings stay in panel
      lastGoodSvg = res.svg;
      lastGoodNatural = { w: res.width, h: res.height };
      applySvg(res.svg, lastGoodNatural);
      const mod = res.module || Xen.engine.detectModule(D.xnp.text);
      badge.textContent = mod || 'Ready';
      badge.className = 'badge';
      badge.hidden = false;
    } else if (res.exitCode === 1) {
      // Exit 1 -> keep last good SVG with chip, or empty state if none
      applyLastGoodWithChip();
      badge.textContent = 'Errors';
      badge.className = 'badge badge--danger';
      badge.hidden = false;
    } else {
      // Exit 2 / process error -> system error entry, preview unchanged
      badge.textContent = 'Errors';
      badge.className = 'badge badge--danger';
      badge.hidden = false;
    }

    // 2. Update panel & markers
    if (Xen.diagnostics) {
      Xen.diagnostics.setProblems(diagnostics);
    }
    if (Xen.editor) {
      Xen.editor.setMarkers('xnp', diagnostics.filter((d) => d.origin === 'source' && d.line).map((d) => ({ line: d.line, severity: d.severity })));
      Xen.editor.setMarkers('xcss', diagnostics.filter((d) => d.origin === 'stylesheet' && d.line).map((d) => ({ line: d.line, severity: d.severity })));
    }

    store.emit('engine', res);

    if (pending) {
      pending = false;
      compileNow();
    }
  }

  function schedule() {
    if (scheduleTimer) clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(() => {
      scheduleTimer = null;
      if (inFlight) {
        pending = true;
      } else {
        compileNow();
      }
    }, 300);
  }

  function triggerNow() {
    if (scheduleTimer) {
      clearTimeout(scheduleTimer);
      scheduleTimer = null;
    }
    if (inFlight) {
      pending = true;
    } else {
      compileNow();
    }
  }

  /* pan with drag, zoom with Ctrl/Cmd + wheel */
  let pan = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    pan = { x: e.clientX, y: e.clientY, l: canvas.scrollLeft, t: canvas.scrollTop };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-panning');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pan) return;
    canvas.scrollLeft = pan.l - (e.clientX - pan.x);
    canvas.scrollTop = pan.t - (e.clientY - pan.y);
  });
  ['pointerup', 'pointercancel'].forEach((t) => canvas.addEventListener(t, () => {
    pan = null;
    canvas.classList.remove('is-panning');
  }));
  canvas.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    setZoom(S.ui.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX - r.left, y: e.clientY - r.top });
  }, { passive: false });
  new ResizeObserver(() => { if (S.ui.fit && Xen.prefs.get('refit')) fit(); }).observe(canvas);

  store.on('text', ({ buffer }) => { if (buffer === 'xnp' || buffer === 'xcss') schedule(); });
  store.on('doc', () => {
    if (D.loadId !== Xen.preview.loadId) {
      Xen.preview.loadId = D.loadId;
      seq++;
      lastGoodSvg = null;
      lastGoodNatural = null;
      lastXcssState = D.xcss ? D.xcss.state : null;
      triggerNow();
    } else {
      const curState = D.xcss ? D.xcss.state : null;
      if (curState !== lastXcssState) {
        lastXcssState = curState;
        triggerNow();
      }
    }
  });

  Xen.preview = { render: triggerNow, fit, setZoom, loadId: -1 };
  Xen.commands.registerAll({
    'zoom.in': () => step(1),
    'zoom.out': () => step(-1),
    'zoom.actual': () => setZoom(1),
    'zoom.fit': fit,
  });
})();
