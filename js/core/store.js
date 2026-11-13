/* Single source of truth + tiny pub/sub. Topics: 'text' | 'doc' | 'ui' | 'prefs' | 'cursor' */
(function () {
  const listeners = {};
  const state = {
    doc: { fileName: 'untitled.xnp', path: null, eol: 'lf', get name() { const m = /^(.+)\.[^.\\/]*$/.exec(this.fileName); return m ? m[1] : this.fileName; }, loadId: 0, xnp: { text: '', saved: '' }, xcss: null, orphan: null },
    ui: { tab: 'xnp', xcssOpen: false, layout: 'split-h', split: 0.5, zoom: 1, fit: true, statusbar: true, backstage: null, prefsTab: 'editor', cursor: { line: 1, col: 1 } },
  };
  const on = (topic, fn) => { (listeners[topic] = listeners[topic] || []).push(fn); };
  const emit = (topic, payload) => { (listeners[topic] || []).slice().forEach((fn) => fn(payload)); };
  Xen.store = { state, on, emit };
})();
