/* Dependency overlay: blocking dialog when Xenapse Language is missing or unusable. */
(function () {
  const { util } = Xen;
  const { esc, $ } = util;

  const INERT_SELECTORS = ['#workspace', '#statusbar', '#menubar', '#welcome', '#topbar', '#dialog-root'];
  let overlayEl = null;
  let keyHandlerAttached = false;
  let lastRecheck = 0;

  function closeApp() {
    if (Xen.native && Xen.native.window) {
      Xen.native.window.confirmClose();
    } else if (Xen.native && Xen.native.app) {
      Xen.native.app.quit();
    } else {
      window.close();
    }
  }

  function getReleasesUrl(status) {
    return (status && status.releasesUrl) || 'https://github.com/biowess/xenapse/releases';
  }

  function getMinVersion(status) {
    return (status && status.minVersion) || '0.1.0';
  }

  function formatReason(status) {
    if (!status || !status.path) return '';
    const p = status.path;
    const r = status.reason || '';
    const minV = getMinVersion(status);

    if (r.startsWith('version-too-old')) {
      const v = status.version || r.split(':')[1]?.trim() || 'older';
      return `<p class="dep-reason">Found at <code>${esc(p)}</code>, but version ${esc(v)} is older than the required ${esc(minV)}.</p>`;
    }
    if (r === 'not-executable') {
      return `<p class="dep-reason">Found at <code>${esc(p)}</code>, but the file is not executable.</p>`;
    }
    if (r === 'version-unreadable') {
      return `<p class="dep-reason">Found at <code>${esc(p)}</code>, but its version could not be determined.</p>`;
    }
    if (r === 'smoke-test-failed') {
      return `<p class="dep-reason">Found at <code>${esc(p)}</code>, but smoke testing the compiler failed.</p>`;
    }
    return `<p class="dep-reason">Found at <code>${esc(p)}</code>, but it could not be used (${esc(r)}).</p>`;
  }

  function trapKeydown(e) {
    if (!overlayEl || overlayEl.hidden) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeApp();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = Array.from(overlayEl.querySelectorAll('button:not([disabled]), a[href]:not([disabled])'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function setInert(inert) {
    for (const sel of INERT_SELECTORS) {
      const el = $(sel);
      if (el) {
        if (inert) {
          el.setAttribute('inert', '');
        } else {
          el.removeAttribute('inert');
        }
      }
    }
  }

  function renderCard(status) {
    const reasonHtml = formatReason(status);
    const releasesUrl = getReleasesUrl(status);
    return `
      <div class="dep-card" role="dialog" aria-modal="true" aria-labelledby="dep-title" aria-describedby="dep-desc">
        <div class="dep-card__head">
          <div class="dep-card__title-row">
            <span class="dep-card__icon" aria-hidden="true"><i data-icon="alert-circle"></i></span>
            <h2 id="dep-title">Xenapse Language Required</h2>
          </div>
          <button class="dep-card__close" id="dep-btn-close" aria-label="Close and exit application" title="Close"><i data-icon="x"></i></button>
        </div>
        <div class="dep-card__body" id="dep-desc">
          <p>Xenapse Studio requires the <strong>Xenapse Language</strong> compiler to function.</p>
          <p>You must install Xenapse for it to work. Download the latest release from:<br>
            <a href="${esc(releasesUrl)}" id="dep-link-releases" class="dep-link" target="_blank" rel="noopener noreferrer">${esc(releasesUrl)}</a>
          </p>
          ${reasonHtml}
        </div>
        <div class="dep-card__foot">
          <button class="btn" id="dep-btn-cancel">Cancel</button>
          <button class="btn btn--primary" id="dep-btn-download">Download Xenapse</button>
        </div>
      </div>
    `;
  }

  function openReleasesUrl() {
    const status = Xen.compiler ? Xen.compiler.status() : null;
    const url = getReleasesUrl(status);
    if (Xen.native && Xen.native.shell) {
      Xen.native.shell.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function attachEvents() {
    const btnClose = $('#dep-btn-close');
    const btnCancel = $('#dep-btn-cancel');
    const btnDownload = $('#dep-btn-download');
    const linkReleases = $('#dep-link-releases');

    if (btnClose) btnClose.addEventListener('click', closeApp);
    if (btnCancel) btnCancel.addEventListener('click', closeApp);
    if (btnDownload) btnDownload.addEventListener('click', openReleasesUrl);
    if (linkReleases) {
      linkReleases.addEventListener('click', (e) => {
        e.preventDefault();
        openReleasesUrl();
      });
    }

    if (overlayEl) {
      overlayEl.onclick = (e) => { if (e.target === overlayEl) { e.preventDefault(); e.stopPropagation(); } };
      overlayEl.onmousedown = (e) => { if (e.target === overlayEl) { e.preventDefault(); e.stopPropagation(); } };
    }

    if (Xen.icons) Xen.icons.hydrate(overlayEl);

    if (!keyHandlerAttached) {
      window.addEventListener('keydown', trapKeydown, true);
      keyHandlerAttached = true;
    }
  }

  async function recheck() {
    if (!overlayEl || overlayEl.hidden) return;
    const now = Date.now();
    if (now - lastRecheck < 1000) return;
    lastRecheck = now;

    if (!Xen.compiler) return;
    const status = await Xen.compiler.recheck();
    if (status && status.usable) {
      hide();
      Xen.toast(`Xenapse Language ${status.version} detected.`);
      if (Xen.preview && typeof Xen.preview.render === 'function') {
        Xen.preview.render();
      }
    } else {
      updateContent(status);
    }
  }

  function updateContent(status) {
    if (!overlayEl) return;
    overlayEl.innerHTML = renderCard(status);
    attachEvents();
  }

  function show() {
    const status = Xen.compiler ? Xen.compiler.status() : null;
    if (status && status.usable) return;

    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.id = 'dep-overlay';
      overlayEl.className = 'dep-overlay';
      overlayEl.setAttribute('role', 'alertdialog');
      overlayEl.setAttribute('aria-modal', 'true');
      overlayEl.setAttribute('aria-labelledby', 'dep-title');
      overlayEl.setAttribute('aria-describedby', 'dep-desc');
      const appContainer = $('#app') || document.body;
      appContainer.appendChild(overlayEl);
    }

    overlayEl.innerHTML = renderCard(status);
    overlayEl.hidden = false;
    setInert(true);
    attachEvents();

    const downloadBtn = $('#dep-btn-download');
    if (downloadBtn) {
      downloadBtn.focus();
    }
  }

  function hide() {
    if (overlayEl) {
      overlayEl.hidden = true;
    }
    setInert(false);
  }

  function isVisible() {
    return !!(overlayEl && !overlayEl.hidden);
  }

  window.addEventListener('focus', () => {
    if (isVisible()) recheck();
  });

  document.addEventListener('visibilitychange', () => {
    if (isVisible() && document.visibilityState === 'visible') {
      recheck();
    }
  });

  if (Xen.store) {
    Xen.store.on('compiler:status', (status) => {
      if (status && status.usable) {
        if (isVisible()) {
          hide();
          Xen.toast(`Xenapse Language ${status.version} detected.`);
          if (Xen.preview && typeof Xen.preview.render === 'function') {
            Xen.preview.render();
          }
        }
      } else {
        if (!isVisible()) {
          show();
        } else {
          updateContent(status);
        }
      }
    });
  }

  Xen.dependency = { show, hide, recheck, isVisible };
})();
