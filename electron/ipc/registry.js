'use strict';
const { ipcMain, BrowserWindow } = require('electron');
const { assertTrustedSender } = require('../security');
const documentRegistry = require('../services/document-registry');

function notifyChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send('xenapse:registry:changed');
    }
  }
}

function register() {
  documentRegistry.setNotifier(notifyChanged);

  ipcMain.handle('xenapse:registry:list', async (event, opts) => {
    assertTrustedSender(event);
    const options = opts && typeof opts === 'object' ? opts : {};
    const recentLimit = typeof options.recentLimit === 'number' && options.recentLimit > 0 ? options.recentLimit : 5;
    return documentRegistry.list({ recentLimit });
  });

  ipcMain.handle('xenapse:registry:touch', async (event, pathOrOpts, maybeOpts) => {
    assertTrustedSender(event);
    let filePath = '';
    let opts = {};
    if (typeof pathOrOpts === 'string') {
      filePath = pathOrOpts;
      opts = maybeOpts && typeof maybeOpts === 'object' ? maybeOpts : {};
    } else if (pathOrOpts && typeof pathOrOpts === 'object') {
      filePath = pathOrOpts.path;
      opts = pathOrOpts;
    }
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Invalid path for touch');
    }
    return documentRegistry.touch(filePath, opts);
  });

  ipcMain.handle('xenapse:registry:remove', async (event, id) => {
    assertTrustedSender(event);
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Invalid id for remove');
    }
    return documentRegistry.remove(id.trim());
  });

  ipcMain.handle('xenapse:registry:removeMissing', async (event) => {
    assertTrustedSender(event);
    return documentRegistry.removeMissing();
  });
}

module.exports = { register };
