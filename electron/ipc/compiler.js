'use strict';
const { ipcMain, BrowserWindow } = require('electron');
const { assertTrustedSender } = require('../security');
const locator = require('../services/compiler-locator');
const runner = require('../services/compiler-runner');

function notifyStatusChanged(status) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send('xenapse:compiler:statusChanged', status);
    }
  }
}

function validateCompilePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }
  const { requestId, xnp, xcss, hasStylesheet } = payload;
  if (requestId === undefined || (typeof requestId !== 'number' && typeof requestId !== 'string')) {
    throw new Error('Invalid requestId');
  }
  if (typeof xnp !== 'string') {
    throw new Error('xnp must be a string');
  }
  if (Buffer.byteLength(xnp, 'utf8') > 2 * 1024 * 1024) {
    throw new Error('xnp text exceeds 2 MB limit');
  }
  if (xcss !== undefined && xcss !== null) {
    if (typeof xcss !== 'string') {
      throw new Error('xcss must be a string or null');
    }
    if (Buffer.byteLength(xcss, 'utf8') > 2 * 1024 * 1024) {
      throw new Error('xcss text exceeds 2 MB limit');
    }
  }
  if (typeof hasStylesheet !== 'boolean') {
    throw new Error('hasStylesheet must be a boolean');
  }
}

function register() {
  ipcMain.handle('xenapse:compiler:status', async (event) => {
    assertTrustedSender(event);
    return locator.locate();
  });

  ipcMain.handle('xenapse:compiler:recheck', async (event) => {
    assertTrustedSender(event);
    locator.invalidate();
    const status = await locator.locate();
    notifyStatusChanged(status);
    return status;
  });

  ipcMain.handle('xenapse:compiler:compile', async (event, payload) => {
    assertTrustedSender(event);
    validateCompilePayload(payload);
    const result = await runner.compile(payload);
    if (result && result.error && result.error.type === 'missing-compiler') {
      locator.invalidate();
      const status = await locator.locate();
      notifyStatusChanged(status);
    }
    return result;
  });
}

module.exports = { register, notifyStatusChanged };
