'use strict';
const { app } = require('electron');

const TRUSTED_PREFIX = 'app://studio/';

/* Locks down navigation, window creation, webviews and permissions. */
function installSecurity(session) {
  session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);

  const harden = (contents) => {
    contents.on('will-navigate', (event, url) => {
      if (!String(url).startsWith(TRUSTED_PREFIX)) event.preventDefault();
    });
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  };
  app.on('web-contents-created', (_e, contents) => harden(contents));
}

/* Every IPC handler must call this first. */
function assertTrustedSender(event) {
  const url = event && event.senderFrame && event.senderFrame.url;
  if (typeof url !== 'string' || !url.startsWith(TRUSTED_PREFIX)) {
    throw new Error('Untrusted IPC sender');
  }
}

module.exports = { installSecurity, assertTrustedSender, TRUSTED_PREFIX };
