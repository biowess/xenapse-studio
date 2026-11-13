/* Compiler service. Bridges the renderer to the native compiler runner and locator. */
(function () {
  let reqSeq = 0;
  let currentStatus = {
    found: false,
    usable: false,
    path: null,
    source: null,
    version: null,
    reason: 'uninitialized',
    candidates: [],
  };

  function parseSvgDimensions(svg) {
    if (!svg || typeof svg !== 'string') return { width: null, height: null };
    const rootMatch = /<svg\b([^>]*)>/i.exec(svg);
    if (!rootMatch) return { width: null, height: null };
    const attrs = rootMatch[1];
    const wMatch = /\bwidth=(?:"([^"]+)"|'([^']+)')/i.exec(attrs);
    const hMatch = /\bheight=(?:"([^"]+)"|'([^']+)')/i.exec(attrs);
    let width = wMatch ? parseFloat(wMatch[1] || wMatch[2]) : null;
    let height = hMatch ? parseFloat(hMatch[1] || hMatch[2]) : null;
    if (!width || !height || isNaN(width) || isNaN(height)) {
      const vbMatch = /\bviewBox=(?:"([^"]+)"|'([^']+)')/i.exec(attrs);
      if (vbMatch) {
        const parts = (vbMatch[1] || vbMatch[2]).trim().split(/[\s,]+/);
        if (parts.length === 4) {
          const vbW = parseFloat(parts[2]);
          const vbH = parseFloat(parts[3]);
          if (!isNaN(vbW) && !isNaN(vbH)) {
            if (!width || isNaN(width)) width = vbW;
            if (!height || isNaN(height)) height = vbH;
          }
        }
      }
    }
    return {
      width: (typeof width === 'number' && !isNaN(width)) ? width : null,
      height: (typeof height === 'number' && !isNaN(height)) ? height : null,
    };
  }

  const Compiler = {
    async init() {
      if (Xen.native && Xen.native.compiler) {
        try {
          currentStatus = await Xen.native.compiler.status();
        } catch (e) {
          currentStatus = {
            found: false,
            usable: false,
            path: null,
            source: null,
            version: null,
            reason: e.message || 'status-check-failed',
            candidates: [],
          };
        }
        Xen.native.compiler.onStatusChanged((s) => {
          currentStatus = s;
          Xen.store.emit('compiler:status', s);
        });
      }
      return currentStatus;
    },

    status() {
      return currentStatus;
    },

    async recheck() {
      if (Xen.native && Xen.native.compiler) {
        try {
          currentStatus = await Xen.native.compiler.recheck();
        } catch (e) {
          currentStatus = {
            found: false,
            usable: false,
            path: null,
            source: null,
            version: null,
            reason: e.message || 'recheck-failed',
            candidates: [],
          };
        }
      }
      Xen.store.emit('compiler:status', currentStatus);
      return currentStatus;
    },

    async compile({ xnp, xcss, hasStylesheet }) {
      const requestId = ++reqSeq;
      if (!Xen.native || !Xen.native.compiler) {
        return {
          ok: false,
          requestId,
          exitCode: null,
          svg: null,
          width: null,
          height: null,
          stderr: '',
          durationMs: 0,
          error: { type: 'missing-compiler', message: 'Native compiler IPC not available' },
          stale: false,
        };
      }

      let res;
      try {
        res = await Xen.native.compiler.compile({
          requestId,
          xnp: typeof xnp === 'string' ? xnp : '',
          xcss: typeof xcss === 'string' ? xcss : '',
          hasStylesheet: !!hasStylesheet,
        });
      } catch (err) {
        res = {
          requestId,
          exitCode: null,
          svg: null,
          stderr: '',
          durationMs: 0,
          error: { type: 'spawn', message: err.message || String(err) },
        };
      }

      const isStale = res.requestId !== reqSeq;
      const dims = parseSvgDimensions(res.svg);
      const ok = res.exitCode === 0 && typeof res.svg === 'string';

      if (res.error && res.error.type === 'missing-compiler') {
        currentStatus.usable = false;
        Xen.store.emit('compiler:status', currentStatus);
        if (Xen.dependency && typeof Xen.dependency.show === 'function') {
          Xen.dependency.show();
        }
      }

      return {
        ok,
        requestId: res.requestId,
        exitCode: res.exitCode,
        svg: res.svg,
        width: dims.width,
        height: dims.height,
        stderr: res.stderr || '',
        durationMs: res.durationMs || 0,
        error: res.error || null,
        stale: isStale,
      };
    },
  };

  Xen.compiler = Compiler;
})();
