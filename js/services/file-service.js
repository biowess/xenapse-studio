/* Native file service adapter. Communicates with Electron main process via Xen.native.files. */
(function () {
  function nativeFiles() {
    if (!Xen.native || !Xen.native.files) {
      throw new Error('Native file system bridge is unavailable. Xenapse Studio must run inside Electron.');
    }
    return Xen.native.files;
  }

  Xen.fileService = {
    capabilities: { nativeFilesystem: true },
    openDocumentDialog: () => nativeFiles().openDocumentDialog(),
    openStylesheetDialog: (opts) => nativeFiles().openStylesheetDialog(opts),
    saveDialog: (opts) => nativeFiles().saveDialog(opts),
    readText: (path) => nativeFiles().readText(path),
    writeText: (opts) => nativeFiles().writeText(opts),
    stat: (path) => nativeFiles().stat(path),
    resolveStylesheet: (opts) => nativeFiles().resolveStylesheet(opts),
    relativePath: (opts) => nativeFiles().relativePath(opts),
    suggestName: (opts) => nativeFiles().suggestName(opts),
    showInFolder: (path) => nativeFiles().showInFolder(path),
    grantDropped: (paths) => nativeFiles().grantDropped(paths),
    getLaunchFiles: () => nativeFiles().getLaunchFiles(),
    readRecovery: () => nativeFiles().readRecovery(),
    writeRecovery: (snapshot) => nativeFiles().writeRecovery(snapshot),
    clearRecovery: () => nativeFiles().clearRecovery(),
    exportPdf: (opts) => nativeFiles().exportPdf(opts),
  };
})();
