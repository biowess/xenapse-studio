/* XCSS lifecycle: add, attach, create missing, open, close tab (never detaches), detach, export a copy.
   The stylesheet is always an external file referenced by the STYLESHEET "path" directive. */
(function () {
  const { store } = Xen, S = store.state, D = S.doc, Doc = Xen.doc;
  const ui = () => store.emit('ui');
  const status = () => (D.xcss ? D.xcss.state : 'none');

  function open() {
    if (!D.xcss) return;
    S.ui.xcssOpen = true; S.ui.tab = 'xcss'; ui();
  }
  function sync() { store.emit('text', { buffer: 'xnp', source: 'sync' }); store.emit('text', { buffer: 'xcss', source: 'sync' }); store.emit('doc'); }

  /** Single place that turns a chosen stylesheet file into the string written in STYLESHEET "…".
      Today: the file's base name. A later prompt substitutes a path relative to the saved document. */
  function declaredPathFor({ fileName }) { return fileName; }

  function add() {
    if (D.xcss) return open();                       // never duplicate a reference
    const declared = Doc.suggestStylesheetName();
    D.xnp.text = Doc.insertDirective(D.xnp.text, declared);
    D.xcss = { declared, fileName: Doc.baseName(declared), path: null, text: Xen.samples.STARTER_XCSS, saved: null, state: 'new' };
    sync(); open();
    Xen.toast(`Stylesheet ${D.xcss.fileName} created. It is saved with the document.`, { kind: 'success' });
  }

  async function attachExisting() {
    if (D.xcss) return open();
    const defaultDir = D.path ? D.path.replace(/[\\/][^\\/]+$/, '') : null;
    const picked = await Xen.fileService.openStylesheetDialog({ defaultDir });
    if (!picked) return;
    const res = await Xen.fileService.readText(picked);
    if (res.error) {
      return Xen.dialogs.alert({ title: 'Could not attach stylesheet', message: res.error.message, error: true });
    }
    if (D.xcss) return open();                       // changed while the picker was open
    const base = Doc.baseName(picked);
    let declared = base;
    if (D.path) {
      declared = await Xen.fileService.relativePath({ fromDocPath: D.path, toPath: picked });
    }
    D.xnp.text = Doc.insertDirective(D.xnp.text, declared);
    D.xcss = { declared, fileName: base, path: picked, text: res.text, saved: res.text, state: 'loaded' };
    sync(); open();
    Xen.toast(`Attached ${D.xcss.fileName}.`, { kind: 'success' });
  }

  function createMissing() {
    const x = D.xcss; if (!x || x.state !== 'missing') return;
    x.state = 'new'; x.text = Xen.samples.STARTER_XCSS; x.saved = null; x.path = null;
    sync(); open();
    Xen.toast(`Stylesheet ${x.fileName} created. It is saved with the document.`, { kind: 'success' });
  }

  /** Closing the editor tab. Does NOT detach the stylesheet. */
  async function closeTab() {
    const x = D.xcss;
    if (!S.ui.xcssOpen) return true;
    if (x && Doc.xcssDirty()) {
      const isNew = x.saved === null;
      const r = await Xen.dialogs.unsaved({
        title: `Save changes to ${x.fileName}?`,
        message: isNew ? 'This stylesheet has not been saved yet. If you discard it, the reference is removed from the source.' : 'Your changes to this stylesheet will be lost if you discard them.',
        saveLabel: 'Save', discardLabel: 'Discard',
      });
      if (r === 'cancel') return false;
      if (r === 'save') Xen.files.saveXcss();
      else if (isNew) { D.xnp.text = Doc.removeDirective(D.xnp.text); D.xcss = null; D.orphan = null; sync(); }
      else { x.text = x.saved; store.emit('text', { buffer: 'xcss', source: 'sync' }); }
    }
    S.ui.xcssOpen = false; if (S.ui.tab === 'xcss') S.ui.tab = 'xnp'; ui(); store.emit('doc');
    return true;
  }

  /** Explicit detach: removes the reference from the XNP; the buffer is kept in D.orphan. */
  async function detach() {
    const x = D.xcss; if (!x) return;
    const r = await Xen.dialogs.choose({
      title: 'Detach stylesheet?',
      message: `The reference to ${x.fileName} will be removed from the source. A file you already saved is not deleted.`,
      actions: [{ id: 'cancel', label: 'Cancel' }, { id: 'detach', label: 'Detach stylesheet', kind: 'primary' }],
    });
    if (r !== 'detach') return;
    D.xnp.text = Doc.removeDirective(D.xnp.text);
    D.orphan = x; D.xcss = null; S.ui.xcssOpen = false; S.ui.tab = 'xnp';
    sync(); ui(); Xen.toast('Stylesheet detached.', { kind: 'success' });
  }

  async function extract() {
    const x = D.xcss; if (!x) return;
    const defaultDir = x.path ? x.path.replace(/[\\/][^\\/]+$/, '') : (D.path ? D.path.replace(/[\\/][^\\/]+$/, '') : null);
    const savePath = await Xen.fileService.saveDialog({ kind: 'xcss', defaultName: x.fileName, defaultDir });
    if (!savePath) return;
    const pathEquals = (a, b) => a && b && (Xen.platform?.os === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
    if (x.path && pathEquals(savePath, x.path)) {
      return Xen.dialogs.alert({ title: 'Cannot export over stylesheet', message: 'Use Save to write the stylesheet itself.', error: true });
    }
    const res = await Xen.fileService.writeText({ path: savePath, text: x.text, eol: D.eol });
    if (res.error) {
      return Xen.dialogs.alert({ title: 'Export failed', message: res.error.message, error: true });
    }
    Xen.toast(`Exported copy as ${Doc.baseName(savePath)}.`, { kind: 'success' });
  }

  const primary = () => {
    if (S.ui.xcssOpen && D.xcss) return { label: 'Switch to XCSS tab', run: open };
    if (!D.xcss) return { label: 'Add XCSS stylesheet', run: add };
    if (D.xcss.state === 'missing') return { label: 'Create missing stylesheet', run: createMissing };
    return { label: 'Open XCSS stylesheet', run: open };
  };

  Xen.xcss = { status, add, attachExisting, createMissing, open, closeTab, detach, extract, primary, declaredPathFor };
  Xen.commands.registerAll({
    'xcss.primary': () => primary().run(), 'xcss.add': () => add(), 'xcss.attachExisting': () => attachExisting(), 'xcss.createMissing': createMissing,
    'xcss.closeTab': () => closeTab(), 'xcss.detach': () => detach(), 'xcss.extract': extract,
  });
})();
