'use strict';
const fs = require('fs');
const path = require('path');
const { BrowserWindow, nativeImage } = require('electron');

const MIN_MS = 2500;
const MAX_MS = 10000;

/* Startup splash screen. Displays assets/splash.png cleanly preserving aspect ratio.
   release() is called when the main window is ready; it resolves once the splash is gone. */
function createSplash(appRoot) {
  const none = { release: () => Promise.resolve(), dispose() {} };
  const file = path.join(appRoot, 'splash', 'index.html');
  const imgFile = path.join(appRoot, 'assets', 'splash.png');
  let exists = false;
  try { exists = fs.existsSync(file) || fs.existsSync(imgFile); } catch (e) { /* ignore */ }
  if (!exists) return none;

  let width = 768;
  let height = 456;
  try {
    if (fs.existsSync(imgFile)) {
      const img = nativeImage.createFromPath(imgFile);
      const size = img.getSize();
      if (size.width && size.height) {
        height = Math.round((width * size.height) / size.width);
      }
    }
  } catch (e) { /* ignore */ }

  const win = new BrowserWindow({
    width, height, useContentSize: true, frame: false, resizable: false, maximizable: false, minimizable: false,
    fullscreenable: false, center: true, show: false, skipTaskbar: true, backgroundColor: '#122133',
    webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, devTools: false },
  });

  let released = false, closed = false, shownAt = 0, timer = null, resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  const hard = setTimeout(() => finish(), MAX_MS);

  function finish() {
    if (closed) return;
    closed = true;
    clearTimeout(timer); clearTimeout(hard);
    if (!win.isDestroyed()) win.destroy();
    resolveDone();
  }
  function check() {
    if (closed || !released || !shownAt) return;
    const left = shownAt + MIN_MS - Date.now();
    if (left <= 0) finish();
    else { clearTimeout(timer); timer = setTimeout(finish, left); }
  }

  win.once('ready-to-show', () => { if (closed || win.isDestroyed()) return; shownAt = Date.now(); win.show(); check(); });
  win.on('closed', finish);
  const target = fs.existsSync(file) ? file : imgFile;
  win.loadFile(target).catch(finish);

  return { release() { released = true; check(); return done; }, dispose: finish };
}

module.exports = { createSplash };
