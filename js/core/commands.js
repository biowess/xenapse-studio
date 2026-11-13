/* Command registry. Menus, shortcuts and [data-cmd] buttons all go through here. */
(function () {
  const reg = {};
  Xen.commands = {
    register(id, fn) { reg[id] = fn; },
    registerAll(map) { Object.assign(reg, map); },
    has: (id) => !!reg[id],
    run(id, arg) {
      if (!reg[id]) { Xen.toast && Xen.toast('That command is not available in this prototype.', { kind: 'warn' }); return; }
      return reg[id](arg);
    },
    execute(id, arg) { return this.run(id, arg); },
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-cmd]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    Xen.commands.run(el.dataset.cmd, el.dataset.arg);
  });
})();
