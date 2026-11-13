/* Document registry service adapter. Communicates with Electron main process via Xen.native.registry. */
(function () {
  function nativeReg() {
    if (!Xen.native || !Xen.native.registry) {
      throw new Error('Native document registry bridge is unavailable. Xenapse Studio must run inside Electron.');
    }
    return Xen.native.registry;
  }

  let cachedList = null;

  async function list(opts) {
    if (!Xen.native || !Xen.native.registry) {
      return { recent: [], others: [], all: [], total: 0 };
    }
    const res = await nativeReg().list(opts);
    if (res && !res.all && (res.recent || res.others)) {
      res.all = [...(res.recent || []), ...(res.others || [])];
    }
    cachedList = res;
    return res;
  }

  async function touch(filePath, opts) {
    if (!Xen.native || !Xen.native.registry) return null;
    return nativeReg().touch(filePath, opts);
  }

  async function remove(id) {
    if (!Xen.native || !Xen.native.registry) return false;
    const ok = await nativeReg().remove(id);
    await list().catch(() => {});
    return ok;
  }

  async function removeMissing() {
    if (!Xen.native || !Xen.native.registry) return 0;
    const count = await nativeReg().removeMissing();
    await list().catch(() => {});
    return count;
  }

  function onChange(cb) {
    if (!Xen.native || !Xen.native.registry) return () => {};
    return nativeReg().onChanged(cb);
  }

  async function open(entry) {
    if (!entry || !entry.path) return;
    const res = await Xen.files.openPath(entry.path, { silentNotFound: true });
    if (res && res.error === 'ENOENT') {
      await list().catch(() => {});
      if (Xen.backstage && Xen.backstage.isOpen && Xen.backstage.isOpen()) {
        Xen.backstage.refresh();
      }
      if (Xen.welcome && Xen.welcome.isOpen && Xen.welcome.isOpen()) {
        Xen.welcome.render();
      }
      const choice = await Xen.dialogs.choose({
        title: 'File not found',
        message: `“${entry.fileName || entry.path}” could not be found. It may have been moved, renamed, or deleted.`,
        actions: [
          { id: 'remove', label: 'Remove from list', kind: 'danger' },
          { spacer: true },
          { id: 'cancel', label: 'Cancel' },
        ],
      });
      if (choice === 'remove') {
        await remove(entry.id);
        if (Xen.backstage && Xen.backstage.isOpen && Xen.backstage.isOpen()) {
          Xen.backstage.refresh();
        }
        if (Xen.welcome && Xen.welcome.isOpen && Xen.welcome.isOpen()) {
          Xen.welcome.render();
        }
      }
    }
  }

  Xen.registry = {
    list,
    touch,
    remove,
    removeMissing,
    onChange,
    open,
    getCached: () => cachedList,
  };

  // Subscribes to doc:opened and doc:saved (document path only; never register stylesheets as documents)
  Xen.store.on('doc:opened', (data) => {
    if (data && data.path) {
      touch(data.path, {
        event: 'opened',
        module: data.module || null,
        stylesheetPath: data.xcssPath || null,
      }).catch(() => {});
    }
  });

  Xen.store.on('doc:saved', (data) => {
    if (data && data.path) {
      touch(data.path, {
        event: 'saved',
        module: data.module || null,
        stylesheetPath: data.xcssPath || null,
      }).catch(() => {});
    }
  });

  // Listen for changes pushed from main
  if (Xen.native && Xen.native.registry) {
    nativeReg().onChanged(async () => {
      await list().catch(() => {});
      if (Xen.backstage && Xen.backstage.isOpen && Xen.backstage.isOpen()) {
        Xen.backstage.refresh();
      }
      if (Xen.welcome && Xen.welcome.isOpen && Xen.welcome.isOpen()) {
        Xen.welcome.render();
      }
      if (Xen.store) {
        Xen.store.emit('registry:updated');
      }
    });
  }

  Xen.commands.registerAll({
    'file.openRecent': async (id) => {
      if (!id) return;
      const res = await list();
      const all = [...(res.recent || []), ...(res.others || [])];
      const entry = all.find((e) => e.id === id);
      if (entry) {
        await open(entry);
      }
    },
    'registry.remove': async (id) => {
      if (!id) return;
      await remove(id);
      if (Xen.backstage && Xen.backstage.isOpen && Xen.backstage.isOpen()) {
        Xen.backstage.refresh();
      }
      if (Xen.welcome && Xen.welcome.isOpen && Xen.welcome.isOpen()) {
        Xen.welcome.render();
      }
    },
  });
})();
