'use strict';
const { app, ipcMain } = require('electron');
const { assertTrustedSender } = require('../security');

function register() {
  ipcMain.handle('xenapse:app:getInfo', (event) => {
    assertTrustedSender(event);
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      packaged: app.isPackaged,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
    };
  });

  ipcMain.handle('xenapse:app:quit', (event) => {
    assertTrustedSender(event);
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
    } else {
      app.quit();
    }
  });

  ipcMain.handle('xenapse:app:getDoc', async (event, docName) => {
    assertTrustedSender(event);
    const fs = require('fs');
    const path = require('path');
    const clean = path.basename(String(docName || ''));
    if (!clean.endsWith('.md')) return null;
    const target = path.join(app.getAppPath(), 'docs', clean);
    try {
      return await fs.promises.readFile(target, 'utf8');
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('xenapse:app:getLegal', async (event, name) => {
    assertTrustedSender(event);
    const fs = require('fs');
    const path = require('path');
    const allowed = new Set(['LICENSE', 'NOTICE', 'TRADEMARK.md']);
    const clean = path.basename(String(name || ''));
    if (!allowed.has(clean)) return null;
    const target = path.join(app.getAppPath(), clean);
    try {
      return await fs.promises.readFile(target, 'utf8');
    } catch (e) {
      return null;
    }
  });
}

module.exports = { register };
