/* Global keyboard shortcuts. Editor-local keys (Tab, Enter, Undo/Redo) live in editor.js. */
(function () {
  const list = [
    { keys: 'Mod+S', cmd: 'file.saveNow', label: 'Save', group: 'File' },
    { keys: 'Mod+Shift+S', cmd: 'file.saveAs', label: 'Save As…', group: 'File' },
    { keys: 'Mod+O', cmd: 'file.open', label: 'Open…', group: 'File' },
    { keys: 'Alt+N', cmd: 'file.new', label: 'New', group: 'File' },
    { keys: 'Mod+E', cmd: 'file.export', label: 'Export', group: 'File' },
    { keys: 'Mod+,', cmd: 'file.preferences', label: 'Preferences', group: 'File' },
    { keys: 'Mod+Z', label: 'Undo', group: 'Edit', local: true }, { keys: 'Mod+Y', label: 'Redo', group: 'Edit', local: true },
    { keys: 'Mod+F', cmd: 'edit.find', label: 'Find', group: 'Edit' }, { keys: 'Mod+H', cmd: 'edit.replace', label: 'Replace', group: 'Edit' },
    { keys: 'Tab', label: 'Indent', group: 'Edit', local: true }, { keys: 'Shift+Tab', label: 'Outdent', group: 'Edit', local: true },
    { keys: 'Mod+=', cmd: 'zoom.in', label: 'Zoom in', group: 'View' }, { keys: 'Mod+-', cmd: 'zoom.out', label: 'Zoom out', group: 'View' },
    { keys: 'Mod+0', cmd: 'zoom.fit', label: 'Fit preview', group: 'View' }, { keys: 'Mod+1', cmd: 'zoom.actual', label: 'Actual size', group: 'View' },
    { keys: 'Alt+Shift+T', cmd: 'theme.toggle', label: 'Toggle light / dark', group: 'View' },
    { keys: 'F1', cmd: 'help.shortcuts', label: 'Keyboard shortcuts', group: 'Help' },
    { keys: 'Escape', label: 'Close menu, find bar or File view', group: 'General', local: true },
  ];
  const norm = (k) => k.replace('Mod', 'Ctrl');
  function combo(e) {
    let key = e.key; if (key === '+') key = '='; if (key.length === 1) key = key.toUpperCase();
    const parts = []; if (e.ctrlKey || e.metaKey) parts.push('Ctrl'); if (e.altKey) parts.push('Alt'); if (e.shiftKey && !(e.key === '+' )) parts.push('Shift');
    return parts.concat(key === ' ' ? 'Space' : key).join('+');
  }
  const map = {}; list.forEach((s) => { if (s.cmd) map[norm(s.keys).toUpperCase()] = s.cmd; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (Xen.menus.isOpen()) return; if (Xen.backstage.isOpen() && !document.querySelector('dialog[open]')) { Xen.backstage.close(); } return; }
    const cmd = map[combo(e).toUpperCase()]; if (!cmd) return;
    e.preventDefault(); Xen.commands.run(cmd);
  });
  Xen.shortcuts = { list };
})();
