'use strict';
const path = require('path');
const { app, BrowserWindow, Menu, protocol, session } = require('electron');
const { SCHEME, HOST, installProtocol } = require('./protocol');
const { installSecurity } = require('./security');
const windowState = require('./window-state');
const { createSplash } = require('./splash');

const IS_DEV = process.argv.includes('--dev');
const APP_ROOT = app.getAppPath(); /* works from an ASAR archive */

app.setName('Xenapse Studio');
if (process.platform === 'win32') app.setAppUserModelId('com.biowess.xenapse-studio');

/* Must run before app is ready. */
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow = null;

function createWindow() {
  const splash = createSplash(APP_ROOT);
  const saved = windowState.resolve();
  mainWindow = new BrowserWindow({
    ...saved.bounds,
    minWidth: windowState.MIN_W,
    minHeight: windowState.MIN_H,
    frame: false, /* custom top bar in the renderer; native resizing is kept */
    show: false,
    backgroundColor: '#F2F0EB',
    icon: path.join(APP_ROOT, 'assets', 'brand', 'icon-linux.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged || IS_DEV,
    },
  });
  const win = mainWindow;

  windowState.attach(win, saved);
  require('./ipc/window').attach(win);

  win.on('close', (event) => {
    if (win._forceClose) return;
    event.preventDefault();
    if (win.webContents.isDestroyed() || win.webContents.isCrashed()) {
      win._forceClose = true;
      win.close();
      return;
    }
    win.webContents.send('xenapse:window:closeRequested');
    if (win._closeHungTimer) clearTimeout(win._closeHungTimer);
    win._closeHungTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win._forceClose = true;
        win.close();
      }
    }, 5000);
  });
  win.on('unresponsive', () => {
    if (win._closeHungTimer) clearTimeout(win._closeHungTimer);
    win._forceClose = true;
    win.close();
  });

  win.once('ready-to-show', () => {
    splash.release().then(() => {
      if (win.isDestroyed()) return;
      if (saved.maximized) win.maximize();
      win.show();
    });
  });
  win.on('closed', () => { splash.dispose(); mainWindow = null; });
  win.loadURL(`${SCHEME}://${HOST}/index.html`);
  if (IS_DEV) win.webContents.openDevTools({ mode: 'detached' });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    const { parseXnpArgs } = require('./ipc/files');
    const pathGrants = require('./services/path-grants');
    const files = parseXnpArgs(argv);
    if (files.length && !mainWindow.webContents.isDestroyed()) {
      pathGrants.grant(files[0]);
      mainWindow.webContents.send('xenapse:files:openRequested', files[0]);
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null); /* menus live in the renderer */
    const ses = session.defaultSession;
    installProtocol(ses, APP_ROOT);
    installSecurity(ses);
    require('./ipc/app').register();
    require('./ipc/shell').register();
    require('./ipc/window').register();
    require('./ipc/files').register();
    require('./ipc/registry').register();
    require('./ipc/compiler').register();
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
