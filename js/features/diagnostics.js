/* Compiler diagnostics parser, navigation and Problems panel. */
(function () {
  const { store, util } = Xen, S = store.state, D = S.doc, Doc = Xen.doc, { $, esc } = util;

  let currentProblems = [];
  let isCollapsed = true;
  let userCollapsed = false;
  let prevErrorCount = 0;

  const panel = $('#problems-panel');
  const headerEl = $('#problems-header');
  const countsEl = $('#problems-counts');
  const listEl = $('#problems-list');
  const liveEl = $('#problems-live');

  /* ---- Unicode scalar value position to UTF-16 offset ---- */
  function posToOffset(text, line, col) {
    if (!text) return 0;
    const targetLine = Math.max(1, line || 1);
    const targetCol = Math.max(1, col || 1);
    const len = text.length;

    let curLine = 1;
    let lineStart = 0;
    while (curLine < targetLine && lineStart < len) {
      const nl = text.indexOf('\n', lineStart);
      if (nl === -1) {
        lineStart = len;
        break;
      }
      lineStart = nl + 1;
      curLine++;
    }
    if (lineStart >= len) return len;

    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = len;
    if (lineEnd > lineStart && text.charCodeAt(lineEnd - 1) === 13) {
      lineEnd--;
    }

    const lineStr = text.slice(lineStart, lineEnd);
    let codePoints = 0;
    let offsetInLine = 0;
    const needCodePoints = targetCol - 1;

    for (const ch of lineStr) {
      if (codePoints >= needCodePoints) break;
      offsetInLine += ch.length;
      codePoints++;
    }

    return Math.min(len, lineStart + offsetInLine);
  }

  function navigate(origin, line, col) {
    if (origin === 'system' || !line) return;
    if (origin === 'source') {
      if (S.ui.tab !== 'xnp') {
        S.ui.tab = 'xnp';
        store.emit('ui');
      }
    } else if (origin === 'stylesheet') {
      Xen.xcss.open();
    }
    const text = Xen.editor.value;
    const offset = posToOffset(text, line, col);
    Xen.editor.setSelection(offset, offset);
    Xen.editor.revealLine(line);
    Xen.editor.focus();
  }

  /* ---- Raw stderr parser ---- */
  function parse(stderr) {
    if (!stderr || typeof stderr !== 'string') return [];
    const lines = stderr.split(/\r?\n/);
    const items = [];
    let current = null;
    let mode = ''; // 'message' | 'help' | 'ignored_note'

    const HEADER_RE = /^(input\.xnp|style\.xcss):(\d+):(\d+):\s*(error|warning)\[(XN-[A-Z]+-\d{3})\]$/;
    const HELP_RE = /^help:\s*(.*)$/;
    const NOTE_POS_RE = /^note:\s*(.+?)\s+at\s+(input\.xnp|style\.xcss):(\d+):(\d+)$/;
    const NOTE_GENERIC_RE = /^note:\s*/;
    const ERROR_RE = /^error:\s*(.*)$/;

    for (const rawLine of lines) {
      const line = rawLine;
      const trimmed = line.trim();
      if (!trimmed && !current) continue;

      const headerMatch = HEADER_RE.exec(line);
      if (headerMatch) {
        current = {
          severity: headerMatch[4],
          code: headerMatch[5],
          message: '',
          help: null,
          notes: [],
          origin: headerMatch[1] === 'input.xnp' ? 'source' : 'stylesheet',
          line: parseInt(headerMatch[2], 10),
          col: parseInt(headerMatch[3], 10),
        };
        items.push(current);
        mode = 'message';
        continue;
      }

      const helpMatch = HELP_RE.exec(line);
      if (helpMatch) {
        if (current) {
          current.help = helpMatch[1];
          mode = 'help';
        }
        continue;
      }

      const noteMatch = NOTE_POS_RE.exec(line);
      if (noteMatch) {
        if (current) {
          current.notes.push({
            label: noteMatch[1],
            origin: noteMatch[2] === 'input.xnp' ? 'source' : 'stylesheet',
            line: parseInt(noteMatch[3], 10),
            col: parseInt(noteMatch[4], 10),
          });
          mode = 'note';
        }
        continue;
      }

      if (NOTE_GENERIC_RE.test(line)) {
        mode = 'ignored_note';
        continue;
      }

      const errMatch = ERROR_RE.exec(line);
      if (errMatch) {
        current = {
          severity: 'error',
          code: null,
          message: errMatch[1] || 'Error',
          help: null,
          notes: [],
          origin: 'system',
          line: null,
          col: null,
        };
        items.push(current);
        mode = 'message';
        continue;
      }

      if (mode === 'ignored_note') continue;
      if (!trimmed) continue;

      if (current) {
        if (mode === 'help') {
          current.help = (current.help ? current.help + '\n' : '') + trimmed;
        } else {
          current.message = (current.message ? current.message + '\n' : '') + trimmed;
        }
      } else {
        current = {
          severity: 'error',
          code: null,
          message: trimmed,
          help: null,
          notes: [],
          origin: 'system',
          line: null,
          col: null,
        };
        items.push(current);
        mode = 'message';
      }
    }

    return items;
  }

  /* ---- Native locate stylesheet ---- */
  async function locateStylesheet() {
    const defaultDir = D.path ? D.path.replace(/[\\/][^\\/]+$/, '') : null;
    const picked = await Xen.fileService.openStylesheetDialog({ defaultDir });
    if (!picked) return;
    const res = await Xen.fileService.readText(picked);
    if (res.error) {
      return Xen.dialogs.alert({ title: 'Could not attach stylesheet', message: res.error.message, error: true });
    }
    const base = Doc.baseName(picked);
    let declared = base;
    if (D.path) {
      declared = await Xen.fileService.relativePath({ fromDocPath: D.path, toPath: picked });
    }
    D.xnp.text = Doc.setDeclared(D.xnp.text, declared);
    D.xcss = { declared, fileName: base, path: picked, text: res.text, saved: res.text, state: 'loaded' };
    store.emit('text', { buffer: 'xnp', source: 'sync' });
    store.emit('text', { buffer: 'xcss', source: 'sync' });
    store.emit('doc');
    Xen.xcss.open();
    Xen.preview.render();
    Xen.toast(`Attached ${D.xcss.fileName}.`, { kind: 'success' });
  }

  /* ---- Panel collapse / expand ---- */
  function expand(fromUser = false) {
    if (!panel) return;
    isCollapsed = false;
    panel.classList.remove('is-collapsed');
    if (headerEl) headerEl.setAttribute('aria-expanded', 'true');
    if (fromUser) userCollapsed = false;
  }

  function collapse(fromUser = false) {
    if (!panel) return;
    isCollapsed = true;
    panel.classList.add('is-collapsed');
    if (headerEl) headerEl.setAttribute('aria-expanded', 'false');
    if (fromUser) userCollapsed = true;
  }

  function toggle(fromUser = false) {
    if (isCollapsed) expand(fromUser);
    else collapse(fromUser);
  }

  /* ---- Render Problems panel ---- */
  function renderList() {
    if (!panel || !listEl) return;
    const total = currentProblems.length;
    const errors = currentProblems.filter((i) => i.severity === 'error').length;
    const warnings = currentProblems.filter((i) => i.severity === 'warning').length;

    let countText = '';
    if (total === 0) {
      countText = 'No problems';
    } else {
      const parts = [];
      if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
      if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
      countText = parts.join(' · ');
    }
    if (countsEl) countsEl.textContent = countText;

    if (liveEl) {
      const liveText = total === 0 ? 'No problems' : countText.replace(' · ', ', ');
      if (liveEl.textContent !== liveText) {
        liveEl.textContent = liveText;
      }
    }

    if (total === 0) {
      listEl.innerHTML = '<div class="problems-empty">No problems.</div>';
      return;
    }

    const displayed = currentProblems.slice(0, 200);
    const overflow = total - displayed.length;

    let html = '';
    displayed.forEach((d, idx) => {
      const sev = d.severity === 'warning' ? 'warning' : 'error';
      const locText = d.line ? `${d.origin === 'stylesheet' ? 'style.xcss' : 'input.xnp'} ${d.line}:${d.col || 1}` : '';

      html += `<div class="problems-row problems-row--${sev}" role="button" tabindex="0" data-idx="${idx}" aria-label="${sev}: ${esc(d.message)}">`;
      html += `  <div class="problems-row-main">`;
      html += `    <span class="problems-icon problems-icon--${sev}"><i data-icon="${sev}"></i></span>`;
      if (d.code) html += `    <span class="problems-code">${esc(d.code)}</span>`;
      html += `    <span class="problems-msg">${esc(d.message)}</span>`;
      if (locText) html += `    <span class="problems-loc">${esc(locText)}</span>`;
      html += `  </div>`;

      if (d.help) {
        html += `  <div class="problems-help">${esc(d.help)}</div>`;
      }

      if (d.notes && d.notes.length) {
        d.notes.forEach((n) => {
          const nLoc = `${n.origin === 'stylesheet' ? 'style.xcss' : 'input.xnp'} ${n.line}:${n.col}`;
          html += `  <div class="problems-note" role="button" tabindex="0" data-note-origin="${n.origin}" data-note-line="${n.line}" data-note-col="${n.col}">`;
          html += `    <span>note: ${esc(n.label)} at ${esc(nLoc)}</span>`;
          html += `  </div>`;
        });
      }

      if (d.actions && d.actions.length) {
        html += `  <div class="problems-actions">`;
        d.actions.forEach((a) => {
          html += `    <button class="btn btn--sm" type="button" data-action="${esc(a.id)}">${esc(a.label)}</button>`;
        });
        html += `  </div>`;
      }

      html += `</div>`;
    });

    if (overflow > 0) {
      html += `<div class="problems-overflow">and ${overflow} more</div>`;
    }

    listEl.innerHTML = html;
    Xen.icons.hydrate(listEl);
  }

  function setProblems(items) {
    const list = Array.isArray(items) ? items.slice() : [];

    // Studio-originated entry: missing stylesheet
    if (D.xcss && D.xcss.state === 'missing') {
      const name = D.xcss.fileName || D.xcss.declared || 'stylesheet';
      list.unshift({
        severity: 'error',
        code: null,
        message: `Stylesheet “${name}” was not found next to the document.`,
        help: null,
        notes: [],
        origin: 'system',
        line: null,
        col: null,
        actions: [
          { id: 'create-xcss', label: 'Create stylesheet' },
          { id: 'locate-xcss', label: 'Locate…' },
        ],
      });
    }

    currentProblems = list;

    const errors = currentProblems.filter((i) => i.severity === 'error').length;
    if (errors > 0 && prevErrorCount === 0 && !userCollapsed) {
      expand(false);
    }
    prevErrorCount = errors;

    renderList();
    store.emit('diagnostics:update');
  }

  function clear() {
    currentProblems = [];
    prevErrorCount = 0;
    renderList();
    store.emit('diagnostics:update');
  }

  function counts() {
    const errors = currentProblems.filter((i) => i.severity === 'error').length;
    const warnings = currentProblems.filter((i) => i.severity === 'warning').length;
    return { errors, warnings, total: currentProblems.length };
  }

  /* ---- Event listeners ---- */
  if (headerEl) {
    headerEl.addEventListener('click', () => toggle(true));
    headerEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(true);
      }
    });
  }

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        e.stopPropagation();
        const actionId = actionBtn.dataset.action;
        if (actionId === 'create-xcss') Xen.xcss?.createMissing?.();
        else if (actionId === 'locate-xcss') locateStylesheet();
        return;
      }

      const noteEl = e.target.closest('.problems-note');
      if (noteEl) {
        e.stopPropagation();
        const origin = noteEl.dataset.noteOrigin;
        const line = parseInt(noteEl.dataset.noteLine, 10);
        const col = parseInt(noteEl.dataset.noteCol, 10);
        navigate(origin, line, col);
        return;
      }

      const row = e.target.closest('.problems-row');
      if (row) {
        const idx = parseInt(row.dataset.idx, 10);
        const d = currentProblems[idx];
        if (d && d.origin !== 'system' && d.line != null) {
          navigate(d.origin, d.line, d.col);
        }
      }
    });

    listEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = e.target;
        if (target && (target.classList.contains('problems-row') || target.classList.contains('problems-note'))) {
          e.preventDefault();
          target.click();
        }
      }
    });
  }

  Xen.diagnostics = {
    parse,
    setProblems,
    clear,
    counts,
    toggle,
    expand,
    collapse,
    locateStylesheet,
    get items() { return currentProblems; },
  };

  renderList();
})();
