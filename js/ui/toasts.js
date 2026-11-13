(function () {
  Xen.toast = function (message, { kind = 'info', timeout = 4200 } = {}) {
    const host = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast toast--' + kind; el.textContent = message;
    host.appendChild(el);
    while (host.children.length > 4) host.firstChild.remove();
    const kill = () => el.remove();
    setTimeout(kill, timeout);
    el.addEventListener('click', kill);
  };
})();
