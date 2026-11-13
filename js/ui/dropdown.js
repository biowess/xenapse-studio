/* Reusable, accessible custom dropdown component matching Xenapse Studio design tokens */
(function () {
  window.Xen = window.Xen || {};

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  let activeDropdown = null;

  function closeAll() {
    if (activeDropdown) {
      activeDropdown.classList.remove('is-open');
      const tr = activeDropdown.querySelector('.x-dropdown__trigger');
      if (tr) tr.setAttribute('aria-expanded', 'false');
      activeDropdown = null;
    }
  }

  const dropdownConfigs = new Map();

  function render(cfg) {
    const {
      id = '',
      pref = '',
      value = '',
      options = [],
      placeholder = 'Select…',
      disabled = false,
      className = '',
      ariaLabel = '',
      dataType = 'string',
    } = cfg;

    dropdownConfigs.set(id, cfg);

    const cur = options.find((o) => String(o.value) === String(value)) || options[0] || { value: '', label: placeholder };
    const curLabel = cur ? cur.label : placeholder;
    const curFont = cur && cur.fontFamily ? `font-family:'${cur.fontFamily}',sans-serif;` : '';

    return `<div class="x-dropdown ${className}${disabled ? ' is-disabled' : ''}" id="x-dd-${id}" data-pref="${pref || id}" data-value="${esc(value)}" data-type="${dataType}">
      <button type="button" class="x-dropdown__trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(ariaLabel || id)}" ${disabled ? 'disabled' : ''}>
        <span class="x-dropdown__current" style="${curFont}">${esc(curLabel)}</span>
        <span class="x-dropdown__arrow"><i data-icon="chevron-down"></i></span>
      </button>
      <div class="x-dropdown__menu" role="listbox" tabindex="-1" aria-label="${esc(ariaLabel || id)}"></div>
    </div>`;
  }

  function ensureMenuLoaded(dd) {
    if (dd.dataset.loaded) return;
    const id = dd.id.replace(/^x-dd-/, '');
    const cfg = dropdownConfigs.get(id);
    if (!cfg || !cfg.options) return;
    const menu = dd.querySelector('.x-dropdown__menu');
    if (!menu) return;

    menu.innerHTML = cfg.options.map((opt, idx) => {
      const isSel = String(opt.value) === String(dd.dataset.value);
      const fontStyle = opt.fontFamily ? `font-family:'${opt.fontFamily}',sans-serif;` : '';
      return `<div class="x-dropdown__item${isSel ? ' is-selected' : ''}" role="option" id="x-opt-${cfg.id}-${idx}" aria-selected="${isSel}" data-val="${esc(opt.value)}" tabindex="-1" style="${fontStyle}">
        <div class="x-dropdown__item-text">
          <span class="x-dropdown__item-label">${esc(opt.label)}</span>
          ${opt.sub ? `<span class="x-dropdown__item-sub">${esc(opt.sub)}</span>` : ''}
        </div>
        ${opt.swatches ? `<div class="x-dropdown__item-swatches">${opt.swatches.map((c) => `<span style="background:${c}"></span>`).join('')}</div>` : ''}
        ${isSel ? '<span class="x-dropdown__check"><i data-icon="check"></i></span>' : ''}
      </div>`;
    }).join('');
    Xen.icons.hydrate(menu);
    dd.dataset.loaded = '1';
  }

  function setupGlobalEvents() {
    if (window._xenDropdownInit) return;
    window._xenDropdownInit = true;

    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.x-dropdown__trigger');
      if (trigger) {
        const dd = trigger.closest('.x-dropdown');
        if (!dd || dd.classList.contains('is-disabled')) return;
        e.preventDefault();
        e.stopPropagation();

        if (dd === activeDropdown) {
          closeAll();
        } else {
          closeAll();
          ensureMenuLoaded(dd);
          dd.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
          activeDropdown = dd;

          // Scroll selected item into view
          const sel = dd.querySelector('.x-dropdown__item.is-selected');
          if (sel) {
            sel.scrollIntoView({ block: 'nearest' });
          }
        }
        return;
      }

      const item = e.target.closest('.x-dropdown__item');
      if (item) {
        const dd = item.closest('.x-dropdown');
        if (!dd) return;
        e.preventDefault();
        e.stopPropagation();

        const rawVal = item.dataset.val;
        const val = dd.dataset.type === 'number' ? Number(rawVal) : rawVal;
        const pref = dd.dataset.pref;

        closeAll();

        if (pref && Xen.prefs) {
          Xen.prefs.set(pref, val);
          if (Xen.backstage && Xen.backstage.isOpen()) {
            Xen.backstage.refresh();
          }
        }

        const evt = new CustomEvent('x-dropdown-change', { bubbles: true, detail: { value: val, pref } });
        dd.dispatchEvent(evt);
        return;
      }

      // Click outside
      closeAll();
    });

    document.addEventListener('keydown', (e) => {
      if (!activeDropdown) {
        // Check if focused on a dropdown trigger
        const tr = document.activeElement && document.activeElement.closest('.x-dropdown__trigger');
        if (tr && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          tr.click();
        }
        return;
      }

      const dd = activeDropdown;
      const items = Array.from(dd.querySelectorAll('.x-dropdown__item'));
      let highlighted = dd.querySelector('.x-dropdown__item.is-highlighted') || dd.querySelector('.x-dropdown__item.is-selected') || items[0];
      let curIdx = items.indexOf(highlighted);

      if (e.key === 'Escape') {
        e.preventDefault();
        const tr = dd.querySelector('.x-dropdown__trigger');
        closeAll();
        if (tr) tr.focus();
        return;
      }

      if (e.key === 'Tab') {
        closeAll();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        curIdx = (curIdx + 1) % items.length;
        items.forEach((it, idx) => it.classList.toggle('is-highlighted', idx === curIdx));
        items[curIdx].scrollIntoView({ block: 'nearest' });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        curIdx = (curIdx - 1 + items.length) % items.length;
        items.forEach((it, idx) => it.classList.toggle('is-highlighted', idx === curIdx));
        items[curIdx].scrollIntoView({ block: 'nearest' });
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        curIdx = 0;
        items.forEach((it, idx) => it.classList.toggle('is-highlighted', idx === curIdx));
        items[0].scrollIntoView({ block: 'nearest' });
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        curIdx = items.length - 1;
        items.forEach((it, idx) => it.classList.toggle('is-highlighted', idx === curIdx));
        items[curIdx].scrollIntoView({ block: 'nearest' });
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (items[curIdx]) {
          items[curIdx].click();
        }
      }
    });
  }

  setupGlobalEvents();

  Xen.dropdown = {
    render,
    closeAll,
  };
})();
