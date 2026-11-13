/* Native document file operations built on Xen.fileService (IPC to Electron main). */
(function () {
  const { store } = Xen, S = store.state, D = S.doc, Doc = Xen.doc, fs = Xen.fileService;
  const closeBackstage = () => Xen.backstage && Xen.backstage.close();
  const fail = (title, message) => Xen.dialogs.alert({ title, message, error: true });
  const pathDir = (p) => (p ? p.replace(/[\\/][^\\/]+$/, '') : null);
  const pathBase = (p) => (p ? (p.split(/[\\/]/).pop() || p) : '');
  const pathEquals = (a, b) => a && b && (Xen.platform?.os === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

  let lastSaveDir = null;
  let saveQueue = Promise.resolve();

  async function confirmUnsaved(consequence) {
    if (!Doc.isDirty()) return true;
    const r = await Xen.dialogs.unsaved({
      title: `Save changes to ${Doc.xnpFileName()}?`,
      message: `${consequence} Unsaved changes will be lost if you discard them.`,
    });
    if (r === 'cancel') return false;
    if (r === 'save') {
      const ok = await save();
      if (!ok) return false;
    }
    return true;
  }

  function save() {
    saveQueue = saveQueue.then(doSave, doSave);
    return saveQueue;
  }

  async function doSave() {
    if (!D.path) return saveAs();

    let writeRes = await fs.writeText({
      path: D.path,
      text: D.xnp.text,
      eol: D.eol,
      expectedMtimeMs: D.mtimeMs,
    });

    if (writeRes && writeRes.conflict) {
      const r = await Xen.dialogs.choose({
        title: 'File changed on disk',
        message: `“${Doc.xnpFileName()}” has been modified on disk by another program. Do you want to overwrite it or save as a different file?`,
        actions: [
          { id: 'cancel', label: 'Cancel' },
          { id: 'saveas', label: 'Save As…' },
          { id: 'overwrite', label: 'Overwrite', kind: 'danger' },
        ],
      });
      if (r === 'saveas') return saveAs();
      if (r !== 'overwrite') return false;

      writeRes = await fs.writeText({
        path: D.path,
        text: D.xnp.text,
        eol: D.eol,
      });
    }

    if (writeRes && writeRes.error) {
      fail('Could not save document', writeRes.error.message);
      return false;
    }

    D.mtimeMs = writeRes.mtimeMs;
    let xcssSaved = false;
    let xcssError = null;

    const x = D.xcss;
    const shouldWriteXcss = x && x.state !== 'missing' && (Doc.xcssDirty() || (x.state === 'new' && x.path === null));

    if (shouldWriteXcss) {
      let targetPath = x.path;
      if (!targetPath) {
        const resolved = await fs.resolveStylesheet({ docPath: D.path, declared: x.declared });
        targetPath = resolved.path;
        if (resolved.exists) {
          const ovr = await Xen.dialogs.choose({
            title: 'Overwrite stylesheet?',
            message: `The stylesheet file “${x.fileName}” already exists on disk. Do you want to overwrite it?`,
            actions: [
              { id: 'cancel', label: 'Cancel' },
              { id: 'overwrite', label: 'Overwrite', kind: 'danger' },
            ],
          });
          if (ovr !== 'overwrite') {
            xcssError = 'Save cancelled by user';
          }
        }
      }

      if (!xcssError) {
        const xRes = await fs.writeText({
          path: targetPath,
          text: x.text,
          eol: D.eol,
        });
        if (xRes && xRes.error) {
          xcssError = xRes.error.message;
        } else {
          x.path = targetPath;
          xcssSaved = true;
        }
      }
    }

    if (xcssError) {
      Doc.markSaved({ xnp: true, xcss: false });
      await Xen.dialogs.alert({
        title: 'Stylesheet save failed',
        message: `The document was saved, but “${x.fileName}” could not be saved: ${xcssError}`,
        error: true,
      });
    } else {
      Doc.markSaved({ xnp: true, xcss: shouldWriteXcss ? true : false });
    }

    await fs.clearRecovery();
    store.emit('doc:saved', {
      path: D.path,
      fileName: D.fileName,
      xcssPath: D.xcss ? D.xcss.path : null,
      module: Doc.parseHeader(D.xnp.text).module,
    });

    const savedNames = [Doc.xnpFileName()];
    if (xcssSaved && x) savedNames.push(x.fileName);
    Xen.toast(`Saved ${savedNames.join(' and ')}.`, { kind: 'success' });
    return true;
  }

  async function saveAs() {
    const defaultDir = D.path ? pathDir(D.path) : lastSaveDir;
    const newDocPath = await fs.saveDialog({ kind: 'xnp', defaultName: D.fileName, defaultDir });
    if (!newDocPath) return false;

    lastSaveDir = pathDir(newDocPath);
    const newFileName = pathBase(newDocPath);
    const oldDir = D.path ? pathDir(D.path) : null;
    const newDir = pathDir(newDocPath);
    const x = D.xcss;
    const follows = Doc.followsDocument();

    if (x && !follows && x.path && oldDir && oldDir !== newDir) {
      const choice = await Xen.dialogs.choose({
        title: 'Stylesheet location',
        message: `This document uses stylesheet “${x.fileName}” located in ${oldDir}.`,
        actions: [
          { id: 'cancel', label: 'Cancel' },
          { id: 'keep', label: 'Keep pointing at original location' },
          { id: 'copy', label: 'Copy stylesheet to new folder', kind: 'primary' },
        ],
      });
      if (choice === 'cancel') return false;
      if (choice === 'copy') {
        x.path = null;
        x.declared = x.fileName;
        D.xnp.text = Doc.setDeclared(D.xnp.text, x.fileName);
      } else if (choice === 'keep') {
        const rel = await fs.relativePath({ fromDocPath: newDocPath, toPath: x.path });
        x.declared = rel;
        D.xnp.text = Doc.setDeclared(D.xnp.text, rel);
      }
    }

    Doc.setLocation({ fileName: newFileName, path: newDocPath });
    const ok = await doSave();
    if (ok) closeBackstage();
    return ok;
  }

  async function saveXcss() {
    const x = D.xcss;
    if (!x || x.state === 'missing') return;

    let targetPath = x.path;
    if (!targetPath) {
      if (D.path) {
        const resolved = await fs.resolveStylesheet({ docPath: D.path, declared: x.declared });
        targetPath = resolved.path;
        if (resolved.exists) {
          const ovr = await Xen.dialogs.choose({
            title: 'Overwrite stylesheet?',
            message: `The stylesheet “${x.fileName}” already exists on disk. Overwrite it?`,
            actions: [
              { id: 'cancel', label: 'Cancel' },
              { id: 'overwrite', label: 'Overwrite', kind: 'danger' },
            ],
          });
          if (ovr !== 'overwrite') return;
        }
      } else {
        targetPath = await fs.saveDialog({ kind: 'xcss', defaultName: x.fileName, defaultDir: lastSaveDir });
        if (!targetPath) return;
        lastSaveDir = pathDir(targetPath);
      }
    }

    const res = await fs.writeText({ path: targetPath, text: x.text, eol: D.eol });
    if (res.error) {
      return fail('Could not save stylesheet', res.error.message);
    }
    x.path = targetPath;
    Doc.markSaved({ xnp: false, xcss: true });
    Xen.toast(`Saved ${x.fileName}.`, { kind: 'success' });
  }

  async function openPath(filePath, opts = {}) {
    if (!filePath) return { ok: false, error: 'NO_PATH' };
    const base = pathBase(filePath);
    if (!/\.xnp$/i.test(base)) {
      fail('Unsupported file type', `“${base}” is not a Xenapse document (.xnp).`);
      return { ok: false, error: 'BAD_TYPE' };
    }
    if (!(await confirmUnsaved('Opening a file will replace the current document.'))) return { ok: false, error: 'CANCELLED' };

    const res = await fs.readText(filePath);
    if (res.error) {
      const code = res.error.code;
      if (code === 'ENOENT') {
        if (!opts.silentNotFound) fail('File not found', `“${base}” could not be found.`);
      }
      else if (code === 'EACCES') fail('Permission denied', `Permission denied when opening “${base}”.`);
      else if (code === 'TOO_LARGE') fail('File too large', res.error.message);
      else if (code === 'BINARY') fail('Binary file', `“${base}” appears to be a binary file, not text.`);
      else if (code === 'BAD_ENCODING') fail('Invalid UTF-8', `“${base}” does not contain valid UTF-8 text.`);
      else if (code === 'NOT_GRANTED') fail('Access denied', `Access to “${base}” was not granted.`);
      else fail('Could not open file', res.error.message);
      return { ok: false, error: code };
    }

    const h = Doc.parseHeader(res.text);
    let xcssData = null;
    let stylesheetResolved = null;

    if (h.declared !== null) {
      stylesheetResolved = await fs.resolveStylesheet({ docPath: filePath, declared: h.declared });
      if (stylesheetResolved && stylesheetResolved.exists) {
        const xres = await fs.readText(stylesheetResolved.path);
        if (xres.error) {
          Xen.dialogs.alert({ title: 'Stylesheet unreadable', message: `Could not read “${h.declared}”: ${xres.error.message}`, error: true });
          xcssData = { text: '', path: stylesheetResolved.path, saved: null, state: 'unreadable' };
        } else {
          xcssData = { text: xres.text, path: stylesheetResolved.path, saved: xres.text, state: 'loaded' };
        }
      } else {
        xcssData = { text: '', path: null, saved: null, state: 'missing' };
      }
    }

    Doc.load({ fileName: base, path: filePath, eol: res.eol, xnp: res.text, xcss: xcssData });
    D.mtimeMs = res.mtimeMs;
    closeBackstage();
    if (Xen.welcome) Xen.welcome.hide();
    store.emit('doc:opened', { path: filePath, fileName: base, xcssPath: D.xcss ? D.xcss.path : null, module: h.module });
    Xen.toast(`Opened ${base}.`, { kind: 'success' });

    if (h.declared !== null && (!stylesheetResolved || !stylesheetResolved.exists)) {
      const act = await Xen.dialogs.choose({
        title: 'Stylesheet not found',
        message: `The declared stylesheet “${h.declared}” could not be found.`,
        actions: [
          { id: 'ignore', label: 'Open without stylesheet' },
          { id: 'create', label: 'Create stylesheet' },
          { id: 'locate', label: 'Locate…', kind: 'primary' },
        ],
      });
      if (act === 'create') {
        Xen.xcss.createMissing();
      } else if (act === 'locate') {
        const picked = await fs.openStylesheetDialog({ defaultDir: pathDir(filePath) });
        if (picked) {
          const pres = await fs.readText(picked);
          if (pres.error) {
            fail('Could not read stylesheet', pres.error.message);
          } else {
            const rel = await fs.relativePath({ fromDocPath: filePath, toPath: picked });
            D.xnp.text = Doc.setDeclared(D.xnp.text, rel);
            D.xcss = { declared: rel, fileName: Doc.baseName(rel), path: picked, text: pres.text, saved: pres.text, state: 'loaded' };
            store.emit('text', { buffer: 'xnp', source: 'sync' });
            store.emit('text', { buffer: 'xcss', source: 'sync' });
            store.emit('doc');
          }
        }
      }
    }
    return { ok: true };
  }

  async function openDialog() {
    const chosen = await fs.openDocumentDialog();
    if (chosen) await openPath(chosen);
  }

  async function openFiles(files) {
    if (!files || !files.length) return;
    const paths = files.map((f) => (typeof f === 'string' ? f : Xen.native?.files?.getPathForFile(f))).filter(Boolean);
    if (!paths.length) return;
    const granted = await fs.grantDropped(paths);
    const xnp = granted.find((p) => /\.xnp$/i.test(p));
    if (xnp) {
      await openPath(xnp);
    } else if (paths.some((p) => /\.xcss$/i.test(p))) {
      Xen.toast('Drop a .xnp file to open it. Stylesheets open together with their document.', { kind: 'warn' });
    } else {
      fail('Unsupported file type', 'Only Xenapse documents (.xnp) can be opened.');
    }
  }

  async function newBlank() {
    if (!(await confirmUnsaved('Creating a new document will replace the current one.'))) return;
    const fileName = await fs.suggestName({ kind: 'xnp', base: 'untitled' });
    Doc.load({ fileName, path: null, eol: 'lf', xnp: 'IMPORT FLOW\n\nSTART\n\nEND\n', xcss: null, dirty: false });
    D.mtimeMs = null;
    closeBackstage();
    if (Xen.welcome) Xen.welcome.hide();
    Xen.toast(`New document: ${fileName}.`);
  }

  async function newDocument(id) {
    const t = Xen.samples[id];
    if (!t) return newBlank();
    if (!(await confirmUnsaved('Creating a new document will replace the current one.'))) return;
    const fileName = await fs.suggestName({ kind: 'xnp', base: t.id || 'untitled' });
    Doc.load({ fileName, path: null, eol: 'lf', xnp: t.xnp, xcss: t.xcss, dirty: false });
    D.mtimeMs = null;
    closeBackstage();
    if (Xen.welcome) Xen.welcome.hide();
    Xen.toast(`New document: ${t.title}.`);
  }

  async function resolveStylesheet() {
    if (!D.path || !D.xcss || D.xcss.state !== 'missing') return;
    const targetDeclared = D.xcss.declared;
    const resolved = await fs.resolveStylesheet({ docPath: D.path, declared: targetDeclared });
    if (resolved && resolved.exists && D.xcss && D.xcss.declared === targetDeclared) {
      const res = await fs.readText(resolved.path);
      if (!res.error && D.xcss && D.xcss.declared === targetDeclared) {
        D.xcss.text = res.text;
        D.xcss.saved = res.text;
        D.xcss.path = resolved.path;
        D.xcss.state = 'loaded';
        store.emit('text', { buffer: 'xcss', source: 'sync' });
        store.emit('doc');
      }
    }
  }

  async function exportSource() {
    const defaultDir = D.path ? pathDir(D.path) : lastSaveDir;
    const savePath = await fs.saveDialog({ kind: 'xnp', defaultName: Doc.xnpFileName(), defaultDir });
    if (!savePath) return;
    if (D.path && pathEquals(savePath, D.path)) {
      return Xen.dialogs.alert({ title: 'Cannot export over document', message: 'Use Save to write the document itself.', error: true });
    }
    const res = await fs.writeText({ path: savePath, text: D.xnp.text, eol: D.eol });
    if (res.error) {
      return Xen.dialogs.alert({ title: 'Export failed', message: res.error.message, error: true });
    }
    Xen.toast(`Exported ${pathBase(savePath)}.`, { kind: 'success' });
  }

  async function exportDiagram(format = 'svg') {
    let svgStr = '';
    const stageSvg = document.querySelector('#stage svg');
    if (stageSvg) {
      svgStr = stageSvg.outerHTML;
    }
    if (!svgStr && Xen.engine && Xen.engine.render) {
      try {
        const res = await Xen.engine.render({ xnp: D.xnp.text, xcss: D.xcss && D.xcss.text });
        if (res && res.svg) svgStr = res.svg;
      } catch (e) {}
    }

    if (!svgStr || !svgStr.includes('<svg')) {
      return Xen.dialogs.alert({
        title: 'Nothing to export',
        message: 'The current document does not have a rendered diagram to export. Ensure the diagram syntax is valid.',
        error: true,
      });
    }

    const defaultDir = D.path ? pathDir(D.path) : lastSaveDir;
    const stem = (Doc.xnpFileName() || 'diagram').replace(/\.xnp$/i, '');

    try {
      if (format === 'svg') {
        const savePath = await fs.saveDialog({ kind: 'svg', defaultName: `${stem}.svg`, defaultDir });
        if (!savePath) return;
        const res = await fs.writeText({ path: savePath, text: svgStr });
        if (res && res.error) {
          return Xen.dialogs.alert({ title: 'Export failed', message: res.error.message, error: true });
        }
        Xen.toast(`Exported ${pathBase(savePath)}.`, { kind: 'success' });
        if (Xen.backstage && Xen.backstage.isOpen && Xen.backstage.isOpen()) Xen.backstage.close();
        return;
      }

      if (format === 'png') {
        const pngDataUrl = await new Promise((resolve, reject) => {
          const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const dpi = 400;
              const scale = dpi / 96; // 400 DPI resolution scale
              const baseW = img.naturalWidth || img.width || 800;
              const baseH = img.naturalHeight || img.height || 600;
              const w = Math.max(100, Math.round(baseW * scale));
              const h = Math.max(100, Math.round(baseH * scale));
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, w, h);
              ctx.drawImage(img, 0, 0, w, h);
              URL.revokeObjectURL(url);
              resolve(canvas.toDataURL('image/png'));
            } catch (err) {
              URL.revokeObjectURL(url);
              reject(err);
            }
          };
          img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load SVG for rasterization'));
          };
          img.src = url;
        });

        const savePath = await fs.saveDialog({ kind: 'png', defaultName: `${stem}.png`, defaultDir });
        if (!savePath) return;
        const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, '');
        const res = await fs.writeText({ path: savePath, text: base64Data, encoding: 'base64' });
        if (res && res.error) {
          return Xen.dialogs.alert({ title: 'Export failed', message: res.error.message, error: true });
        }
        Xen.toast(`Exported ${pathBase(savePath)} (400 DPI).`, { kind: 'success' });
        if (Xen.backstage && Xen.backstage.isOpen && Xen.backstage.isOpen()) Xen.backstage.close();
        return;
      }

      if (format === 'pdf') {
        const resPath = await fs.exportPdf({ svg: svgStr, defaultName: `${stem}.pdf`, defaultDir });
        if (!resPath) return;
        Xen.toast(`Exported ${pathBase(resPath)}.`, { kind: 'success' });
        if (Xen.backstage && Xen.backstage.isOpen && Xen.backstage.isOpen()) Xen.backstage.close();
        return;
      }
    } catch (err) {
      Xen.dialogs.alert({ title: 'Export error', message: err.message || String(err), error: true });
    }
  }

  Xen.files = {
    confirmUnsaved,
    save,
    saveXcss,
    saveAs,
    newBlank,
    newDocument,
    openPath,
    openFiles,
    openDialog,
    exportDiagram,
    exportSource,
    resolveStylesheet,
  };

  Xen.commands.registerAll({
    'file.saveNow': save,
    'file.saveAs': saveAs,
    'file.saveAsConfirm': saveAs,
    'file.new': () => (Xen.backstage ? Xen.backstage.show('new') : newBlank()),
    'file.newBlank': newBlank,
    'file.newFrom': newDocument,
    'file.pick': openDialog,
    'file.export.do': exportDiagram,
    'file.exportSource': exportSource,
  });
})();
