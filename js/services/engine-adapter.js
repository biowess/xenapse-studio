/* Engine adapter. Delegates rendering to Xen.compiler. */
(function () {
  Xen.engine = {
    detectModule(xnp) {
      const m = /^[ \t]*IMPORT[ \t]+(FLOW|MINDMAP)\b/m.exec(xnp || '');
      return m ? m[1] : null;
    },
    async render({ xnp, xcss }) {
      const module = this.detectModule(xnp);
      const hasStylesheet = !!(Xen.doc && Xen.doc.state && Xen.doc.state.xcss);
      const res = await Xen.compiler.compile({ xnp, xcss, hasStylesheet });
      return {
        ok: res.ok,
        requestId: res.requestId,
        module,
        svg: res.svg,
        width: res.width,
        height: res.height,
        stderr: res.stderr,
        exitCode: res.exitCode,
        durationMs: res.durationMs,
        error: res.error,
        stale: res.stale,
      };
    },
  };
})();
