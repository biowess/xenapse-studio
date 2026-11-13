'use strict';
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { assertTrustedSender } = require('../security');
const pathGrants = require('../services/path-grants');
const { readJson, writeJson } = require('../services/atomic-json');
const recovery = require('../services/recovery');

const uiStateFile = () => path.join(app.getPath('userData'), 'ui-state.json');

const FILTERS = {
  xnp: [{ name: 'Xenapse documents (*.xnp)', extensions: ['xnp'] }],
  xcss: [{ name: 'XCSS stylesheets (*.xcss)', extensions: ['xcss'] }],
  svg: [{ name: 'SVG images (*.svg)', extensions: ['svg'] }],
  png: [{ name: 'PNG images (*.png)', extensions: ['png'] }],
  pdf: [{ name: 'PDF documents (*.pdf)', extensions: ['pdf'] }],
};

function windowOf(event) {
  assertTrustedSender(event);
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) throw new Error('No owning window');
  return win;
}

function parseXnpArgs(argv) {
  if (!Array.isArray(argv)) return [];
  const results = [];
  for (const arg of argv) {
    if (typeof arg !== 'string' || arg.startsWith('-')) continue;
    if (/\.xnp$/i.test(arg)) {
      try {
        const resolved = path.resolve(arg);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          results.push(resolved);
        }
      } catch (e) {}
    }
  }
  return results;
}

function register() {
  ipcMain.handle('xenapse:files:openDocumentDialog', async (event) => {
    const win = windowOf(event);
    const uiState = await readJson(uiStateFile(), {});
    const defaultPath = uiState.lastOpenDir || app.getPath('documents');
    const res = await dialog.showOpenDialog(win, {
      defaultPath,
      filters: FILTERS.xnp,
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths.length) return null;
    const chosen = res.filePaths[0];
    await writeJson(uiStateFile(), { ...uiState, lastOpenDir: path.dirname(chosen) });
    pathGrants.grant(chosen);
    return chosen;
  });

  ipcMain.handle('xenapse:files:openStylesheetDialog', async (event, opts = {}) => {
    const win = windowOf(event);
    const uiState = await readJson(uiStateFile(), {});
    const defaultPath = opts.defaultDir || uiState.lastOpenDir || app.getPath('documents');
    const res = await dialog.showOpenDialog(win, {
      defaultPath,
      filters: FILTERS.xcss,
      properties: ['openFile'],
    });
    if (res.canceled || !res.filePaths.length) return null;
    const chosen = res.filePaths[0];
    pathGrants.grant(chosen);
    return chosen;
  });

  ipcMain.handle('xenapse:files:saveDialog', async (event, opts = {}) => {
    const win = windowOf(event);
    const kind = opts.kind || 'xnp';
    const filters = FILTERS[kind] || FILTERS.xnp;
    const defaultName = opts.defaultName || (kind === 'xnp' ? 'untitled.xnp' : `untitled.${kind}`);
    const defaultPath = path.join(opts.defaultDir || app.getPath('documents'), defaultName);
    const res = await dialog.showSaveDialog(win, { defaultPath, filters });
    if (res.canceled || !res.filePath) return null;
    let filePath = res.filePath;
    const ext = '.' + kind;
    if (!filePath.toLowerCase().endsWith(ext.toLowerCase())) filePath += ext;
    pathGrants.grant(filePath);
    return filePath;
  });

  ipcMain.handle('xenapse:files:readText', async (event, filePath) => {
    assertTrustedSender(event);
    if (!pathGrants.isGranted(filePath)) {
      return { error: { code: 'NOT_GRANTED', message: `Access to “${path.basename(filePath)}” was not granted.` } };
    }
    let st;
    try {
      st = await fs.promises.stat(filePath);
    } catch (err) {
      const code = err.code === 'ENOENT' ? 'ENOENT' : err.code === 'EACCES' ? 'EACCES' : 'ERROR';
      return { error: { code, message: err.message } };
    }
    if (st.isDirectory()) {
      return { error: { code: 'EISDIR', message: `“${path.basename(filePath)}” is a directory.` } };
    }
    if (!st.isFile()) {
      return { error: { code: 'ENOENT', message: `“${path.basename(filePath)}” is not a regular file.` } };
    }
    if (st.size > 2 * 1024 * 1024) {
      return { error: { code: 'TOO_LARGE', message: `“${path.basename(filePath)}” is larger than 2 MB, which is not a plausible Xenapse source file.` } };
    }

    let buf;
    try {
      buf = await fs.promises.readFile(filePath);
    } catch (err) {
      return { error: { code: err.code === 'EACCES' ? 'EACCES' : 'ERROR', message: err.message } };
    }

    let hadBom = false;
    if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
      hadBom = true;
      buf = buf.subarray(3);
    }

    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch (err) {
      return { error: { code: 'BAD_ENCODING', message: `“${path.basename(filePath)}” contains invalid UTF-8.` } };
    }

    if (text.includes('\u0000')) {
      return { error: { code: 'BINARY', message: `“${path.basename(filePath)}” appears to be a binary file, not text.` } };
    }

    const crlfMatches = text.match(/\r\n/g);
    const crlfCount = crlfMatches ? crlfMatches.length : 0;
    const lfMatches = text.match(/\n/g);
    const totalLf = lfMatches ? lfMatches.length : 0;
    const lfOnlyCount = totalLf - crlfCount;
    const dominantEol = crlfCount > lfOnlyCount ? 'crlf' : 'lf';
    const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    return {
      text: normalised,
      eol: dominantEol,
      hadBom,
      size: st.size,
      mtimeMs: st.mtimeMs,
    };
  });

  ipcMain.handle('xenapse:files:writeText', async (event, { path: targetPath, text, eol, expectedMtimeMs, encoding }) => {
    assertTrustedSender(event);
    if (!pathGrants.isGranted(targetPath)) {
      return { error: { code: 'NOT_GRANTED', message: `Access to “${path.basename(targetPath)}” was not granted.` } };
    }
    if (expectedMtimeMs != null) {
      try {
        const st = await fs.promises.stat(targetPath);
        if (Math.abs(st.mtimeMs - expectedMtimeMs) > 1) {
          return { conflict: true, mtimeMs: st.mtimeMs };
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          return { error: { code: err.code, message: err.message } };
        }
      }
    }

    const dir = path.dirname(targetPath);
    try {
      await fs.promises.mkdir(dir, { recursive: true });
      const tmp = path.join(dir, `.${path.basename(targetPath)}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
      const fh = await fs.promises.open(tmp, 'w');
      try {
        if (encoding === 'base64') {
          let buf = Buffer.from(text, 'base64');
          if (targetPath.toLowerCase().endsWith('.png') && buf.length > 33 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
            // 400 DPI pHYs chunk: 15748 pixels/meter
            const phys = Buffer.from('000000097048797300003d8400003d8401533020a3', 'hex');
            buf = Buffer.concat([buf.subarray(0, 33), phys, buf.subarray(33)]);
          }
          await fh.writeFile(buf);
        } else {
          const out = (eol === 'crlf') ? text.replace(/\r?\n/g, '\r\n') : text.replace(/\r?\n/g, '\n');
          await fh.writeFile(out, 'utf8');
        }
        await fh.sync();
      } finally {
        await fh.close();
      }
      try {
        await fs.promises.rename(tmp, targetPath);
      } catch (renameErr) {
        if (renameErr.code === 'EXDEV') {
          await fs.promises.copyFile(tmp, targetPath);
          await fs.promises.unlink(tmp);
        } else {
          await fs.promises.unlink(tmp).catch(() => {});
          throw renameErr;
        }
      }
      const st = await fs.promises.stat(targetPath);
      return { mtimeMs: st.mtimeMs, size: st.size };
    } catch (err) {
      return { error: { code: err.code || 'ERROR', message: err.message } };
    }
  });

  ipcMain.handle('xenapse:files:stat', async (event, filePath) => {
    assertTrustedSender(event);
    if (!pathGrants.isGranted(filePath)) {
      return { exists: false, isFile: false, size: 0, mtimeMs: 0 };
    }
    try {
      const st = await fs.promises.stat(filePath);
      return { exists: true, isFile: st.isFile(), size: st.size, mtimeMs: st.mtimeMs };
    } catch (err) {
      return { exists: false, isFile: false, size: 0, mtimeMs: 0 };
    }
  });

  ipcMain.handle('xenapse:files:resolveStylesheet', async (event, { docPath, declared }) => {
    assertTrustedSender(event);
    if (!pathGrants.isGranted(docPath)) {
      throw new Error(`Doc path not granted: ${docPath}`);
    }
    const resolved = path.resolve(path.dirname(docPath), declared);
    pathGrants.grant(resolved);
    let exists = false;
    try {
      exists = fs.existsSync(resolved) && fs.statSync(resolved).isFile();
    } catch (e) {}
    return { path: resolved, exists };
  });

  ipcMain.handle('xenapse:files:relativePath', (event, { fromDocPath, toPath }) => {
    assertTrustedSender(event);
    const fromDir = path.dirname(fromDocPath);
    const rel = path.relative(fromDir, toPath);
    if (path.isAbsolute(rel)) return toPath.replace(/\\/g, '/');
    return rel.replace(/\\/g, '/');
  });

  ipcMain.handle('xenapse:files:suggestName', (event, opts = {}) => {
    assertTrustedSender(event);
    const kind = opts.kind || 'xnp';
    const base = opts.base || 'untitled';
    const dir = opts.dir || app.getPath('documents');
    let candidate = `${base}.${kind}`;
    let counter = 2;
    while (fs.existsSync(path.join(dir, candidate))) {
      candidate = `${base}-${counter}.${kind}`;
      counter++;
    }
    return candidate;
  });

  ipcMain.handle('xenapse:files:showInFolder', (event, filePath) => {
    assertTrustedSender(event);
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('xenapse:files:grantDropped', (event, paths) => {
    assertTrustedSender(event);
    if (!Array.isArray(paths)) return [];
    const grantedList = [];
    for (const p of paths) {
      if (typeof p === 'string' && /\.(xnp|xcss)$/i.test(p)) {
        grantedList.push(pathGrants.grant(p));
      }
    }
    return grantedList;
  });

  ipcMain.handle('xenapse:files:getLaunchFiles', (event) => {
    assertTrustedSender(event);
    const files = parseXnpArgs(process.argv);
    files.forEach((f) => pathGrants.grant(f));
    return files;
  });

  ipcMain.handle('xenapse:files:readRecovery', async (event) => {
    assertTrustedSender(event);
    return recovery.readRecovery();
  });

  ipcMain.handle('xenapse:files:writeRecovery', async (event, snapshot) => {
    assertTrustedSender(event);
    return recovery.writeRecovery(snapshot);
  });

  ipcMain.handle('xenapse:files:clearRecovery', async (event) => {
    assertTrustedSender(event);
    return recovery.clearRecovery();
  });

  function parseSvgDimensions(svg) {
    if (!svg || typeof svg !== 'string') return { width: 800, height: 600 };
    const rootMatch = /<svg\b([^>]*)>/i.exec(svg);
    if (!rootMatch) return { width: 800, height: 600 };
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
      width: (typeof width === 'number' && !isNaN(width) && width > 0) ? width : 800,
      height: (typeof height === 'number' && !isNaN(height) && height > 0) ? height : 600,
    };
  }

  ipcMain.handle('xenapse:files:exportPdf', async (event, { svg, defaultName, defaultDir }) => {
    assertTrustedSender(event);
    const win = windowOf(event);
    const saveRes = await dialog.showSaveDialog(win, {
      defaultPath: path.join(defaultDir || app.getPath('documents'), defaultName || 'diagram.pdf'),
      filters: FILTERS.pdf,
    });
    if (saveRes.canceled || !saveRes.filePath) return null;
    let filePath = saveRes.filePath;
    if (!filePath.toLowerCase().endsWith('.pdf')) filePath += '.pdf';

    const dims = parseSvgDimensions(svg);
    const pad = 24;
    const pageWidth = Math.round(dims.width + pad * 2);
    const pageHeight = Math.round(dims.height + pad * 2);

    const pdfWin = new BrowserWindow({
      show: false,
      width: Math.max(400, pageWidth),
      height: Math.max(300, pageHeight),
      webPreferences: { offscreen: true }
    });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      @page {
        size: ${pageWidth}px ${pageHeight}px;
        margin: 0;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: ${pageWidth}px;
        height: ${pageHeight}px;
        background: #ffffff;
        overflow: hidden;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: ${pad}px;
      }
      svg {
        width: ${dims.width}px !important;
        height: ${dims.height}px !important;
        max-width: none !important;
        max-height: none !important;
        display: block;
      }
    </style></head><body>${svg}</body></html>`;

    try {
      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const data = await pdfWin.webContents.printToPDF({
        preferCSSPageSize: true,
        printBackground: true,
        margins: { marginType: 'none' },
      });
      await fs.promises.writeFile(filePath, data);
      pathGrants.grant(filePath);
      return filePath;
    } finally {
      pdfWin.destroy();
    }
  });
}

module.exports = { register, parseXnpArgs };
