'use strict';
const { shell, ipcMain } = require('electron');
const { assertTrustedSender } = require('../security');

function register() {
  ipcMain.handle('xenapse:shell:openExternal', async (event, url) => {
    assertTrustedSender(event);
    let parsed;
    try { parsed = new URL(String(url)); } catch (e) { throw new Error('Invalid URL'); }
    if (parsed.protocol !== 'https:') throw new Error('Only https: URLs can be opened');
    await shell.openExternal(parsed.href);
  });
}

module.exports = { register };
