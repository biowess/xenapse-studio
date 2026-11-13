'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

/* Only channels named xenapse:<group>:<method> may be invoked. */
function invoke(channel, ...args) {
  if (typeof channel !== 'string' || !channel.startsWith('xenapse:')) {
    return Promise.reject(new Error('Blocked IPC channel'));
  }
  return ipcRenderer.invoke(channel, ...args);
}

/* Groups are added by later prompts. */
const api = Object.freeze({
  platform: process.platform,
  app: Object.freeze({
    getInfo: () => invoke('xenapse:app:getInfo'),
    quit: () => invoke('xenapse:app:quit'),
    getDoc: (docName) => invoke('xenapse:app:getDoc', String(docName)),
    getLegal: (name) => invoke('xenapse:app:getLegal', String(name)),
  }),
  shell: Object.freeze({
    openExternal: (url) => invoke('xenapse:shell:openExternal', String(url)),
  }),
  window: Object.freeze({
    minimize: () => invoke('xenapse:window:minimize'),
    toggleMaximize: () => invoke('xenapse:window:toggleMaximize'),
    close: () => invoke('xenapse:window:close'),
    getState: () => invoke('xenapse:window:getState'),
    confirmClose: () => invoke('xenapse:window:confirmClose'),
    onCloseRequested: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const handler = () => {
        invoke('xenapse:window:closeRequestedAck').catch(() => {});
        cb();
      };
      ipcRenderer.on('xenapse:window:closeRequested', handler);
      return () => ipcRenderer.removeListener('xenapse:window:closeRequested', handler);
    },
    /* Returns an unsubscribe function; the raw IPC event is never exposed. */
    onStateChange: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const handler = (_event, s) => cb({ maximized: !!(s && s.maximized), fullscreen: !!(s && s.fullscreen), focused: !!(s && s.focused) });
      ipcRenderer.on('xenapse:window:state', handler);
      return () => ipcRenderer.removeListener('xenapse:window:state', handler);
    },
  }),
  files: Object.freeze({
    openDocumentDialog: () => invoke('xenapse:files:openDocumentDialog'),
    openStylesheetDialog: (opts) => invoke('xenapse:files:openStylesheetDialog', opts),
    saveDialog: (opts) => invoke('xenapse:files:saveDialog', opts),
    readText: (path) => invoke('xenapse:files:readText', String(path)),
    writeText: (opts) => invoke('xenapse:files:writeText', opts),
    stat: (path) => invoke('xenapse:files:stat', String(path)),
    resolveStylesheet: (opts) => invoke('xenapse:files:resolveStylesheet', opts),
    relativePath: (opts) => invoke('xenapse:files:relativePath', opts),
    suggestName: (opts) => invoke('xenapse:files:suggestName', opts),
    showInFolder: (path) => invoke('xenapse:files:showInFolder', String(path)),
    grantDropped: (paths) => invoke('xenapse:files:grantDropped', paths),
    getLaunchFiles: () => invoke('xenapse:files:getLaunchFiles'),
    readRecovery: () => invoke('xenapse:files:readRecovery'),
    writeRecovery: (snapshot) => invoke('xenapse:files:writeRecovery', snapshot),
    clearRecovery: () => invoke('xenapse:files:clearRecovery'),
    exportPdf: (opts) => invoke('xenapse:files:exportPdf', opts),
    getPathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file);
      } catch (e) {
        return '';
      }
    },
    onOpenRequested: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const handler = (_event, filePath) => cb(filePath);
      ipcRenderer.on('xenapse:files:openRequested', handler);
      return () => ipcRenderer.removeListener('xenapse:files:openRequested', handler);
    },
  }),
  registry: Object.freeze({
    list: (opts) => invoke('xenapse:registry:list', opts),
    touch: (pathOrOpts, opts) => invoke('xenapse:registry:touch', pathOrOpts, opts),
    remove: (id) => invoke('xenapse:registry:remove', String(id)),
    removeMissing: () => invoke('xenapse:registry:removeMissing'),
    onChanged: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const handler = () => cb();
      ipcRenderer.on('xenapse:registry:changed', handler);
      return () => ipcRenderer.removeListener('xenapse:registry:changed', handler);
    },
  }),
  compiler: Object.freeze({
    status: () => invoke('xenapse:compiler:status'),
    recheck: () => invoke('xenapse:compiler:recheck'),
    compile: (payload) => invoke('xenapse:compiler:compile', payload),
    onStatusChanged: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const handler = (_event, s) => cb(s);
      ipcRenderer.on('xenapse:compiler:statusChanged', handler);
      return () => ipcRenderer.removeListener('xenapse:compiler:statusChanged', handler);
    },
  }),
});

contextBridge.exposeInMainWorld('xenapseNative', api);
