/* Minimal, robust, zero-dependency Markdown renderer for Xenapse documentation and legal viewer */
(function () {
  window.Xen = window.Xen || {};

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inline(s) {
    if (!s) return '';
    // Escaped backticks / literals
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code class="doc-inline-code">${escapeHtml(c)}</code>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Markdown links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const u = url.trim();
      const isExt = /^https?:\/\//i.test(u);
      const isDoc = /\.md(#.*)?$/i.test(u) || !u.includes(':');
      if (isExt) {
        return `<a href="${escapeHtml(u)}" class="doc-link doc-link--ext" target="_blank" rel="noopener noreferrer">${text} <i data-icon="external-link" class="doc-link__icon"></i></a>`;
      }
      if (u.startsWith('#')) {
        return `<a href="${escapeHtml(u)}" class="doc-link doc-link--anchor" data-anchor="${escapeHtml(u.slice(1))}">${text}</a>`;
      }
      return `<a href="${escapeHtml(u)}" class="doc-link doc-link--doc" data-doc-link="${escapeHtml(u)}">${text}</a>`;
    });
    return s;
  }

  function render(md) {
    if (!md) return '';
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    let out = '';
    let inCode = false;
    let codeLang = '';
    let codeLines = [];
    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];
    let inList = false;
    let listType = '';
    let inBlockquote = false;
    let bqLines = [];

    function closeList() {
      if (inList) {
        out += `</${listType}>\n`;
        inList = false;
        listType = '';
      }
    }

    function closeTable() {
      if (inTable) {
        out += `<div class="doc-table-wrap"><table class="doc-table"><thead><tr>`;
        tableHeaders.forEach((h) => (out += `<th>${inline(h.trim())}</th>`));
        out += `</tr></thead><tbody>\n`;
        tableRows.forEach((row) => {
          out += `<tr>`;
          row.forEach((cell) => (out += `<td>${inline(cell.trim())}</td>`));
          out += `</tr>\n`;
        });
        out += `</tbody></table></div>\n`;
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }
    }

    function closeBq() {
      if (inBlockquote) {
        out += `<blockquote class="doc-blockquote">${render(bqLines.join('\n'))}</blockquote>\n`;
        inBlockquote = false;
        bqLines = [];
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fenced code blocks
      if (line.trim().startsWith('```')) {
        if (inCode) {
          const rawCode = codeLines.join('\n');
          out += `<div class="doc-code-block"><div class="doc-code-head"><span class="doc-code-lang">${escapeHtml(codeLang || 'text')}</span><button class="doc-code-copy" data-copy="${escapeHtml(rawCode)}" title="Copy code" aria-label="Copy code"><i data-icon="copy"></i><span>Copy</span></button></div><pre class="doc-code"><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(rawCode)}</code></pre></div>\n`;
          inCode = false;
          codeLines = [];
          codeLang = '';
        } else {
          closeList();
          closeTable();
          closeBq();
          inCode = true;
          codeLang = line.trim().slice(3).trim();
        }
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }

      // Blockquote
      if (line.startsWith('>')) {
        closeList();
        closeTable();
        inBlockquote = true;
        bqLines.push(line.replace(/^>\s?/, ''));
        continue;
      } else if (inBlockquote && line.trim() === '') {
        closeBq();
        continue;
      }

      // Table rows
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        closeList();
        closeBq();
        const cells = line.split('|').slice(1, -1);
        if (!inTable) {
          if (i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*\|/.test(lines[i + 1])) {
            inTable = true;
            tableHeaders = cells;
            i++; // skip separator row
            continue;
          }
        } else {
          tableRows.push(cells);
          continue;
        }
      } else if (inTable) {
        closeTable();
      }

      // Unordered lists
      const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
      if (ulMatch) {
        closeTable();
        closeBq();
        if (!inList || listType !== 'ul') {
          closeList();
          out += `<ul class="doc-list">\n`;
          inList = true;
          listType = 'ul';
        }
        out += `<li>${inline(ulMatch[3])}</li>\n`;
        continue;
      }

      // Subclauses like (a), (b), (c)
      const subMatch = line.match(/^(\s*)\(([a-z0-9]+)\)\s+(.*)$/i);
      if (subMatch) {
        closeTable();
        closeBq();
        out += `<div class="doc-subclause" style="margin: 6px 0 6px 20px;"><strong style="color: var(--accent); margin-right: 4px;">(${subMatch[2]})</strong><span>${inline(subMatch[3])}</span></div>\n`;
        continue;
      }

      // Ordered lists (preserves actual section numbers and prevents reset to 1.)
      const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
      if (olMatch) {
        closeTable();
        closeBq();
        const num = parseInt(olMatch[2], 10);
        if (!inList || listType !== 'ol') {
          closeList();
          out += `<ol class="doc-list doc-list--ordered" start="${num}">\n`;
          inList = true;
          listType = 'ol';
        }
        out += `<li value="${num}">${inline(olMatch[3])}</li>\n`;
        continue;
      }

      // List continuations / indented paragraphs inside sections
      if (inList && line.match(/^\s{2,}\S/)) {
        out += `<div class="doc-list-desc" style="margin: 6px 0 8px 18px; color: var(--text-2);">${inline(line.trim())}</div>\n`;
        continue;
      }

      if (inList && line.trim() === '') {
        // Look ahead to check if the list continues after empty line
        let nextNonEmpty = '';
        for (let j = i + 1; j < lines.length; j++) {
          const trimmed = lines[j].trim();
          if (trimmed !== '') {
            nextNonEmpty = lines[j];
            break;
          }
        }
        if (
          /^(\s*)(\d+)\.\s+/.test(nextNonEmpty) ||
          /^(\s*)([-*+])\s+/.test(nextNonEmpty) ||
          /^(\s*)\(([a-z0-9]+)\)\s+/i.test(nextNonEmpty) ||
          /^(\s{2,})\S/.test(nextNonEmpty)
        ) {
          continue;
        }
        closeList();
        continue;
      }

      // Horizontal rule
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        closeList();
        closeTable();
        closeBq();
        out += `<hr class="doc-hr">\n`;
        continue;
      }

      // Headings
      const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        closeList();
        closeTable();
        closeBq();
        const level = hMatch[1].length;
        const text = hMatch[2].trim();
        const slug = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        out += `<h${level} id="${slug}" class="doc-heading doc-h${level}"><a class="doc-heading__anchor" href="#${slug}" aria-hidden="true">#</a><span>${inline(text)}</span></h${level}>\n`;
        continue;
      }

      if (line.trim() === '') {
        continue;
      }

      // Paragraph
      closeList();
      closeTable();
      closeBq();
      out += `<p class="doc-p">${inline(line)}</p>\n`;
    }

    closeList();
    closeTable();
    closeBq();
    return out;
  }

  Xen.markdown = { render, escapeHtml, inline };
})();
