/* Promise-based dialogs on native <dialog> (focus trap + Esc for free). */
(function () {
  const { esc } = Xen.util;
  const root = () => document.getElementById('dialog-root');
  function open({ title, body, actions, wide, error, input }) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = 'dialog' + (wide ? ' dialog--wide' : '') + (error ? ' dialog--error' : '');
      d.setAttribute('aria-labelledby', 'dlg-title');
      const foot = actions.map((a) => a.spacer ? '<span class="spacer"></span>' : `<button class="btn${a.kind ? ' btn--' + a.kind : ''}" value="${a.id}" ${a.id === 'cancel' ? 'formnovalidate' : ''}>${esc(a.label)}</button>`).join('');
      d.innerHTML = `<form method="dialog"><div class="dialog__head"><h2 id="dlg-title">${esc(title)}</h2></div><div class="dialog__body">${body}</div><div class="dialog__foot">${foot}</div></form>`;
      root().appendChild(d);
      d.addEventListener('close', () => {
        const val = d.returnValue || 'cancel';
        const field = d.querySelector('input.js-dialog-input');
        d.remove();
        resolve(input ? (val === 'ok' ? field.value : null) : val);
      });
      d.addEventListener('mousedown', (e) => { if (e.target === d) d.close('cancel'); });
      d.showModal();
      const f = d.querySelector('input.js-dialog-input'); if (f) { f.focus(); f.select(); }
      else { const p = d.querySelector('.btn--primary') || d.querySelector('.dialog__foot .btn:last-child'); p && p.focus(); }
    });
  }
  Xen.dialogs = {
    choose: ({ title, message, html, actions, error }) => open({ title, body: html || `<p>${esc(message)}</p>`, actions, error }),
    alert: ({ title, message, html, error }) => open({ title, body: html || `<p>${esc(message)}</p>`, actions: [{ id: 'ok', label: 'OK', kind: 'primary' }], error }),
    prompt: ({ title, label, value = '', confirm = 'OK', hint = '' }) => open({ title, input: true,
      body: `<div class="field"><label for="dlg-input">${esc(label)}</label><input id="dlg-input" class="input js-dialog-input" value="${esc(value)}" autocomplete="off" required>${hint ? `<p class="kbd">${esc(hint)}</p>` : ''}</div>`,
      actions: [{ id: 'cancel', label: 'Cancel' }, { id: 'ok', label: confirm, kind: 'primary' }] }),
    info: ({ title, html }) => open({ title, body: html, wide: true, actions: [{ id: 'ok', label: 'Close', kind: 'primary' }] }),
    /* Save / Discard / Cancel */
    unsaved: ({ title, message, saveLabel = 'Save', discardLabel = 'Discard' }) => open({ title, body: `<p>${esc(message)}</p>`,
      actions: [{ id: 'discard', label: discardLabel, kind: 'danger' }, { spacer: true }, { id: 'cancel', label: 'Cancel' }, { id: 'save', label: saveLabel, kind: 'primary' }] }),
  };
})();
