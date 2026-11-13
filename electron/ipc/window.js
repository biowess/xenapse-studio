'use strict';
const { BrowserWindow, ipcMain } = require('electron');
const { assertTrustedSender } = require('../security');

const STATE_CHANNEL = 'xenapse:window:state';

const stateOf = (win) => ({ maximized: win.isMaximized(), fullscreen: win.isFullScreen(), focused: win.isFocused() });

/* Every handler acts on the window that owns the sender. */
function windowOf(event) {
  assertTrustedSender(event);
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) throw new Error('No owning window');
  return win;
}

function register() {
  ipcMain.handle('xenapse:window:minimize', (event) => { windowOf(event).minimize(); });
  ipcMain.handle('xenapse:window:toggleMaximize', (event) => {
    const win = windowOf(event);
    if (win.isFullScreen()) return stateOf(win);
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
    return stateOf(win);
  });
  ipcMain.handle('xenapse:window:close', (event) => { windowOf(event).close(); });
  ipcMain.handle('xenapse:window:getState', (event) => stateOf(windowOf(event)));
  ipcMain.handle('xenapse:window:confirmClose', (event) => {
    const win = windowOf(event);
    win._forceClose = true;
    win.close();
  });
  ipcMain.handle('xenapse:window:closeRequestedAck', (event) => {
    const win = windowOf(event);
    if (win._closeHungTimer) {
      clearTimeout(win._closeHungTimer);
      win._closeHungTimer = null;
    }
  });
}

/* Pushes state changes (including ones made outside the app: snap, keyboard) to the renderer. */
function attach(win) {
  const push = () => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send(STATE_CHANNEL, stateOf(win));
  };
  ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'focus', 'blur'].forEach((ev) => win.on(ev, push));
}

module.exports = { register, attach };
