/* Native bridge. window.xenapseNative is exposed by electron/preload.js (null in a plain browser). */
(function () {
  Xen.native = window.xenapseNative || null;
  Xen.platform = { isElectron: !!Xen.native, os: Xen.native ? Xen.native.platform : 'web' };
})();
